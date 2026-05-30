const { pool } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * POST /api/wellness/log
 * Add a new wellness log entry (for trend tracking)
 */
const addWellnessLog = async (req, res, next) => {
  try {
    const { patient_id } = req.user;
    const { bp, sugar, sleep, stress, allergies, notes } = req.body;

    const [patients] = await pool.execute(
      'SELECT id FROM patients WHERE patient_id = ?',
      [patient_id]
    );

    if (patients.length === 0) {
      return errorResponse(res, 'Patient not found.', 404);
    }

    const allergiesJson = allergies ? JSON.stringify(allergies) : null;

    await pool.execute(
      `INSERT INTO wellness_logs (patient_id, bp, sugar, sleep_hours, stress_level, allergies, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         bp = COALESCE(VALUES(bp), bp),
         sugar = COALESCE(VALUES(sugar), sugar),
         sleep_hours = COALESCE(VALUES(sleep_hours), sleep_hours),
         stress_level = COALESCE(VALUES(stress_level), stress_level),
         allergies = COALESCE(VALUES(allergies), allergies),
         notes = COALESCE(VALUES(notes), notes),
         updated_at = NOW()`,
      [patients[0].id, bp, sugar, sleep, stress, allergiesJson, notes]
    );

    return successResponse(res, { patient_id }, 'Wellness data updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/wellness/history/:patient_id
 * Get wellness history for trend graph
 */
const getWellnessHistory = async (req, res, next) => {
  try {
    const { patient_id } = req.params;
    const { days = 30 } = req.query;

    const [logs] = await pool.execute(
      `SELECT bp, sugar, sleep_hours, stress_level, updated_at
       FROM wellness_logs
       WHERE patient_id = (SELECT id FROM patients WHERE patient_id = ?)
         AND updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY updated_at DESC`,
      [patient_id, parseInt(days)]
    );

    return successResponse(res, logs, 'Wellness history retrieved');
  } catch (error) {
    next(error);
  }
};

module.exports = { addWellnessLog, getWellnessHistory };
