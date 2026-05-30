const { pool } = require('../config/database');

/**
 * Auto-generate Patient ID in format: SAMH-XXXXX
 * Fetches the last patient ID from DB and increments
 */
const generatePatientId = async () => {
  try {
    const [rows] = await pool.execute(
      'SELECT patient_id FROM patients ORDER BY id DESC LIMIT 1'
    );

    if (rows.length === 0) {
      return 'SAMH-10001';
    }

    const lastId = rows[0].patient_id; // e.g., SAMH-10001
    const numericPart = parseInt(lastId.split('-')[1]);
    const newNumeric = numericPart + 1;
    return `SAMH-${newNumeric}`;
  } catch (error) {
    // Fallback to timestamp-based ID
    const timestamp = Date.now().toString().slice(-5);
    return `SAMH-${timestamp}`;
  }
};

module.exports = { generatePatientId };
