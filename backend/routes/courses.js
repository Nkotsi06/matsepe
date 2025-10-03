// backend/routes/courses.js

const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ GET all courses with optional faculty filtering ------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching courses for user:', req.user);

    let query = `
      SELECT c.*, u.username AS lecturer_name 
      FROM courses c 
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'Lecturer') {
      paramCount++;
      query += ` AND c.lecturer_id = $${paramCount}`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      paramCount++;
      query += ` AND c.faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    query += ' ORDER BY c.name ASC';
    
    console.log('Executing query:', query, 'with params:', params);
    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Courses fetch error:', err);
    res.status(500).json({ error: 'Server error fetching courses' });
  }
});

// ------------------ GET single course by ID ------------------
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, u.username AS lecturer_name 
       FROM courses c 
       LEFT JOIN users u ON c.lecturer_id = u.id 
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Course fetch error:', err);
    res.status(500).json({ error: 'Server error fetching course' });
  }
});

// ------------------ POST create course (Program Leader only) ------------------
router.post('/', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { name, code, lecturer_id, description, credits, faculty_name, department } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Course name and code are required' });
    }

    const result = await pool.query(
      `INSERT INTO courses (name, code, lecturer_id, description, credits, faculty_name, department, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [name, code, lecturer_id, description, credits, faculty_name, department, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Course creation error:', err);

    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Course code already exists' });
    }

    res.status(500).json({ error: 'Server error creating course' });
  }
});

// ------------------ PUT update course (Program Leader only) ------------------
router.put('/:id', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, lecturer_id, description, credits, faculty_name, department } = req.body;

    // Check if course exists
    const courseCheck = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const result = await pool.query(
      `UPDATE courses 
       SET name = $1, code = $2, lecturer_id = $3, description = $4, credits = $5, 
           faculty_name = $6, department = $7, updated_at = NOW() 
       WHERE id = $8 
       RETURNING *`,
      [name, code, lecturer_id, description, credits, faculty_name, department, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Course update error:', err);
    res.status(500).json({ error: 'Server error updating course' });
  }
});

// ------------------ DELETE course (Program Leader only) ------------------
router.delete('/:id', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course exists
    const courseCheck = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    await pool.query('DELETE FROM courses WHERE id = $1', [id]);
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    console.error('Course deletion error:', err);
    res.status(500).json({ error: 'Server error deleting course' });
  }
});

module.exports = router;
