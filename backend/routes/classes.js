// backend/routes/classes.js

const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ GET all classes with role-based filtering ------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT c.*, co.name AS course_name, co.code AS course_code, 
             u.username AS lecturer_name, co.faculty_name
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON c.lecturer_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'Lecturer') {
      paramCount++;
      query += ` AND c.lecturer_id = $${paramCount}`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      paramCount++;
      query += ` AND co.faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    query += ' ORDER BY c.date, c.time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Classes fetch error:', err);
    res.status(500).json({ error: 'Server error fetching classes' });
  }
});

// ------------------ POST create class (Program Leader/PRL only) ------------------
router.post('/', authenticateToken, checkRole(['Program Leader', 'PRL']), async (req, res) => {
  try {
    const { course_id, lecturer_id, date, time, room, topic } = req.body;

    if (!course_id || !lecturer_id || !date || !time || !room) {
      return res.status(400).json({ error: 'Required fields: course_id, lecturer_id, date, time, room' });
    }

    // Verify course belongs to faculty
    const courseCheck = await pool.query(
      'SELECT id FROM courses WHERE id = $1 AND faculty_name = $2',
      [course_id, req.user.faculty_name]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Course not found in your faculty' });
    }

    const result = await pool.query(
      `INSERT INTO classes (course_id, lecturer_id, date, time, room, topic, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [course_id, lecturer_id, date, time, room, topic, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Class creation error:', err);
    res.status(500).json({ error: 'Server error creating class' });
  }
});

// ------------------ PUT update class ------------------
router.put('/:id', authenticateToken, checkRole(['Program Leader', 'PRL']), async (req, res) => {
  try {
    const { id } = req.params;
    const { course_id, lecturer_id, date, time, room, topic } = req.body;

    // Check if class exists and belongs to faculty
    const classCheck = await pool.query(
      `SELECT c.* FROM classes c
       JOIN courses co ON c.course_id = co.id
       WHERE c.id = $1 AND co.faculty_name = $2`,
      [id, req.user.faculty_name]
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const result = await pool.query(
      `UPDATE classes 
       SET course_id = $1, lecturer_id = $2, date = $3, time = $4, room = $5, topic = $6, updated_at = NOW() 
       WHERE id = $7 
       RETURNING *`,
      [course_id, lecturer_id, date, time, room, topic, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Class update error:', err);
    res.status(500).json({ error: 'Server error updating class' });
  }
});

// ------------------ DELETE class ------------------
router.delete('/:id', authenticateToken, checkRole(['Program Leader', 'PRL']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if class exists and belongs to faculty
    const classCheck = await pool.query(
      `SELECT c.* FROM classes c
       JOIN courses co ON c.course_id = co.id
       WHERE c.id = $1 AND co.faculty_name = $2`,
      [id, req.user.faculty_name]
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    await pool.query('DELETE FROM classes WHERE id = $1', [id]);
    res.json({ message: 'Class deleted successfully' });
  } catch (err) {
    console.error('Class deletion error:', err);
    res.status(500).json({ error: 'Server error deleting class' });
  }
});

module.exports = router;
