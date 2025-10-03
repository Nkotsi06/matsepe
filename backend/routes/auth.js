const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const dotenv = require('dotenv');

dotenv.config();
const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'secret';

// Enhanced Role normalization
const roleMap = {
  'student': 'Student',
  'st': 'Student',
  'lecturer': 'Lecturer',
  'lecture': 'Lecturer',
  'teacher': 'Lecturer',
  'principal lecturer': 'PRL',
  'principal': 'PRL',
  'prl': 'PRL',
  'principal lect': 'PRL',
  'program leader': 'Program Leader',
  'programleader': 'Program Leader',
  'pl': 'Program Leader',
  'leader': 'Program Leader',
  'program lead': 'Program Leader'
};

function normalizeRole(role) {
  if (!role) return null;
  const normalized = roleMap[role.toLowerCase().trim()] || role;
  console.log('Role normalization:', { input: role, output: normalized });
  return normalized;
}

// Hardcoded faculties
const FACULTIES = [
  'Faculty of Information and Communication Technology',
  'Faculty of Business Management and Globalisation', 
  'Faculty of Design and Innovation'
];

// ------------------ LOGIN ------------------ //
router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);

    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      console.log('Missing fields:', { username: !!username, password: !!password, role: !!role });
      return res.status(400).json({ error: 'Missing username, password, or role' });
    }

    const normalizedRole = normalizeRole(role);
    console.log('Normalized role:', normalizedRole);

    // First, find the user by username only
    const userQuery = `
      SELECT * FROM Users 
      WHERE username = $1
    `;
    console.log('Querying user by username:', username);
    const userResult = await pool.query(userQuery, [username]);

    if (userResult.rows.length === 0) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    console.log('User found:', { 
      username: user.username, 
      dbRole: user.role,
      inputRole: normalizedRole 
    });

    // Check if the normalized role matches the database role
    if (user.role !== normalizedRole) {
      console.log('Role mismatch:', { 
        dbRole: user.role, 
        inputRole: normalizedRole,
        normalizedInput: normalizedRole 
      });
      return res.status(401).json({ 
        error: `Role selection error. Your account is registered as ${user.role}. Please select "${user.role}" from the dropdown.` 
      });
    }

    console.log('Comparing passwords...');
    const validPass = await bcrypt.compare(password, user.password);
    
    if (!validPass) {
      console.log('Password mismatch for user:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Password verified for user:', username);

    const token = jwt.sign(
      { 
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          faculty_name: user.faculty_name
        }
      },
      SECRET,
      { expiresIn: '8h' }
    );

    // Response structure that matches frontend expectations
    const response = {
      id: user.id,
      username: user.username,
      role: user.role,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        faculty_name: user.faculty_name
      }
    };

    console.log('Login successful for user:', user.username, 'with role:', user.role);
    res.json(response);

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ------------------ REGISTER ------------------ //
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);

    const { username, password, email, role, faculty_name } = req.body;

    if (!username || !password || !email || !role) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedRole = normalizeRole(role);
    console.log('Normalized role:', normalizedRole);

    // Use ENUM-compatible roles
    const validRoles = ['Student', 'Lecturer', 'PRL', 'Program Leader'];
    if (!validRoles.includes(normalizedRole)) {
      console.log('Invalid role:', normalizedRole);
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Validate faculty
    if (faculty_name && !FACULTIES.includes(faculty_name)) {
      return res.status(400).json({ error: 'Invalid faculty selection' });
    }

    // Check if username exists
    const existingUser = await pool.query(
      'SELECT id FROM Users WHERE username = $1', 
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('Username already exists:', username);
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if email exists
    const existingEmail = await pool.query(
      'SELECT id FROM Users WHERE email = $1', 
      [email]
    );
    
    if (existingEmail.rows.length > 0) {
      console.log('Email already exists:', email);
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPass = await bcrypt.hash(password, 10);

    // Insert new user
    const newUser = await pool.query(
      `INSERT INTO Users (username, password, email, role, faculty_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role, faculty_name`,
      [username, hashedPass, email, normalizedRole, faculty_name || '']
    );

    const user = newUser.rows[0];
    console.log('User registered successfully:', user.username);

    // Auto-enroll if Student
    if (normalizedRole === 'Student' && faculty_name) {
      try {
        const courses = await pool.query(
          'SELECT id FROM courses WHERE faculty_name = $1',
          [faculty_name]
        );
        
        console.log('Auto-enrolling student in', courses.rows.length, 'courses');
        
        for (const course of courses.rows) {
          await pool.query(
            'INSERT INTO enrollment (student_id, course_id) VALUES ($1, $2)',
            [user.id, course.id]
          );
        }
      } catch (enrollError) {
        console.error('Auto-enrollment error (non-critical):', enrollError.message);
        // Continue even if enrollment fails
      }
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        user: {
          id: user.id,
          role: user.role,
          faculty_name: user.faculty_name
        }
      },
      SECRET,
      { expiresIn: '8h' }
    );

    const response = {
      id: user.id,
      username: user.username,
      role: user.role,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        faculty_name: user.faculty_name
      }
    };

    console.log('Registration successful for:', user.username);
    res.status(201).json(response);

  } catch (err) {
    console.error('Registration error:', err);
    
    if (err.code === '23505') {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Server error during registration' });
    }
  }
});

// ------------------ GET FACULTIES ------------------ //
router.get('/faculties', (req, res) => {
  res.json(FACULTIES);
});

// ------------------ VERIFY TOKEN ------------------ //
router.get('/verify', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, SECRET);
    
    // Get fresh user data
    const userResult = await pool.query(
      'SELECT id, username, email, role, faculty_name FROM Users WHERE id = $1',
      [decoded.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      faculty_name: user.faculty_name
    });

  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ------------------ GET USER PROFILE ------------------ //
router.get('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const userResult = await pool.query(
      'SELECT id, username, email, role, faculty_name, created_at FROM Users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    res.json(user);

  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;