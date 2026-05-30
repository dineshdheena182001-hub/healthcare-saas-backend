const express = require('express');
const router = express.Router();
const { getDashboardHome, getWellnessSummary, getNotifications } = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Patient dashboard summary APIs
 */

/**
 * @swagger
 * /api/dashboard/home:
 *   get:
 *     summary: Get patient dashboard summary
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Full dashboard data including wellness, appointment, therapy, notifications
 */
router.get('/home', authMiddleware, getDashboardHome);

/**
 * @swagger
 * /api/dashboard/wellness:
 *   get:
 *     summary: Get wellness summary
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Current wellness vitals
 */
router.get('/wellness', authMiddleware, getWellnessSummary);

/**
 * @swagger
 * /api/dashboard/notifications:
 *   get:
 *     summary: Get patient notifications
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get('/notifications', authMiddleware, getNotifications);

module.exports = router;
