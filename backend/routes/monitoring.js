const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET monitoring data
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT m.*, 
             c.name AS course_name, 
             c.code AS course_code, 
             u.username AS lecturer_name, 
             c.faculty_name
      FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      JOIN users u ON c.lecturer_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    const role = (req.user.role || '').toLowerCase();

    if (role === 'lecturer') {
      paramCount++;
      query += ` AND c.lecturer_id = $${paramCount}`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      paramCount++;
      query += ` AND c.faculty_name = $${paramCount}`;
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
 * POST create monitoring entry
 */
router.post(
  '/',
  authenticateToken,
  checkRole(['Lecturer', 'PRL', 'Program Leader']),
  async (req, res) => {
    try {
      const { course_id, attendance = 0, engagement = 0, progress = 0, performance = 0 } = req.body;

      if (!course_id) return res.status(400).json({ error: 'Course ID is required' });

      // Validate percentages
      const validatePercent = (val, field) => {
        if (val < 0 || val > 100) throw new Error(`${field} must be between 0 and 100`);
      };

      try {
        validatePercent(attendance, 'Attendance');
        validatePercent(engagement, 'Engagement');
        validatePercent(progress, 'Progress');
        validatePercent(performance, 'Performance');
      } catch (validationErr) {
        return res.status(400).json({ error: validationErr.message });
      }

      // Course ownership check
      const role = (req.user.role || '').toLowerCase();
      let courseCheckQuery = 'SELECT id, name FROM courses WHERE id = $1';
      const courseCheckParams = [course_id];

      if (role === 'lecturer') {
        courseCheckQuery += ' AND lecturer_id = $2';
        courseCheckParams.push(req.user.id);
      } else if (['prl', 'program leader'].includes(role)) {
        courseCheckQuery += ' AND faculty_name = $2';
        courseCheckParams.push(req.user.faculty_name);
      }

      const courseCheck = await pool.query(courseCheckQuery, courseCheckParams);
      if (courseCheck.rows.length === 0)
        return res.status(403).json({ error: 'Course not found or access denied' });

      // Insert monitoring entry
      const result = await pool.query(
        `INSERT INTO monitoring (course_id, attendance, engagement, progress, performance, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [course_id, attendance, engagement, progress, performance, req.user.id]
      );

      const inserted = { ...result.rows[0], course_name: courseCheck.rows[0].name || '' };
      res.status(201).json(inserted);
    } catch (err) {
      console.error('Monitoring creation error:', err);
      res.status(500).json({ error: 'Server error creating monitoring entry' });
    }
  }
);

/**
 * GET public monitoring stats
 */
router.get('/public-stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT course_id) AS monitored_courses,
        ROUND(AVG(attendance), 1) AS avg_attendance,
        ROUND(AVG(engagement), 1) AS avg_engagement,
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
      avg_engagement: 0,
      avg_progress: 0,
      avg_performance: 0,
    });
  }
});

module.exports = router;
