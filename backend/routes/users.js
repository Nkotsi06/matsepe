const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Constants for better maintainability
const USER_STATUS = ['Active', 'Inactive', 'Suspended'];
const USER_ROLES = ['Student', 'Lecturer', 'PRL', 'Program Leader'];
const FACULTIES = [
  'Faculty of Information and Communication Technology',
  'Faculty of Business Management and Globalisation', 
  'Faculty of Design and Innovation'
];

// Validation middleware
const validateUserCreation = [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(USER_ROLES).withMessage('Invalid role'),
  body('faculty_name').optional().isIn(FACULTIES).withMessage('Invalid faculty'),
  body('status').optional().isIn(USER_STATUS).withMessage('Invalid status')
];

const validateUserUpdate = [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(USER_ROLES).withMessage('Invalid role'),
  body('faculty_name').optional().isIn(FACULTIES).withMessage('Invalid faculty'),
  body('status').optional().isIn(USER_STATUS).withMessage('Invalid status')
];

// GET all users with enhanced filtering, search and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        id, username, email, role, faculty_name, department, phone,
        student_id, first_name, last_name, status, last_login, created_at,
        (SELECT COUNT(*) FROM student_courses WHERE student_id = users.id) AS enrolled_courses_count,
        (SELECT COUNT(*) FROM courses WHERE lecturer_id = users.id) AS teaching_courses_count
      FROM users 
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    let params = [];
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'Lecturer') {
      // Lecturers can only see students in their faculty and courses
      paramCount++;
      query += ` AND role = $${paramCount} AND faculty_name = $${paramCount + 1}`;
      countQuery += ` AND role = $${paramCount} AND faculty_name = $${paramCount + 1}`;
      params.push('Student', req.user.faculty_name);
      paramCount++;
    } else if (req.user.role === 'PRL') {
      // PRLs can see lecturers and students in their faculty
      paramCount++;
      query += ` AND faculty_name = $${paramCount} AND role IN ('Lecturer', 'Student')`;
      countQuery += ` AND faculty_name = $${paramCount} AND role IN ('Lecturer', 'Student')`;
      params.push(req.user.faculty_name);
    } else if (req.user.role === 'Program Leader') {
      // Program Leaders can see all users in their faculty
      paramCount++;
      query += ` AND faculty_name = $${paramCount}`;
      countQuery += ` AND faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    // Additional filters
    if (req.query.role) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      countQuery += ` AND role = $${paramCount}`;
      params.push(req.query.role);
    }

    if (req.query.faculty_name) {
      paramCount++;
      query += ` AND faculty_name = $${paramCount}`;
      countQuery += ` AND faculty_name = $${paramCount}`;
      params.push(req.query.faculty_name);
    }

    if (req.query.department) {
      paramCount++;
      query += ` AND department = $${paramCount}`;
      countQuery += ` AND department = $${paramCount}`;
      params.push(req.query.department);
    }

    if (req.query.status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      countQuery += ` AND status = $${paramCount}`;
      params.push(req.query.status);
    }

    // Search functionality
    if (req.query.search) {
      paramCount++;
      query += ` AND (
        username ILIKE $${paramCount} OR 
        email ILIKE $${paramCount} OR 
        first_name ILIKE $${paramCount} OR 
        last_name ILIKE $${paramCount} OR
        student_id ILIKE $${paramCount}
      )`;
      countQuery += ` AND (
        username ILIKE $${paramCount} OR 
        email ILIKE $${paramCount} OR 
        first_name ILIKE $${paramCount} OR 
        last_name ILIKE $${paramCount} OR
        student_id ILIKE $${paramCount}
      )`;
      params.push(`%${req.query.search}%`);
    }

    query += ' ORDER BY first_name ASC, last_name ASC';

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    // Execute queries
    const [result, totalResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2)) // Remove LIMIT and OFFSET params for count
    ]);

    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count),
        totalPages: Math.ceil(totalResult.rows[0].count / limit)
      }
    });
  } catch (err) {
    console.error('Users fetch error:', err);
    res.status(500).json({ error: 'Server error fetching users' });
  }
});

// GET users by role with enhanced filtering
router.get('/role/:role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.params;
    
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    let query = `
      SELECT 
        id, username, email, role, faculty_name, department, phone,
        student_id, first_name, last_name, status, last_login, created_at
      FROM users 
      WHERE role = $1
    `;
    let params = [role];
    let paramCount = 1;

    // Role-based filtering
    if (['PRL', 'Program Leader', 'Lecturer'].includes(req.user.role) && req.user.faculty_name) {
      paramCount++;
      query += ` AND faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    // Additional filters
    if (req.query.faculty_name) {
      paramCount++;
      query += ` AND faculty_name = $${paramCount}`;
      params.push(req.query.faculty_name);
    }

    if (req.query.department) {
      paramCount++;
      query += ` AND department = $${paramCount}`;
      params.push(req.query.department);
    }

    if (req.query.status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(req.query.status);
    }

    query += ' ORDER BY first_name ASC, last_name ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Users by role fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single user with detailed information
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    let query = `
      SELECT 
        id, username, email, role, faculty_name, department, phone,
        student_id, first_name, last_name, status, last_login, created_at, updated_at
      FROM users 
      WHERE id = $1
    `;
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

    const user = result.rows[0];

    // Get additional statistics based on role
    let statistics = {};
    let enrolledCourses = [];
    let teachingCourses = [];

    if (user.role === 'Student') {
      // Student statistics
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT sc.course_id) AS enrolled_courses_count,
          COUNT(DISTINCT ca.class_id) AS attended_classes_count,
          COUNT(DISTINCT ss.id) AS submitted_assignments_count,
          COUNT(DISTINCT g.id) AS graded_assignments_count,
          AVG(g.grade) AS average_grade,
          COUNT(DISTINCT CASE WHEN g.grade >= 70 THEN g.id END) AS passed_assignments_count
        FROM users u
        LEFT JOIN student_courses sc ON u.id = sc.student_id AND sc.status = 'Enrolled'
        LEFT JOIN class_attendance ca ON u.id = ca.student_id AND ca.status = 'Present'
        LEFT JOIN student_submissions ss ON u.id = ss.student_id
        LEFT JOIN grades g ON ss.id = g.submission_id
        WHERE u.id = $1
        GROUP BY u.id
      `;
      const statsResult = await pool.query(statsQuery, [id]);
      statistics = statsResult.rows[0] || {};

      // Get enrolled courses
      const coursesQuery = `
        SELECT 
          c.*,
          sc.enrollment_date,
          sc.status AS enrollment_status
        FROM student_courses sc
        JOIN courses c ON sc.course_id = c.id
        WHERE sc.student_id = $1
        ORDER BY sc.enrollment_date DESC
      `;
      const coursesResult = await pool.query(coursesQuery, [id]);
      enrolledCourses = coursesResult.rows;

    } else if (user.role === 'Lecturer') {
      // Lecturer statistics
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT c.id) AS teaching_courses_count,
          COUNT(DISTINCT cl.id) AS scheduled_classes_count,
          COUNT(DISTINCT a.id) AS created_assignments_count,
          COUNT(DISTINCT ss.id) AS total_submissions_count
        FROM users u
        LEFT JOIN courses c ON u.id = c.lecturer_id
        LEFT JOIN classes cl ON u.id = cl.lecturer_id
        LEFT JOIN assignments a ON u.id = a.created_by
        LEFT JOIN student_submissions ss ON a.id = ss.assignment_id
        WHERE u.id = $1
        GROUP BY u.id
      `;
      const statsResult = await pool.query(statsQuery, [id]);
      statistics = statsResult.rows[0] || {};

      // Get teaching courses
      const coursesQuery = `
        SELECT *
        FROM courses
        WHERE lecturer_id = $1
        ORDER BY created_at DESC
      `;
      const coursesResult = await pool.query(coursesQuery, [id]);
      teachingCourses = coursesResult.rows;
    }

    // Get recent activities from activities table (fallback if user_activities doesn't exist)
    let recentActivities = [];
    try {
      const activitiesQuery = `
        SELECT activity_type, description, created_at 
        FROM activities 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 10
      `;
      const activitiesResult = await pool.query(activitiesQuery, [id]);
      recentActivities = activitiesResult.rows;
    } catch (activityError) {
      console.warn('Activities table not available:', activityError.message);
      // Continue without activities
    }

    const userData = {
      ...user,
      statistics,
      enrolled_courses: enrolledCourses,
      teaching_courses: teachingCourses,
      recent_activities: recentActivities
    };

    res.json(userData);
  } catch (err) {
    console.error('User fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create user (Admin/Program Leader only)
router.post('/', authenticateToken, checkRole(['Program Leader']), validateUserCreation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { 
      username, 
      email, 
      role, 
      faculty_name, 
      department,
      phone,
      student_id,
      first_name,
      last_name,
      password = 'default123'
    } = req.body;

    // Check if username exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE username = $1', 
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if email exists
    const existingEmail = await client.query(
      'SELECT id FROM users WHERE email = $1', 
      [email]
    );
    
    if (existingEmail.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Check if student_id exists (for students)
    if (role === 'Student' && student_id) {
      const existingStudentId = await client.query(
        'SELECT id FROM users WHERE student_id = $1', 
        [student_id]
      );
      
      if (existingStudentId.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Student ID already exists' });
      }
    }

    // Hash password
    const hashedPass = await bcrypt.hash(password, 10);

    const result = await client.query(
      `INSERT INTO users (
        username, password, email, role, faculty_name, department,
        phone, student_id, first_name, last_name, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Active', $11)
      RETURNING id, username, email, role, faculty_name, department, phone, student_id, first_name, last_name, status, created_at`,
      [
        username, hashedPass, email, role, faculty_name || req.user.faculty_name, 
        department || null, phone || null, student_id || null, 
        first_name || null, last_name || null, req.user.id
      ]
    );

    const newUser = result.rows[0];

    // Auto-enroll if Student
    if (role === 'Student' && faculty_name) {
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
            [newUser.id, course.id]
          );
        }

        // Log enrollment activity
        await client.query(
          `INSERT INTO activities (user_id, activity_type, description, created_by) 
           VALUES ($1, $2, $3, $4)`,
          [
            newUser.id,
            'auto_enrollment',
            `Automatically enrolled in ${courses.rows.length} courses in ${faculty_name}`,
            req.user.id
          ]
        );
      } catch (enrollError) {
        console.error('Auto-enrollment error (non-critical):', enrollError.message);
        // Continue even if enrollment fails
      }
    }

    // Log user creation activity
    await client.query(
      `INSERT INTO activities (user_id, activity_type, description, created_by) 
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, 'user_created', 'User account created by administrator', req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json(newUser);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('User creation error:', err);
    
    if (err.code === '23505') {
      res.status(400).json({ error: 'Username or email already exists' });
    } else if (err.code === '23503') {
      res.status(400).json({ error: 'Invalid reference data' });
    } else {
      res.status(500).json({ error: 'Server error creating user' });
    }
  } finally {
    client.release();
  }
});

// PUT update user
router.put('/:id', authenticateToken, checkRole(['Program Leader']), validateUserUpdate, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { 
      username, 
      email, 
      role, 
      faculty_name, 
      department,
      phone,
      student_id,
      first_name,
      last_name,
      status
    } = req.body;

    // Check if user exists and belongs to faculty
    const userCheck = await client.query(
      'SELECT * FROM users WHERE id = $1 AND faculty_name = $2',
      [id, req.user.faculty_name]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found or access denied' });
    }

    // Check if email already exists (excluding current user)
    if (email) {
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      
      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Check if student_id already exists (for students, excluding current user)
    if (role === 'Student' && student_id) {
      const studentIdCheck = await client.query(
        'SELECT id FROM users WHERE student_id = $1 AND id != $2',
        [student_id, id]
      );
      
      if (studentIdCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Student ID already exists' });
      }
    }

    const result = await client.query(
      `UPDATE users 
       SET username = $1, email = $2, role = $3, faculty_name = $4, 
           department = $5, phone = $6, student_id = $7, first_name = $8,
           last_name = $9, status = $10, updated_at = NOW()
       WHERE id = $11 
       RETURNING id, username, email, role, faculty_name, department, phone, 
                 student_id, first_name, last_name, status, created_at`,
      [
        username, email, role, faculty_name, department, phone, 
        student_id, first_name, last_name, status, id
      ]
    );

    // Log user update activity
    await client.query(
      `INSERT INTO activities (user_id, activity_type, description, created_by) 
       VALUES ($1, $2, $3, $4)`,
      [id, 'user_updated', 'User profile updated by administrator', req.user.id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('User update error:', err);
    
    if (err.code === '23505') {
      res.status(400).json({ error: 'Duplicate entry found' });
    } else {
      res.status(500).json({ error: 'Server error updating user' });
    }
  } finally {
    client.release();
  }
});

// PATCH update user status
router.patch('/:id/status', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !USER_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Valid status required' });
    }

    // Check if user exists and belongs to faculty
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND faculty_name = $2',
      [id, req.user.faculty_name]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or access denied' });
    }

    const result = await pool.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('User status update error:', err);
    res.status(500).json({ error: 'Server error updating user status' });
  }
});

// DELETE user (soft delete by setting status to Inactive)
router.delete('/:id', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check if user exists and belongs to faculty
    const userCheck = await client.query(
      'SELECT * FROM users WHERE id = $1 AND faculty_name = $2',
      [id, req.user.faculty_name]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found or access denied' });
    }

    // Check for dependencies before deletion
    const user = userCheck.rows[0];
    
    if (user.role === 'Lecturer') {
      const teachingCourses = await client.query(
        'SELECT COUNT(*) FROM courses WHERE lecturer_id = $1',
        [id]
      );
      
      if (teachingCourses.rows[0].count > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Cannot delete lecturer with assigned courses. Reassign courses first.' 
        });
      }
    }

    if (user.role === 'Student') {
      const enrollments = await client.query(
        'SELECT COUNT(*) FROM student_courses WHERE student_id = $1',
        [id]
      );
      
      if (enrollments.rows[0].count > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Cannot delete student with course enrollments. Remove enrollments first.' 
        });
      }
    }

    // Instead of hard delete, set status to Inactive and log the action
    await client.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      ['Inactive', id]
    );

    // Log user deletion activity
    await client.query(
      `INSERT INTO activities (user_id, activity_type, description, created_by) 
       VALUES ($1, $2, $3, $4)`,
      [id, 'user_deactivated', 'User account deactivated by administrator', req.user.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('User deletion error:', err);
    
    if (err.code === '23503') {
      res.status(400).json({ error: 'Cannot delete: User has related records' });
    } else {
      res.status(500).json({ error: 'Server error deleting user' });
    }
  } finally {
    client.release();
  }
});

// GET user statistics
router.get('/:id/statistics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists and user has permission
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userCheck.rows[0];

    // Authorization check
    if (req.user.id !== parseInt(id) && !['Program Leader', 'PRL'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (['PRL', 'Program Leader'].includes(req.user.role) && user.faculty_name !== req.user.faculty_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let statistics = {};

    if (user.role === 'Student') {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT sc.course_id) AS total_courses,
          COUNT(DISTINCT ca.class_id) AS total_classes_attended,
          COUNT(DISTINCT ss.id) AS total_assignments_submitted,
          COUNT(DISTINCT g.id) AS total_assignments_graded,
          AVG(g.grade) AS average_grade,
          COUNT(DISTINCT CASE WHEN g.grade >= 70 THEN g.id END) AS passed_assignments,
          COUNT(DISTINCT CASE WHEN g.grade < 70 THEN g.id END) AS failed_assignments,
          COUNT(DISTINCT ca2.class_id) AS total_classes_missed
        FROM users u
        LEFT JOIN student_courses sc ON u.id = sc.student_id AND sc.status = 'Enrolled'
        LEFT JOIN class_attendance ca ON u.id = ca.student_id AND ca.status = 'Present'
        LEFT JOIN class_attendance ca2 ON u.id = ca2.student_id AND ca2.status = 'Absent'
        LEFT JOIN student_submissions ss ON u.id = ss.student_id
        LEFT JOIN grades g ON ss.id = g.submission_id
        WHERE u.id = $1
        GROUP BY u.id
      `;
      const statsResult = await pool.query(statsQuery, [id]);
      statistics = statsResult.rows[0] || {};
    } else if (user.role === 'Lecturer') {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT c.id) AS total_courses,
          COUNT(DISTINCT cl.id) AS total_classes,
          COUNT(DISTINCT a.id) AS total_assignments,
          COUNT(DISTINCT ss.id) AS total_submissions,
          AVG(g.grade) AS average_student_grade,
          COUNT(DISTINCT sc.student_id) AS total_students
        FROM users u
        LEFT JOIN courses c ON u.id = c.lecturer_id
        LEFT JOIN classes cl ON u.id = cl.lecturer_id
        LEFT JOIN assignments a ON u.id = a.created_by
        LEFT JOIN student_submissions ss ON a.id = ss.assignment_id
        LEFT JOIN grades g ON ss.id = g.submission_id
        LEFT JOIN student_courses sc ON c.id = sc.course_id
        WHERE u.id = $1
        GROUP BY u.id
      `;
      const statsResult = await pool.query(statsQuery, [id]);
      statistics = statsResult.rows[0] || {};
    }

    res.json(statistics);
  } catch (err) {
    console.error('User statistics error:', err);
    res.status(500).json({ error: 'Server error fetching user statistics' });
  }
});

module.exports = router;