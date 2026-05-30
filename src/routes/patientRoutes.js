const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  registerPatient,
  getPatientProfile,
  updatePatientProfile,
  listPatients,
} = require('../controllers/patientController');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Patients
 *   description: Patient registration and profile management
 */

/**
 * @swagger
 * /api/patients/register:
 *   post:
 *     summary: Register a new patient
 *     tags: [Patients]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, mobile, gender, dob, password]
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: "Arun Kumar"
 *               mobile:
 *                 type: string
 *                 example: "9876543210"
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *               dob:
 *                 type: string
 *                 format: date
 *                 example: "1995-08-12"
 *               blood_group:
 *                 type: string
 *                 example: "O+"
 *               address:
 *                 type: string
 *                 example: "Chennai, Tamil Nadu"
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       201:
 *         description: Patient registered with auto-generated Patient ID
 *       409:
 *         description: Mobile already registered
 */
router.post(
  '/register',
  [
    body('full_name').notEmpty().withMessage('Full name is required').trim(),
    body('mobile').notEmpty().isMobilePhone('en-IN').withMessage('Valid Indian mobile number required'),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
    body('dob').isDate().withMessage('Valid date of birth required (YYYY-MM-DD)'),
    body('blood_group')
      .optional()
      .isIn(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'])
      .withMessage('Invalid blood group'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  registerPatient
);

/**
 * @swagger
 * /api/patients:
 *   get:
 *     summary: List all patients (paginated)
 *     tags: [Patients]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated patient list
 */
router.get('/', authMiddleware, listPatients);

/**
 * @swagger
 * /api/patients/{id}:
 *   get:
 *     summary: Get patient profile by Patient ID
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: SAMH-20458
 *     responses:
 *       200:
 *         description: Patient profile with wellness data
 *       404:
 *         description: Patient not found
 */
router.get('/:id', authMiddleware, getPatientProfile);

/**
 * @swagger
 * /api/patients/{id}:
 *   put:
 *     summary: Update patient profile
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               address:
 *                 type: string
 *               bp:
 *                 type: string
 *                 example: "140/90"
 *               sugar:
 *                 type: string
 *                 example: "168"
 *               sleep:
 *                 type: number
 *                 example: 7
 *               stress:
 *                 type: number
 *                 example: 62
 *               allergies:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put(
  '/:id',
  authMiddleware,
  [
    body('blood_group')
      .optional()
      .isIn(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'])
      .withMessage('Invalid blood group'),
    body('sleep').optional().isNumeric().withMessage('Sleep must be a number'),
    body('stress').optional().isNumeric().withMessage('Stress must be a number'),
  ],
  validate,
  updatePatientProfile
);

module.exports = router;
