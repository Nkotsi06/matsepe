const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const dotenv = require('dotenv');
const { authenticateToken, checkRole } = require('../middleware/auth');

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

// Hardcoded faculties and departments
const FACULTIES = [
  'Faculty of Information and Communication Technology',
  'Faculty of Business Management and Globalisation', 
  'Faculty of Design and Innovation'
];

const DEPARTMENTS = {
  'Faculty of Information and Communication Technology': [
    'Software Engineering',
    'Data Science',
    'Cybersecurity',
    'Network Engineering',
    'Artificial Intelligence'
  ],
  'Faculty of Business Management and Globalisation': [
    'Business Administration',
    'International Business',
    'Marketing',
    'Finance',
    'Human Resources'
  ],
  'Faculty of Design and Innovation': [
    'Graphic Design',
    'Industrial Design',
    'Digital Media',
    'Fashion Design',
    'Interior Design'
  ]
};

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

    // Update last login timestamp
    await pool.query(
      'UPDATE Users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    const token = jwt.sign(
      { 
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          faculty_name: user.faculty_name,
          department: user.department
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
        faculty_name: user.faculty_name,
        department: user.department,
        phone: user.phone,
        student_id: user.student_id,
        last_login: user.last_login
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
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('Registration request received:', req.body);

    const { 
      username, 
      password, 
      email, 
      role, 
      faculty_name, 
      department,
      phone,
      student_id,
      first_name,
      last_name
    } = req.body;

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

    // Validate department if faculty is provided
    if (faculty_name && department) {
      const validDepartments = DEPARTMENTS[faculty_name] || [];
      if (!validDepartments.includes(department)) {
        return res.status(400).json({ error: 'Invalid department for selected faculty' });
      }
    }

    // Check if username exists
    const existingUser = await client.query(
      'SELECT id FROM Users WHERE username = $1', 
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('Username already exists:', username);
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if email exists
    const existingEmail = await client.query(
      'SELECT id FROM Users WHERE email = $1', 
      [email]
    );
    
    if (existingEmail.rows.length > 0) {
      console.log('Email already exists:', email);
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Check if student_id exists (for students)
    if (normalizedRole === 'Student' && student_id) {
      const existingStudentId = await client.query(
        'SELECT id FROM Users WHERE student_id = $1', 
        [student_id]
      );
      
      if (existingStudentId.rows.length > 0) {
        console.log('Student ID already exists:', student_id);
        return res.status(400).json({ error: 'Student ID already exists' });
      }
    }

    // Hash password
    const hashedPass = await bcrypt.hash(password, 10);

    // Insert new user
    const newUser = await client.query(
      `INSERT INTO Users (
        username, password, email, role, faculty_name, department,
        phone, student_id, first_name, last_name, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Active')
      RETURNING id, username, email, role, faculty_name, department, phone, student_id, first_name, last_name, created_at`,
      [
        username, hashedPass, email, normalizedRole, faculty_name || null, 
        department || null, phone || null, student_id || null, 
        first_name || null, last_name || null
      ]
    );

    const user = newUser.rows[0];
    console.log('User registered successfully:', user.username);

    // Auto-enroll if Student
    if (normalizedRole === 'Student' && faculty_name) {
      try {
        const courses = await client.query(
          'SELECT id FROM courses WHERE faculty_name = $1 AND status = $2',
          [faculty_name, 'Active']
        );
        
        console.log('Auto-enrolling student in', courses.rows.length, 'courses');
        
        for (const course of courses.rows) {
          await client.query(
            `INSERT INTO student_courses (student_id, course_id, enrollment_date, status) 
             VALUES ($1, $2, NOW(), 'Enrolled')`,
            [user.id, course.id]
          );
        }

        // Log enrollment activity
        await client.query(
          `INSERT INTO user_activities (user_id, activity_type, description) 
           VALUES ($1, $2, $3)`,
          [
            user.id,
            'auto_enrollment',
            `Automatically enrolled in ${courses.rows.length} courses in ${faculty_name}`
          ]
        );
      } catch (enrollError) {
        console.error('Auto-enrollment error (non-critical):', enrollError.message);
        // Continue even if enrollment fails
      }
    }

    // Log registration activity
    await client.query(
      `INSERT INTO user_activities (user_id, activity_type, description) 
       VALUES ($1, $2, $3)`,
      [user.id, 'registration', 'User account created successfully']
    );

    // Create JWT token
    const token = jwt.sign(
      { 
        user: {
          id: user.id,
          role: user.role,
          faculty_name: user.faculty_name,
          department: user.department
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
        faculty_name: user.faculty_name,
        department: user.department,
        phone: user.phone,
        student_id: user.student_id,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at
      }
    };

    await client.query('COMMIT');
    console.log('Registration successful for:', user.username);
    res.status(201).json(response);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    
    if (err.code === '23505') {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Server error during registration' });
    }
  } finally {
    client.release();
  }
});

// ------------------ GET FACULTIES ------------------ //
router.get('/faculties', (req, res) => {
  res.json(FACULTIES);
});

// ------------------ GET DEPARTMENTS ------------------ //
router.get('/departments/:faculty', (req, res) => {
  const { faculty } = req.params;
  const departments = DEPARTMENTS[faculty] || [];
  res.json(departments);
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
      `SELECT id, username, email, role, faculty_name, department, phone, 
              student_id, first_name, last_name, status, last_login, created_at 
       FROM Users WHERE id = $1`,
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
      faculty_name: user.faculty_name,
      department: user.department,
      phone: user.phone,
      student_id: user.student_id,
      first_name: user.first_name,
      last_name: user.last_name,
      status: user.status,
      last_login: user.last_login,
      created_at: user.created_at
    });

  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ------------------ GET USER PROFILE ------------------ //
router.get('/profile/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Authorization check - users can only view their own profile unless they're admin roles
    if (req.user.id !== parseInt(id) && !['Program Leader', 'PRL'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userResult = await pool.query(
      `SELECT id, username, email, role, faculty_name, department, phone, 
              student_id, first_name, last_name, status, last_login, created_at 
       FROM Users WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    // Get additional statistics based on role
    let statistics = {};
    if (user.role === 'Student') {
      const statsResult = await pool.query(
        `SELECT 
          COUNT(DISTINCT sc.course_id) AS enrolled_courses,
          COUNT(DISTINCT ca.class_id) AS attended_classes,
          COUNT(DISTINCT a.id) AS submitted_assignments,
          AVG(g.grade) AS average_grade
         FROM Users u
         LEFT JOIN student_courses sc ON u.id = sc.student_id
         LEFT JOIN class_attendance ca ON u.id = ca.student_id AND ca.status = 'Present'
         LEFT JOIN student_submissions ss ON u.id = ss.student_id
         LEFT JOIN assignments a ON ss.assignment_id = a.id
         LEFT JOIN grades g ON ss.id = g.submission_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [id]
      );
      statistics = statsResult.rows[0] || {};
    } else if (user.role === 'Lecturer') {
      const statsResult = await pool.query(
        `SELECT 
          COUNT(DISTINCT c.id) AS teaching_courses,
          COUNT(DISTINCT cl.id) AS scheduled_classes,
          COUNT(DISTINCT a.id) AS created_assignments
         FROM Users u
         LEFT JOIN courses c ON u.id = c.lecturer_id
         LEFT JOIN classes cl ON u.id = cl.lecturer_id
         LEFT JOIN assignments a ON u.id = a.created_by
         WHERE u.id = $1
         GROUP BY u.id`,
        [id]
      );
      statistics = statsResult.rows[0] || {};
    }

    // Get recent activities
    const activitiesResult = await pool.query(
      `SELECT activity_type, description, created_at 
       FROM user_activities 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [id]
    );

    const userProfile = {
      ...user,
      statistics,
      recent_activities: activitiesResult.rows
    };

    res.json(userProfile);

  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------ UPDATE USER PROFILE ------------------ //
router.put('/profile/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone, first_name, last_name, department } = req.body;

    // Users can only update their own profile
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if email already exists (excluding current user)
      if (email) {
        const emailCheck = await client.query(
          'SELECT id FROM Users WHERE email = $1 AND id != $2',
          [email, id]
        );
        
        if (emailCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      const result = await client.query(
        `UPDATE Users 
         SET email = COALESCE($1, email), 
             phone = COALESCE($2, phone),
             first_name = COALESCE($3, first_name),
             last_name = COALESCE($4, last_name),
             department = COALESCE($5, department),
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, username, email, role, faculty_name, department, phone, first_name, last_name`,
        [email, phone, first_name, last_name, department, id]
      );

      // Log profile update activity
      await client.query(
        `INSERT INTO user_activities (user_id, activity_type, description) 
         VALUES ($1, $2, $3)`,
        [id, 'profile_update', 'Profile information updated']
      );

      await client.query('COMMIT');

      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

// ------------------ CHANGE PASSWORD ------------------ //
router.put('/change-password/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Users can only change their own password
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current password hash
      const userResult = await client.query(
        'SELECT password FROM Users WHERE id = $1',
        [id]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Verify current password
      const validCurrentPass = await bcrypt.compare(currentPassword, user.password);
      if (!validCurrentPass) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedNewPass = await bcrypt.hash(newPassword, 10);

      // Update password
      await client.query(
        'UPDATE Users SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedNewPass, id]
      );

      // Log password change activity
      await client.query(
        `INSERT INTO user_activities (user_id, activity_type, description) 
         VALUES ($1, $2, $3)`,
        [id, 'password_change', 'Password changed successfully']
      );

      await client.query('COMMIT');

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Server error changing password' });
  }
});

// ------------------ GET USERS (Admin only) ------------------ //
router.get('/users', authenticateToken, checkRole(['Program Leader', 'PRL']), async (req, res) => {
  try {
    const { role, faculty_name, status, search } = req.query;
    
    let query = `
      SELECT id, username, email, role, faculty_name, department, phone, 
             student_id, first_name, last_name, status, last_login, created_at
      FROM Users 
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Role-based filtering for PRL
    if (req.user.role === 'PRL' && req.user.faculty_name) {
      paramCount++;
      query += ` AND faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    // Additional filters
    if (role) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      params.push(role);
    }

    if (faculty_name) {
      paramCount++;
      query += ` AND faculty_name = $${paramCount}`;
      params.push(faculty_name);
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (search) {
      paramCount++;
      query += ` AND (
        username ILIKE $${paramCount} OR 
        email ILIKE $${paramCount} OR 
        first_name ILIKE $${paramCount} OR 
        last_name ILIKE $${paramCount} OR
        student_id ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Users fetch error:', err);
    res.status(500).json({ error: 'Server error fetching users' });
  }
});

module.exports = router;