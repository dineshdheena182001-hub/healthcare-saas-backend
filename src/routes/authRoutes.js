const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { sendOTP, verifyOTPController, loginWithPatientId, logout } = require('../controllers/authController');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: OTP and Patient ID based login
 */

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP to mobile number
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile]
 *             properties:
 *               mobile:
 *                 type: string
 *                 example: "9876543210"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       422:
 *         description: Validation error
 */
router.post(
  '/send-otp',
  [
    body('mobile')
      .notEmpty().withMessage('Mobile number is required')
      .isMobilePhone('en-IN').withMessage('Invalid Indian mobile number'),
  ],
  validate,
  sendOTP
);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and get JWT token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile, otp]
 *             properties:
 *               mobile:
 *                 type: string
 *                 example: "9876543210"
 *               otp:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: JWT token returned
 *       400:
 *         description: Invalid or expired OTP
 */
router.post(
  '/verify-otp',
  [
    body('mobile').notEmpty().withMessage('Mobile is required').isMobilePhone('en-IN'),
    body('otp').notEmpty().withMessage('OTP is required').isLength({ min: 4, max: 6 }),
  ],
  validate,
  verifyOTPController
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login using Patient ID and password
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patient_id, password]
 *             properties:
 *               patient_id:
 *                 type: string
 *                 example: "SAMH-20458"
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login successful with JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  [
    body('patient_id').notEmpty().withMessage('Patient ID is required'),
    body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }),
  ],
  validate,
  loginWithPatientId
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout current session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authMiddleware, logout);

module.exports = router;
