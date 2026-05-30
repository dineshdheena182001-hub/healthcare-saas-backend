const express = require('express');
const router = express.Router();
const { addWellnessLog, getWellnessHistory } = require('../controllers/wellnessController');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Wellness
 *   description: Patient wellness tracking
 */

/**
 * @swagger
 * /api/wellness/log:
 *   post:
 *     summary: Log wellness vitals
 *     tags: [Wellness]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
 *                 example: ["Penicillin", "Dust"]
 *     responses:
 *       200:
 *         description: Wellness data updated
 */
router.post('/log', authMiddleware, addWellnessLog);

/**
 * @swagger
 * /api/wellness/history/{patient_id}:
 *   get:
 *     summary: Get wellness history for trend analysis
 *     tags: [Wellness]
 *     parameters:
 *       - in: path
 *         name: patient_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Wellness history entries
 */
router.get('/history/:patient_id', authMiddleware, getWellnessHistory);

module.exports = router;
