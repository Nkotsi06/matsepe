const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// GET all ratings (with role-based filtering)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT r.*, c.name as course_name, c.code as course_code, 
             u.username as student_name, l.username as lecturer_name
      FROM ratings r
      JOIN courses c ON r.course_id = c.id
      JOIN users u ON r.user_id = u.id
      JOIN users l ON c.lecturer_id = l.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    const role = (req.user.role || '').toLowerCase();

    if (role === 'student') {
      paramCount++;
      query += ` AND r.user_id = $${paramCount}`;
      params.push(req.user.id);
    } else if (role === 'lecturer') {
      paramCount++;
      query += ` AND c.lecturer_id = $${paramCount}`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      paramCount++;
      query += ` AND c.faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Ratings fetch error:', err);
    res.status(500).json({ error: 'Server error fetching ratings' });
  }
});

// GET self ratings (Student only)
router.get('/self', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name as course_name, c.code as course_code
       FROM ratings r
       JOIN courses c ON r.course_id = c.id
       WHERE r.user_id = $1 AND r.rating_type = 'self'
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Self ratings fetch error:', err);
    res.status(500).json({ error: 'Server error fetching self ratings' });
  }
});

// GET course ratings (Student only)
router.get('/course', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name as course_name, c.code as course_code
       FROM ratings r
       JOIN courses c ON r.course_id = c.id
       WHERE r.user_id = $1 AND r.rating_type = 'course'
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Course ratings fetch error:', err);
    res.status(500).json({ error: 'Server error fetching course ratings' });
  }
});

// POST submit rating (Student only)
router.post('/', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { course_id, rating, comment = '', rating_type = 'course' } = req.body;

    if (!course_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid course ID and rating (1-5) required' });
    }

    // Verify enrollment
    const enrollmentCheck = await pool.query(
      'SELECT 1 FROM enrollment WHERE student_id = $1 AND course_id = $2',
      [req.user.id, course_id]
    );
    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Prevent duplicate ratings
    const existing = await pool.query(
      'SELECT id FROM ratings WHERE user_id = $1 AND course_id = $2 AND rating_type = $3',
      [req.user.id, course_id, rating_type]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already rated this course' });
    }

    const result = await pool.query(
      `INSERT INTO ratings (course_id, user_id, rating, comment, rating_type, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [course_id, req.user.id, rating, comment, rating_type]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Rating submission error:', err);
    res.status(500).json({ error: 'Server error submitting rating' });
  }
});

// POST submit self-rating (Student only)
router.post('/self', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { course_id, rating, comment = '' } = req.body;

    if (!course_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid course ID and rating (1-5) required' });
    }

    // Verify enrollment
    const enrollmentCheck = await pool.query(
      'SELECT 1 FROM enrollment WHERE student_id = $1 AND course_id = $2',
      [req.user.id, course_id]
    );
    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Prevent duplicate self-rating
    const existing = await pool.query(
      'SELECT id FROM ratings WHERE user_id = $1 AND course_id = $2 AND rating_type = $3',
      [req.user.id, course_id, 'self']
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already submitted a self-rating for this course' });
    }

    const result = await pool.query(
      `INSERT INTO ratings (course_id, user_id, rating, comment, rating_type, created_at) 
       VALUES ($1, $2, $3, $4, 'self', NOW()) RETURNING *`,
      [course_id, req.user.id, rating, comment]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Self-rating submission error:', err);
    res.status(500).json({ error: 'Server error submitting self-rating' });
  }
});

// GET aggregated ratings (Lecturer/PRL/Program Leader)
router.get('/aggregated', authenticateToken, checkRole(['Lecturer', 'PRL', 'Program Leader']), async (req, res) => {
  try {
    let query = `
      SELECT 
        c.id as course_id,
        c.name as course_name,
        c.code as course_code,
        COALESCE(ROUND(AVG(r.rating),2),0) as average_rating,
        COUNT(r.id) as total_ratings,
        u.username as lecturer_name
      FROM courses c
      LEFT JOIN ratings r ON c.id = r.course_id
      LEFT JOIN users u ON c.lecturer_id = u.id
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

    query += ' GROUP BY c.id, c.name, c.code, u.username ORDER BY average_rating DESC NULLS LAST';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Aggregated ratings error:', err);
    res.status(500).json({ error: 'Server error fetching aggregated ratings' });
  }
});

// GET courses list for dropdown
router.get('/courses/list', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT id, name, code FROM courses WHERE 1=1';
    const params = [];
    let paramCount = 0;

    const role = (req.user.role || '').toLowerCase();

    if (role === 'student') {
      // Only enrolled courses
      query = `
        SELECT c.id, c.name, c.code 
        FROM courses c
        JOIN enrollment e ON c.id = e.course_id
        WHERE e.student_id = $1
        ORDER BY c.name ASC
      `;
      params.push(req.user.id);
    } else if (role === 'lecturer') {
      paramCount++;
      query += ` AND lecturer_id = $${paramCount} ORDER BY name ASC`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      paramCount++;
      query += ` AND faculty_name = $${paramCount} ORDER BY name ASC`;
      params.push(req.user.faculty_name);
    } else {
      query += ' ORDER BY name ASC';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch courses error:', err);
    res.status(500).json({ error: 'Server error fetching courses' });
  }
});

module.exports = router;
