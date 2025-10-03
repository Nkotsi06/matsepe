const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// GET all users with role-based filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT id, username, email, role, faculty_name, created_at FROM users WHERE 1=1';
    let params = [];
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'Lecturer') {
      // Lecturers can only see students in their faculty
      paramCount++;
      query += ` AND role = $${paramCount} AND faculty_name = $${paramCount + 1}`;
      params.push('Student', req.user.faculty_name);
    } else if (req.user.role === 'PRL') {
      // PRLs can see lecturers and students in their faculty
      paramCount++;
      query += ` AND faculty_name = $${paramCount} AND role IN ('Lecturer', 'Student')`;
      params.push(req.user.faculty_name);
    } else if (req.user.role === 'Program Leader') {
      // Program Leaders can see all users in their faculty
      paramCount++;
      query += ` AND faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    query += ' ORDER BY username ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Users fetch error:', err);
    res.status(500).json({ error: 'Server error fetching users' });
  }
});

// GET users by role
router.get('/role/:role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.params;
    
    let query = 'SELECT id, username, email, role, faculty_name FROM users WHERE role = $1';
    let params = [role];
    let paramCount = 1;

    // Role-based filtering
    if (['PRL', 'Program Leader', 'Lecturer'].includes(req.user.role) && req.user.faculty_name) {
      paramCount++;
      query += ` AND faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    query += ' ORDER BY username ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Users by role fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single user
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    let query = 'SELECT id, username, email, role, faculty_name, created_at FROM users WHERE id = $1';
    let params = [id];

    // Role-based access control
    if (['PRL', 'Program Leader', 'Lecturer'].includes(req.user.role) && req.user.faculty_name) {
      query += ' AND faculty_name = $2';
      params.push(req.user.faculty_name);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('User fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create user (Admin/Program Leader only)
router.post('/', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { username, email, role, faculty_name, password = 'default123' } = req.body;

    if (!username || !email || !role) {
      return res.status(400).json({ error: 'Username, email, and role are required' });
    }

    // Validate faculty
    const FACULTIES = [
      'Faculty of Information and Communication Technology',
      'Faculty of Business Management and Globalisation', 
      'Faculty of Design and Innovation'
    ];

    if (faculty_name && !FACULTIES.includes(faculty_name)) {
      return res.status(400).json({ error: 'Invalid faculty selection' });
    }

    // Check if username exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1', 
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if email exists
    const existingEmail = await pool.query(
      'SELECT id FROM users WHERE email = $1', 
      [email]
    );
    
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPass = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, password, email, role, faculty_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role, faculty_name, created_at`,
      [username, hashedPass, email, role, faculty_name || req.user.faculty_name]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('User creation error:', err);
    
    if (err.code === '23505') {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Server error creating user' });
    }
  }
});

// PUT update user
router.put('/:id', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, faculty_name } = req.body;

    // Check if user exists and belongs to faculty
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND faculty_name = $2',
      [id, req.user.faculty_name]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or access denied' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET username = $1, email = $2, role = $3, faculty_name = $4, updated_at = NOW() 
       WHERE id = $5 
       RETURNING id, username, email, role, faculty_name, created_at`,
      [username, email, role, faculty_name, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ error: 'Server error updating user' });
  }
});

// DELETE user
router.delete('/:id', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists and belongs to faculty
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND faculty_name = $2',
      [id, req.user.faculty_name]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or access denied' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('User deletion error:', err);
    res.status(500).json({ error: 'Server error deleting user' });
  }
});

module.exports = router;