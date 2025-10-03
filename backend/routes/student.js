// backend/routes/student.js

const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ Fetch enrolled courses for a student ------------------
router.get('/courses', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username AS lecturer_name
       FROM courses c
       JOIN enrollment e ON c.id = e.course_id
       LEFT JOIN users u ON c.lecturer_id = u.id
       WHERE e.student_id = $1
       ORDER BY c.name ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Student courses error:', err);
    res.status(500).json({ error: 'Server error fetching student courses' });
  }
});

// ------------------ Fetch public statistics ------------------
router.get('/public-statistics', async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(DISTINCT id) FROM users WHERE role = 'Student') AS active_students,
        (SELECT COUNT(DISTINCT id) FROM courses) AS courses,
        (SELECT COUNT(DISTINCT id) FROM reports WHERE created_at >= NOW() - INTERVAL '1 month') AS monthly_reports,
        '24/7' AS access_status`
    );
    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Public statistics error:', err);
    res.status(500).json({ 
      active_students: 0,
      courses: 0,
      monthly_reports: 0,
      access_status: '24/7'
    });
  }
});

// ------------------ Fetch student reports ------------------
router.get('/reports', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name AS course_name, c.code AS course_code
       FROM reports r
       JOIN courses c ON r.course_id = c.id
       JOIN enrollment e ON r.course_id = e.course_id
       WHERE e.student_id = $1 AND r.status = 'approved'
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Student reports error:', err);
    res.status(500).json({ error: 'Server error fetching student reports' });
  }
});

// ------------------ Fetch student-specific statistics ------------------
router.get('/statistics', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(DISTINCT e.course_id) 
         FROM enrollment e 
         WHERE e.student_id = $1) AS courses,
        (SELECT COUNT(DISTINCT r.id) 
         FROM reports r 
         JOIN enrollment e ON r.course_id = e.course_id 
         WHERE e.student_id = $1 AND r.created_at >= NOW() - INTERVAL '1 month') AS monthly_reports,
        '24/7' AS access_status`,
      [req.user.id]
    );

    res.json({
      activeStudents: 1, // Assuming the student is active
      courses: stats.rows[0].courses,
      monthlyReports: stats.rows[0].monthly_reports,
      accessStatus: stats.rows[0].access_status
    });
  } catch (err) {
    console.error('Student statistics error:', err);
    res.status(500).json({ error: 'Server error fetching student statistics' });
  }
});

// ------------------ Submit a new report (Student) ------------------
router.post('/reports', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { course_id, report_type, title, description, date } = req.body;

    if (!course_id || !report_type || !title || !description || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate date format (ISO string or YYYY-MM-DD)
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Verify student enrollment
    const enrollmentCheck = await pool.query(
      `SELECT 1 FROM enrollment 
       WHERE student_id = $1 AND course_id = $2`,
      [req.user.id, course_id]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const result = await pool.query(
      `INSERT INTO student_reports (course_id, student_id, report_type, title, description, date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [course_id, req.user.id, report_type, title, description, date]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Student report submission error:', err);
    res.status(500).json({ error: 'Server error submitting student report' });
  }
});

module.exports = router;
