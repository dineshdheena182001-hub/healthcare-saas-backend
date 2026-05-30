const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const {
  getDoctors,
  getDoctorSlots,
  bookAppointment,
  getQueueStatus,
  getPatientAppointments,
  cancelAppointment,
} = require('../controllers/appointmentController');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Doctor listing, appointment booking, and queue tracking
 */

/**
 * @swagger
 * /api/doctors:
 *   get:
 *     summary: Get all available doctors
 *     tags: [Appointments]
 *     parameters:
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of doctors with optional slot availability
 */
router.get('/doctors', authMiddleware, getDoctors);

/**
 * @swagger
 * /api/doctors/{id}/slots:
 *   get:
 *     summary: Get available slots for a doctor on a date
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Available and booked slots
 */
router.get('/doctors/:id/slots', authMiddleware, getDoctorSlots);

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Book an appointment
 *     tags: [Appointments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patient_id, doctor_id, date, slot]
 *             properties:
 *               patient_id:
 *                 type: string
 *                 example: "SAMH-20458"
 *               doctor_id:
 *                 type: integer
 *                 example: 1
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-05-30"
 *               slot:
 *                 type: string
 *                 example: "11:00 AM"
 *     responses:
 *       201:
 *         description: Appointment booked with token number
 *       409:
 *         description: Slot already taken
 */
router.post(
  '/appointments',
  authMiddleware,
  [
    body('patient_id').notEmpty().withMessage('Patient ID is required'),
    body('doctor_id').isInt({ min: 1 }).withMessage('Valid Doctor ID is required'),
    body('date').isDate().withMessage('Valid date required (YYYY-MM-DD)'),
    body('slot').notEmpty().withMessage('Slot time is required'),
  ],
  validate,
  bookAppointment
);

/**
 * @swagger
 * /api/appointments/{id}/queue:
 *   get:
 *     summary: Get real-time queue status for an appointment
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Queue position and wait time
 */
router.get('/appointments/:id/queue', authMiddleware, getQueueStatus);

/**
 * @swagger
 * /api/appointments/patient/{patient_id}:
 *   get:
 *     summary: Get appointment history for a patient
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: patient_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [booked, completed, cancelled, waiting]
 *     responses:
 *       200:
 *         description: Patient appointment list
 */
router.get('/appointments/patient/:patient_id', authMiddleware, getPatientAppointments);

/**
 * @swagger
 * /api/appointments/{id}/cancel:
 *   patch:
 *     summary: Cancel an appointment
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointment cancelled
 */
router.patch('/appointments/:id/cancel', authMiddleware, cancelAppointment);

module.exports = router;
