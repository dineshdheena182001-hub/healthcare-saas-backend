const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { generateOTP, storeOTP, verifyOTP } = require('../utils/otpStore');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * POST /api/auth/send-otp
 * Send OTP to mobile number
 */
const sendOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    // Check if patient exists with this mobile
    const [patients] = await pool.execute(
      'SELECT id, patient_id, full_name FROM patients WHERE mobile = ?',
      [mobile]
    );

    // Generate and store OTP (mock - in production, send via SMS)
    const otp = generateOTP();
    storeOTP(mobile, otp);

    console.log(`📱 OTP for ${mobile}: ${otp}`); // For development

    return successResponse(res, {
      success: true,
      otp, // Return OTP in response as mock (remove in production)
      message: 'OTP sent successfully',
      is_registered: patients.length > 0,
    }, 'OTP sent successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify OTP and return JWT token
 */
const verifyOTPController = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;

    const result = verifyOTP(mobile, otp);
    if (!result.valid) {
      return errorResponse(res, result.reason, 400);
    }

    // Get or create patient record
    const [patients] = await pool.execute(
      'SELECT id, patient_id, full_name, mobile FROM patients WHERE mobile = ?',
      [mobile]
    );

    let patientData;
    if (patients.length === 0) {
      // New user - return token for registration step
      const token = generateToken({ mobile, role: 'guest', step: 'registration' });
      return successResponse(res, {
        token,
        is_new_user: true,
        message: 'OTP verified. Please complete registration.',
      }, 'OTP verified successfully');
    } else {
      patientData = patients[0];
    }

    const token = generateToken({
      id: patientData.id,
      patient_id: patientData.patient_id,
      mobile: patientData.mobile,
      role: 'patient',
    });

    return successResponse(res, {
      token,
      is_new_user: false,
      patient: {
        patient_id: patientData.patient_id,
        full_name: patientData.full_name,
        mobile: patientData.mobile,
      },
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Login using Patient ID + Password
 */
const loginWithPatientId = async (req, res, next) => {
  try {
    const { patient_id, password } = req.body;

    const [patients] = await pool.execute(
      'SELECT id, patient_id, full_name, mobile, password_hash FROM patients WHERE patient_id = ?',
      [patient_id]
    );

    if (patients.length === 0) {
      return errorResponse(res, 'Invalid Patient ID or password.', 401);
    }

    const patient = patients[0];

    if (!patient.password_hash) {
      return errorResponse(res, 'Password not set for this account. Please use OTP login.', 400);
    }

    const isMatch = await bcrypt.compare(password, patient.password_hash);
    if (!isMatch) {
      return errorResponse(res, 'Invalid Patient ID or password.', 401);
    }

    const token = generateToken({
      id: patient.id,
      patient_id: patient.patient_id,
      mobile: patient.mobile,
      role: 'patient',
    });

    return successResponse(res, {
      token,
      patient: {
        patient_id: patient.patient_id,
        full_name: patient.full_name,
        mobile: patient.mobile,
      },
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Logout (client-side token invalidation)
 */
const logout = async (req, res) => {
  return successResponse(res, null, 'Logged out successfully');
};

module.exports = { sendOTP, verifyOTPController, loginWithPatientId, logout };
