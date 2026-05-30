const { pool } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/dashboard/home
 * Dashboard summary for logged-in patient
 */
const getDashboardHome = async (req, res, next) => {
  try {
    const { patient_id } = req.user;

    // Fetch patient + wellness in one query
    const [patientRows] = await pool.execute(
      `SELECT 
        p.patient_id, p.full_name, p.profile_photo,
        w.bp, w.sugar, w.sleep_hours, w.stress_level
       FROM patients p
       LEFT JOIN wellness_logs w ON w.patient_id = p.id
       WHERE p.patient_id = ?`,
      [patient_id]
    );

    if (patientRows.length === 0) {
      return errorResponse(res, 'Patient not found.', 404);
    }
    const patient = patientRows[0];

    // Fetch today's appointment
    const [appointments] = await pool.execute(
      `SELECT 
        a.id, a.token_number, a.appointment_date, a.slot_time, a.status,
        d.full_name as doctor_name, d.specialization,
        q.current_token, q.estimated_wait_minutes
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN queue_tracker q ON q.doctor_id = a.doctor_id AND q.date = CURDATE()
       WHERE a.patient_id = (SELECT id FROM patients WHERE patient_id = ?)
         AND a.appointment_date = CURDATE()
         AND a.status IN ('booked', 'waiting', 'in_progress')
       LIMIT 1`,
      [patient_id]
    );

    // Fetch today's therapy
    const [therapies] = await pool.execute(
      `SELECT t.therapy_name, t.room_number, t.scheduled_time
       FROM therapy_sessions t
       WHERE t.patient_id = (SELECT id FROM patients WHERE patient_id = ?)
         AND t.session_date = CURDATE()
         AND t.status = 'scheduled'
       LIMIT 1`,
      [patient_id]
    );

    // Fetch unread notifications
    const [notifications] = await pool.execute(
      `SELECT id, title, message, type, created_at
       FROM notifications
       WHERE patient_id = (SELECT id FROM patients WHERE patient_id = ?)
         AND is_read = 0
       ORDER BY created_at DESC
       LIMIT 5`,
      [patient_id]
    );

    // Build AI health summary
    const aiHealthSummary = buildAIHealthSummary({
      bp: patient.bp,
      sugar: patient.sugar,
      sleep: patient.sleep_hours,
      stress: patient.stress_level,
    });

    const appointmentData = appointments.length > 0 ? {
      appointment_id: appointments[0].id,
      doctor: appointments[0].doctor_name,
      specialization: appointments[0].specialization,
      time: appointments[0].slot_time,
      token: appointments[0].token_number,
      current_token: appointments[0].current_token || 0,
      wait_time: appointments[0].estimated_wait_minutes || 0,
      status: appointments[0].status,
    } : null;

    const therapyData = therapies.length > 0 ? {
      therapy_name: therapies[0].therapy_name,
      room: therapies[0].room_number,
      scheduled_time: therapies[0].scheduled_time,
    } : null;

    return successResponse(res, {
      patient: {
        name: patient.full_name,
        patient_id: patient.patient_id,
        profile_photo: patient.profile_photo,
      },
      wellness: {
        bp: patient.bp || '---',
        sugar: patient.sugar || '---',
        sleep: patient.sleep_hours || 0,
        stress: patient.stress_level || 0,
      },
      appointment: appointmentData,
      therapy: therapyData,
      ai_health_summary: aiHealthSummary,
      notifications: notifications,
      unread_notifications: notifications.length,
    }, 'Dashboard data retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * Basic AI health summary generator based on vitals
 */
const buildAIHealthSummary = ({ bp, sugar, sleep, stress }) => {
  const alerts = [];
  let overall = 'Good';

  if (bp) {
    const [systolic] = bp.split('/').map(Number);
    if (systolic >= 140) {
      alerts.push('Blood pressure is elevated. Consider consulting your doctor.');
      overall = 'Needs Attention';
    }
  }

  if (sugar && Number(sugar) > 140) {
    alerts.push('Blood sugar is above normal range. Monitor your diet.');
    overall = 'Needs Attention';
  }

  if (sleep && Number(sleep) < 6) {
    alerts.push('You are getting insufficient sleep. Aim for 7-9 hours.');
  }

  if (stress && Number(stress) > 70) {
    alerts.push('Stress levels are high. Consider relaxation techniques.');
  }

  return {
    overall_status: overall,
    summary: alerts.length > 0
      ? alerts.join(' ')
      : 'Your health vitals are within normal range. Keep it up!',
    alerts,
  };
};

/**
 * GET /api/dashboard/wellness
 * Wellness trend data
 */
const getWellnessSummary = async (req, res, next) => {
  try {
    const { patient_id } = req.user;

    const [logs] = await pool.execute(
      `SELECT bp, sugar, sleep_hours, stress_level, updated_at
       FROM wellness_logs
       WHERE patient_id = (SELECT id FROM patients WHERE patient_id = ?)
       ORDER BY updated_at DESC
       LIMIT 1`,
      [patient_id]
    );

    return successResponse(res, logs[0] || {}, 'Wellness data retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dashboard/notifications
 * Get patient notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const { patient_id } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [notifications] = await pool.execute(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE patient_id = (SELECT id FROM patients WHERE patient_id = ?)
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [patient_id, limit, offset]
    );

    // Mark all as read
    await pool.execute(
      `UPDATE notifications SET is_read = 1
       WHERE patient_id = (SELECT id FROM patients WHERE patient_id = ?) AND is_read = 0`,
      [patient_id]
    );

    return successResponse(res, notifications, 'Notifications retrieved');
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardHome, getWellnessSummary, getNotifications };
