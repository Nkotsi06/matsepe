// backend/routes/reports.js

const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET all reports with role-based filtering
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT r.*, c.name as course_name, c.code as course_code, 
             u.username as lecturer_name, c.faculty_name
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      JOIN users u ON r.lecturer_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'Lecturer') {
      query += ` AND r.lecturer_id = $1`;
      params.push(req.user.id);
    } else if (req.user.role === 'Student') {
      query += ` AND r.status = $1`;
      params.push('approved');
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $1`;
      params.push(req.user.faculty_name);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Reports fetch error:', err);
    res.status(500).json({ error: 'Server error fetching reports' });
  }
});

/**
 * GET single report by ID with role-based filtering
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    let query = `
      SELECT r.*, c.name as course_name, c.code as course_code, 
             u.username as lecturer_name, c.faculty_name
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      JOIN users u ON r.lecturer_id = u.id
      WHERE r.id = $1
    `;
    const params = [id];

    if (req.user.role === 'Lecturer') {
      query += ` AND r.lecturer_id = $2`;
      params.push(req.user.id);
    } else if (req.user.role === 'Student') {
      query += ` AND r.status = $2`;
      params.push('approved');
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $2`;
      params.push(req.user.faculty_name);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Report fetch error:', err);
    res.status(500).json({ error: 'Server error fetching report' });
  }
});

/**
 * POST create report (Lecturer only)
 */
router.post('/', authenticateToken, checkRole(['Lecturer']), async (req, res) => {
  try {
    const {
      course_id, week, topic, outcomes, recommendations, 
      actual_students, total_students, date, venue, scheduled_time
    } = req.body;

    if (!course_id || !week || !topic || !date) {
      return res.status(400).json({ error: 'Required fields: course_id, week, topic, date' });
    }

    // Ensure lecturer is assigned to the course
    const courseCheck = await pool.query(
      'SELECT id FROM courses WHERE id = $1 AND lecturer_id = $2',
      [course_id, req.user.id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this course' });
    }

    const result = await pool.query(
      `INSERT INTO reports (
        course_id, lecturer_id, week, topic, outcomes, recommendations,
        actual_students, total_students, date, venue, scheduled_time, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) 
       RETURNING *`,
      [
        course_id, req.user.id, week, topic, outcomes, recommendations,
        actual_students, total_students, date, venue, scheduled_time, 'pending'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Report creation error:', err);
    res.status(500).json({ error: 'Server error creating report' });
  }
});

/**
 * PUT update report status (PRL / Program Leader only)
 */
router.put('/:id', authenticateToken, checkRole(['PRL', 'Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Ensure report belongs to same faculty
    const reportCheck = await pool.query(
      `SELECT r.* FROM reports r
       JOIN courses c ON r.course_id = c.id
       WHERE r.id = $1 AND c.faculty_name = $2`,
      [id, req.user.faculty_name]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    const result = await pool.query(
      `UPDATE reports 
       SET status = $1, feedback = $2, reviewed_by = $3, reviewed_at = NOW() 
       WHERE id = $4 
       RETURNING *`,
      [status, feedback, req.user.id, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Report update error:', err);
    res.status(500).json({ error: 'Server error updating report' });
  }
});

/**
 * DELETE report (Lecturer or PRL/Program Leader only)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let result;

    if (req.user.role === 'Lecturer') {
      result = await pool.query(
        'DELETE FROM reports WHERE id = $1 AND lecturer_id = $2',
        [id, req.user.id]
      );
    } else if (['PRL', 'Program Leader'].includes(req.user.role)) {
      result = await pool.query(
        `DELETE FROM reports 
         WHERE id = $1 AND course_id IN (
           SELECT id FROM courses WHERE faculty_name = $2
         )`,
        [id, req.user.faculty_name]
      );
    } else {
      return res.status(403).json({ error: 'Not authorized to delete reports' });
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    console.error('Report deletion error:', err);
    res.status(500).json({ error: 'Server error deleting report' });
  }
});

/**
 * GET public statistics
 */
router.get('/public-stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM reports) as total_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'approved') as approved_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
        (SELECT COUNT(DISTINCT lecturer_id) FROM reports) as active_lecturers,
        (SELECT COUNT(*) FROM courses) as total_courses
    `);

    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Public stats error:', err);
    res.status(500).json({
      total_reports: 0,
      approved_reports: 0,
      pending_reports: 0,
      active_lecturers: 0,
      total_courses: 0
    });
  }
});

module.exports = router;
