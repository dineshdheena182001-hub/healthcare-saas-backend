const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { generatePatientId } = require('../utils/patientIdGenerator');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * POST /api/patients/register
 * Register a new patient
 */
const registerPatient = async (req, res, next) => {
  try {
    const { full_name, mobile, gender, dob, blood_group, address, password } = req.body;

    // Check duplicate mobile
    const [existing] = await pool.execute(
      'SELECT id FROM patients WHERE mobile = ?',
      [mobile]
    );
    if (existing.length > 0) {
      return errorResponse(res, 'Mobile number already registered.', 409);
    }

    // Generate patient ID
    const patient_id = await generatePatientId();

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert patient
    const [result] = await pool.execute(
      `INSERT INTO patients 
        (patient_id, full_name, mobile, gender, dob, blood_group, address, password_hash) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, full_name, mobile, gender, dob, blood_group, address, password_hash]
    );

    // Insert default wellness log
    await pool.execute(
      `INSERT INTO wellness_logs (patient_id) VALUES (?)`,
      [result.insertId]
    );

    return successResponse(res, {
      patient_id,
      full_name,
      mobile,
    }, 'Patient registered successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/patients/:id
 * Get patient profile with wellness data
 */
const getPatientProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [patients] = await pool.execute(
      `SELECT 
        p.id, p.patient_id, p.full_name, p.mobile, p.gender, p.dob,
        p.blood_group, p.address, p.profile_photo, p.created_at,
        w.bp, w.sugar, w.sleep_hours, w.stress_level, w.allergies, w.updated_at as wellness_updated_at
       FROM patients p
       LEFT JOIN wellness_logs w ON w.patient_id = p.id
       WHERE p.patient_id = ?`,
      [id]
    );

    if (patients.length === 0) {
      return errorResponse(res, 'Patient not found.', 404);
    }

    const p = patients[0];

    return successResponse(res, {
      patient_id: p.patient_id,
      full_name: p.full_name,
      mobile: p.mobile,
      gender: p.gender,
      dob: p.dob,
      blood_group: p.blood_group,
      address: p.address,
      profile_photo: p.profile_photo,
      wellness: {
        bp: p.bp,
        sugar: p.sugar,
        sleep: p.sleep_hours,
        stress: p.stress_level,
        allergies: p.allergies ? JSON.parse(p.allergies) : [],
      },
      registered_at: p.created_at,
    }, 'Patient profile retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/patients/:id
 * Update patient profile
 */
const updatePatientProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      full_name, gender, dob, blood_group, address, profile_photo,
      // Wellness fields
      bp, sugar, sleep, stress, allergies,
    } = req.body;

    // Check patient exists
    const [patients] = await pool.execute(
      'SELECT id FROM patients WHERE patient_id = ?',
      [id]
    );
    if (patients.length === 0) {
      return errorResponse(res, 'Patient not found.', 404);
    }

    const patientDbId = patients[0].id;

    // Update basic info
    await pool.execute(
      `UPDATE patients SET 
        full_name = COALESCE(?, full_name),
        gender = COALESCE(?, gender),
        dob = COALESCE(?, dob),
        blood_group = COALESCE(?, blood_group),
        address = COALESCE(?, address),
        profile_photo = COALESCE(?, profile_photo),
        updated_at = NOW()
       WHERE id = ?`,
      [full_name, gender, dob, blood_group, address, profile_photo, patientDbId]
    );

    // Update wellness logs if provided
    if (bp || sugar || sleep || stress || allergies) {
      const allergiesJson = allergies ? JSON.stringify(allergies) : null;

      await pool.execute(
        `INSERT INTO wellness_logs (patient_id, bp, sugar, sleep_hours, stress_level, allergies, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           bp = COALESCE(VALUES(bp), bp),
           sugar = COALESCE(VALUES(sugar), sugar),
           sleep_hours = COALESCE(VALUES(sleep_hours), sleep_hours),
           stress_level = COALESCE(VALUES(stress_level), stress_level),
           allergies = COALESCE(VALUES(allergies), allergies),
           updated_at = NOW()`,
        [patientDbId, bp, sugar, sleep, stress, allergiesJson]
      );
    }

    return successResponse(res, { patient_id: id }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/patients
 * List all patients (admin use with pagination)
 */
const listPatients = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const searchQuery = `%${search}%`;

    const [patients] = await pool.execute(
      `SELECT patient_id, full_name, mobile, gender, blood_group, created_at
       FROM patients
       WHERE full_name LIKE ? OR patient_id LIKE ? OR mobile LIKE ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [searchQuery, searchQuery, searchQuery, limit, offset]
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM patients
       WHERE full_name LIKE ? OR patient_id LIKE ? OR mobile LIKE ?`,
      [searchQuery, searchQuery, searchQuery]
    );

    return res.status(200).json({
      success: true,
      message: 'Patients retrieved',
      data: patients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerPatient, getPatientProfile, updatePatientProfile, listPatients };
