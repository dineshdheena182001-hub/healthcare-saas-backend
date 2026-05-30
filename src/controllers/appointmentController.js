const { pool } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/doctors
 * Get all available doctors with optional specialization filter
 */
const getDoctors = async (req, res, next) => {
  try {
    const { specialization, date } = req.query;

    let query = `
      SELECT 
        d.id, d.full_name, d.specialization, d.qualification,
        d.experience_years, d.consultation_fee, d.profile_photo,
        d.available_days, d.slot_duration_minutes
      FROM doctors d
      WHERE d.is_active = 1
    `;
    const params = [];

    if (specialization) {
      query += ' AND d.specialization LIKE ?';
      params.push(`%${specialization}%`);
    }

    query += ' ORDER BY d.full_name ASC';

    const [doctors] = await pool.execute(query, params);

    // Add available slots if date provided
    if (date) {
      for (const doctor of doctors) {
        const [booked] = await pool.execute(
          `SELECT slot_time FROM appointments 
           WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'`,
          [doctor.id, date]
        );
        doctor.booked_slots = booked.map(b => b.slot_time);
      }
    }

    return successResponse(res, doctors, 'Doctors retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doctors/:id/slots
 * Get available slots for a doctor on a date
 */
const getDoctorSlots = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return errorResponse(res, 'Date is required (YYYY-MM-DD)', 400);
    }

    const [doctors] = await pool.execute(
      'SELECT id, full_name, slot_duration_minutes FROM doctors WHERE id = ? AND is_active = 1',
      [id]
    );

    if (doctors.length === 0) {
      return errorResponse(res, 'Doctor not found.', 404);
    }

    // Standard slots (9AM - 5PM with 15 min gaps)
    const allSlots = [
      '09:00 AM', '09:15 AM', '09:30 AM', '09:45 AM',
      '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM',
      '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM',
      '02:00 PM', '02:15 PM', '02:30 PM', '02:45 PM',
      '03:00 PM', '03:15 PM', '03:30 PM', '03:45 PM',
      '04:00 PM', '04:15 PM', '04:30 PM', '04:45 PM',
    ];

    const [booked] = await pool.execute(
      `SELECT slot_time FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'`,
      [id, date]
    );

    const bookedSlots = booked.map(b => b.slot_time);
    const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

    return successResponse(res, {
      doctor_id: parseInt(id),
      doctor_name: doctors[0].full_name,
      date,
      available_slots: availableSlots,
      booked_slots: bookedSlots,
    }, 'Slots retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/appointments
 * Book an appointment
 */
const bookAppointment = async (req, res, next) => {
  try {
    const { patient_id, doctor_id, date, slot } = req.body;

    // Validate patient exists
    const [patients] = await pool.execute(
      'SELECT id FROM patients WHERE patient_id = ?',
      [patient_id]
    );
    if (patients.length === 0) {
      return errorResponse(res, 'Patient not found.', 404);
    }

    // Validate doctor exists
    const [doctors] = await pool.execute(
      'SELECT id, full_name, consultation_fee FROM doctors WHERE id = ? AND is_active = 1',
      [doctor_id]
    );
    if (doctors.length === 0) {
      return errorResponse(res, 'Doctor not found or not available.', 404);
    }

    // Check slot is not already booked
    const [existing] = await pool.execute(
      `SELECT id FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND slot_time = ? AND status != 'cancelled'`,
      [doctor_id, date, slot]
    );
    if (existing.length > 0) {
      return errorResponse(res, 'This slot is already booked. Please choose another.', 409);
    }

    // Check patient doesn't already have appointment at same time
    const [patientConflict] = await pool.execute(
      `SELECT id FROM appointments
       WHERE patient_id = ? AND appointment_date = ? AND slot_time = ? AND status != 'cancelled'`,
      [patients[0].id, date, slot]
    );
    if (patientConflict.length > 0) {
      return errorResponse(res, 'You already have an appointment at this time.', 409);
    }

    // Generate token number for the day
    const [[{ count }]] = await pool.execute(
      `SELECT COUNT(*) as count FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'`,
      [doctor_id, date]
    );
    const token_number = count + 1;

    // Book appointment
    const [result] = await pool.execute(
      `INSERT INTO appointments 
        (patient_id, doctor_id, appointment_date, slot_time, token_number, status, consultation_fee)
       VALUES (?, ?, ?, ?, ?, 'booked', ?)`,
      [patients[0].id, doctor_id, date, slot, token_number, doctors[0].consultation_fee]
    );

    // Update or create queue tracker
    await pool.execute(
      `INSERT INTO queue_tracker (doctor_id, date, current_token, estimated_wait_minutes)
       VALUES (?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE estimated_wait_minutes = estimated_wait_minutes`,
      [doctor_id, date, token_number * 15]
    );

    return successResponse(res, {
      appointment_id: result.insertId,
      patient_id,
      doctor: doctors[0].full_name,
      date,
      slot,
      token_number,
      estimated_wait_minutes: (token_number - 1) * 15,
      status: 'booked',
    }, 'Appointment booked successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/appointments/:id/queue
 * Get queue status for an appointment
 */
const getQueueStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [appointments] = await pool.execute(
      `SELECT 
        a.id, a.token_number, a.status, a.appointment_date, a.slot_time,
        a.doctor_id,
        d.full_name as doctor_name,
        q.current_token, q.estimated_wait_minutes, q.status as queue_status
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN queue_tracker q ON q.doctor_id = a.doctor_id AND q.date = a.appointment_date
       WHERE a.id = ?`,
      [id]
    );

    if (appointments.length === 0) {
      return errorResponse(res, 'Appointment not found.', 404);
    }

    const appt = appointments[0];
    const current_token = appt.current_token || 0;
    const position_ahead = Math.max(0, appt.token_number - current_token);
    const estimated_wait = position_ahead * 15; // 15 min per patient

    return successResponse(res, {
      appointment_id: appt.id,
      token: appt.token_number,
      current_token,
      position_ahead,
      estimated_wait,
      status: appt.queue_status || 'Running',
      doctor: appt.doctor_name,
      slot_time: appt.slot_time,
    }, 'Queue status retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/appointments/patient/:patient_id
 * Get patient's appointment history
 */
const getPatientAppointments = async (req, res, next) => {
  try {
    const { patient_id } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        a.id, a.token_number, a.appointment_date, a.slot_time, a.status,
        a.consultation_fee, a.created_at,
        d.full_name as doctor_name, d.specialization
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      WHERE a.patient_id = (SELECT id FROM patients WHERE patient_id = ?)
    `;
    const params = [patient_id];

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    query += ' ORDER BY a.appointment_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [appointments] = await pool.execute(query, params);

    return successResponse(res, appointments, 'Appointments retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/appointments/:id/cancel
 * Cancel an appointment
 */
const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [appointments] = await pool.execute(
      'SELECT id, status FROM appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      return errorResponse(res, 'Appointment not found.', 404);
    }

    if (appointments[0].status === 'cancelled') {
      return errorResponse(res, 'Appointment is already cancelled.', 400);
    }

    if (appointments[0].status === 'completed') {
      return errorResponse(res, 'Cannot cancel a completed appointment.', 400);
    }

    await pool.execute(
      "UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
      [id]
    );

    return successResponse(res, { appointment_id: parseInt(id) }, 'Appointment cancelled successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDoctors,
  getDoctorSlots,
  bookAppointment,
  getQueueStatus,
  getPatientAppointments,
  cancelAppointment,
};
