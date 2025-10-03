// backend/routes/principal.js

const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET monitoring data (role-based filtering)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT m.*, c.name AS course_name, c.code AS course_code, 
             u.username AS lecturer_name, c.faculty_name
      FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      JOIN users u ON c.lecturer_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'Lecturer') {
      query += ` AND c.lecturer_id = $1`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $1`;
      params.push(req.user.faculty_name);
    }

    query += ' ORDER BY m.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Monitoring fetch error:', err);
    res.status(500).json({ error: 'Server error fetching monitoring data' });
  }
});

/**
 * POST create monitoring entry (Lecturer / PRL / Program Leader)
 */
router.post(
  '/',
  authenticateToken,
  checkRole(['Lecturer', 'PRL', 'Program Leader']),
  async (req, res) => {
    try {
      const { course_id, attendance, progress, performance, notes } = req.body;

      if (!course_id) {
        return res.status(400).json({ error: 'Course ID is required' });
      }

      // Verify course access
      let query = 'SELECT id FROM courses WHERE id = $1';
      const params = [course_id];

      if (req.user.role === 'Lecturer') {
        query += ' AND lecturer_id = $2';
        params.push(req.user.id);
      } else if (['PRL', 'Program Leader'].includes(req.user.role)) {
        query += ' AND faculty_name = $2';
        params.push(req.user.faculty_name);
      }

      const courseCheck = await pool.query(query, params);
      if (courseCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Course not found or access denied' });
      }

      const result = await pool.query(
        `INSERT INTO monitoring 
         (course_id, attendance, progress, performance, notes, created_by, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING *`,
        [course_id, attendance, progress, performance, notes, req.user.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Monitoring creation error:', err);
      res.status(500).json({ error: 'Server error creating monitoring entry' });
    }
  }
);

/**
 * GET public monitoring stats (last 30 days)
 */
router.get('/public-stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT course_id) AS monitored_courses,
        ROUND(AVG(attendance), 1) AS avg_attendance,
        ROUND(AVG(progress), 1) AS avg_progress,
        ROUND(AVG(performance), 1) AS avg_performance
      FROM monitoring
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Public monitoring stats error:', err);
    res.status(500).json({
      monitored_courses: 0,
      avg_attendance: 0,
      avg_progress: 0,
      avg_performance: 0
    });
  }
});

module.exports = router;
