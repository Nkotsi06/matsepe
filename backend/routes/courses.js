// backend/routes/courses.js

const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Constants for better maintainability
const COURSE_STATUS = ['Active', 'Inactive', 'Archived'];
const FACULTIES = [
  'Faculty of Information and Communication Technology',
  'Faculty of Business Management and Globalisation', 
  'Faculty of Design and Innovation'
];

// Validation middleware
const validateCourseCreation = [
  body('name').isLength({ min: 3 }).withMessage('Course name must be at least 3 characters'),
  body('code').isLength({ min: 2 }).withMessage('Course code is required'),
  body('faculty_name').isIn(FACULTIES).withMessage('Invalid faculty'),
  body('department').notEmpty().withMessage('Department is required'),
  body('credits').isInt({ min: 1, max: 12 }).withMessage('Credits must be between 1 and 12'),
  body('max_students').optional().isInt({ min: 1 }).withMessage('Max students must be a positive number'),
  body('status').optional().isIn(COURSE_STATUS).withMessage('Invalid status')
];

const validateCourseUpdate = [
  body('name').optional().isLength({ min: 3 }).withMessage('Course name must be at least 3 characters'),
  body('code').optional().isLength({ min: 2 }).withMessage('Course code is required'),
  body('faculty_name').optional().isIn(FACULTIES).withMessage('Invalid faculty'),
  body('credits').optional().isInt({ min: 1, max: 12 }).withMessage('Credits must be between 1 and 12'),
  body('max_students').optional().isInt({ min: 1 }).withMessage('Max students must be a positive number'),
  body('status').optional().isIn(COURSE_STATUS).withMessage('Invalid status')
];

// ------------------ GET all courses with enhanced filtering, search and pagination ------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching courses for user:', req.user);

    let query = `
      SELECT 
        c.*, 
        u.username AS lecturer_name,
        u.email AS lecturer_email,
        (SELECT COUNT(*) FROM student_courses sc WHERE sc.course_id = c.id AND sc.status = 'Enrolled') AS enrolled_students_count
      FROM courses c 
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE 1=1
    `;
    
    let countQuery = `
      SELECT COUNT(*) 
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
      countQuery += ` AND c.lecturer_id = $${paramCount}`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      paramCount++;
      query += ` AND c.faculty_name = $${paramCount}`;
      countQuery += ` AND c.faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    // Search functionality
    if (req.query.search) {
      paramCount++;
      query += ` AND (
        c.name ILIKE $${paramCount} OR 
        c.code ILIKE $${paramCount} OR 
        c.description ILIKE $${paramCount} OR
        u.username ILIKE $${paramCount}
      )`;
      countQuery += ` AND (
        c.name ILIKE $${paramCount} OR 
        c.code ILIKE $${paramCount} OR 
        c.description ILIKE $${paramCount} OR
        u.username ILIKE $${paramCount}
      )`;
      params.push(`%${req.query.search}%`);
    }

    // Faculty/Department filtering
    if (req.query.faculty_name) {
      paramCount++;
      query += ` AND c.faculty_name = $${paramCount}`;
      countQuery += ` AND c.faculty_name = $${paramCount}`;
      params.push(req.query.faculty_name);
    }

    if (req.query.department) {
      paramCount++;
      query += ` AND c.department = $${paramCount}`;
      countQuery += ` AND c.department = $${paramCount}`;
      params.push(req.query.department);
    }

    // Status filtering
    if (req.query.status) {
      paramCount++;
      query += ` AND c.status = $${paramCount}`;
      countQuery += ` AND c.status = $${paramCount}`;
      params.push(req.query.status);
    }

    // Semester filtering
    if (req.query.semester) {
      paramCount++;
      query += ` AND c.semester = $${paramCount}`;
      countQuery += ` AND c.semester = $${paramCount}`;
      params.push(req.query.semester);
    }

    // Academic year filtering
    if (req.query.academic_year) {
      paramCount++;
      query += ` AND c.academic_year = $${paramCount}`;
      countQuery += ` AND c.academic_year = $${paramCount}`;
      params.push(req.query.academic_year);
    }

    query += ' ORDER BY c.created_at DESC, c.name ASC';

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    console.log('Executing query:', query, 'with params:', params);
    
    // Execute both queries in parallel
    const [result, totalResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2)) // Remove LIMIT and OFFSET for count
    ]);

    res.json({
      courses: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count),
        totalPages: Math.ceil(totalResult.rows[0].count / limit)
      }
    });
  } catch (err) {
    console.error('Courses fetch error:', err);
    res.status(500).json({ error: 'Server error fetching courses' });
  }
});

// ------------------ GET single course by ID with detailed information ------------------
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const courseQuery = `
      SELECT 
        c.*, 
        u.username AS lecturer_name,
        u.email AS lecturer_email,
        u.phone AS lecturer_phone,
        (SELECT COUNT(*) FROM student_courses sc WHERE sc.course_id = c.id AND sc.status = 'Enrolled') AS enrolled_students_count
      FROM courses c 
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE c.id = $1
    `;

    const result = await pool.query(courseQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = result.rows[0];

    // Authorization check for detailed data
    let hasDetailedAccess = false;
    if (req.user.role === 'Program Leader') {
      hasDetailedAccess = true;
    } else if (req.user.role === 'Lecturer' && course.lecturer_id === req.user.id) {
      hasDetailedAccess = true;
    } else if (req.user.role === 'PRL' && course.faculty_name === req.user.faculty_name) {
      hasDetailedAccess = true;
    }

    // Get enrolled students if user has permission
    let enrolledStudents = [];
    if (hasDetailedAccess) {
      try {
        const studentsQuery = `
          SELECT 
            sc.*,
            u.username AS student_name,
            u.email AS student_email,
            u.student_id AS student_number,
            u.first_name,
            u.last_name
          FROM student_courses sc
          JOIN users u ON sc.student_id = u.id
          WHERE sc.course_id = $1
          ORDER BY u.first_name ASC, u.last_name ASC
        `;
        const studentsResult = await pool.query(studentsQuery, [id]);
        enrolledStudents = studentsResult.rows;
      } catch (err) {
        console.error('Error fetching enrolled students:', err);
        // Continue without students data
      }
    }

    // Get course ratings (limited for privacy)
    let courseRatings = [];
    try {
      const ratingsQuery = `
        SELECT 
          cr.*,
          u.username AS student_name
        FROM course_ratings cr
        LEFT JOIN users u ON cr.student_id = u.id
        WHERE cr.course_id = $1
        ORDER BY cr.created_at DESC
        LIMIT 10
      `;
      const ratingsResult = await pool.query(ratingsQuery, [id]);
      courseRatings = ratingsResult.rows;
    } catch (err) {
      console.error('Error fetching course ratings:', err);
      // Continue without ratings data
    }

    // Get recent assignments if user has permission
    let recentAssignments = [];
    if (hasDetailedAccess) {
      try {
        const assignmentsQuery = `
          SELECT 
            a.*,
            COUNT(ss.id) AS submission_count
          FROM assignments a
          LEFT JOIN student_submissions ss ON a.id = ss.assignment_id
          WHERE a.course_id = $1
          GROUP BY a.id
          ORDER BY a.due_date DESC
          LIMIT 5
        `;
        const assignmentsResult = await pool.query(assignmentsQuery, [id]);
        recentAssignments = assignmentsResult.rows;
      } catch (err) {
        console.error('Error fetching assignments:', err);
      }
    }

    const courseData = {
      ...course,
      enrolled_students: enrolledStudents,
      recent_ratings: courseRatings,
      recent_assignments: recentAssignments,
      has_detailed_access: hasDetailedAccess
    };

    res.json(courseData);
  } catch (err) {
    console.error('Course fetch error:', err);
    res.status(500).json({ error: 'Server error fetching course' });
  }
});

// ------------------ POST create course (Program Leader only) ------------------
router.post('/', authenticateToken, checkRole(['Program Leader']), validateCourseCreation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { 
      name, 
      code, 
      lecturer_id, 
      description, 
      credits, 
      faculty_name, 
      department,
      semester,
      academic_year,
      max_students,
      prerequisites,
      learning_outcomes,
      status = 'Active'
    } = req.body;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if course code already exists
      const existingCourse = await client.query(
        'SELECT id FROM courses WHERE code = $1',
        [code]
      );

      if (existingCourse.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Course code already exists' });
      }

      // Validate lecturer exists and belongs to same faculty if provided
      if (lecturer_id) {
        const lecturerCheck = await client.query(
          'SELECT id, faculty_name FROM users WHERE id = $1 AND role = $2',
          [lecturer_id, 'Lecturer']
        );

        if (lecturerCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid lecturer ID' });
        }

        if (lecturerCheck.rows[0].faculty_name !== faculty_name) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Lecturer must belong to the same faculty as the course' });
        }
      }

      // Insert course
      const courseResult = await client.query(
        `INSERT INTO courses (
          name, code, lecturer_id, description, credits, faculty_name, 
          department, semester, academic_year, max_students, prerequisites,
          learning_outcomes, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
        RETURNING *`,
        [
          name, code, lecturer_id, description, credits, faculty_name, 
          department, semester, academic_year, max_students, prerequisites,
          learning_outcomes, status, req.user.id
        ]
      );

      // Log activity
      await client.query(
        `INSERT INTO activities (user_id, activity_type, description, created_by) 
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'course_created', `Created course: ${name} (${code})`, req.user.id]
      );

      await client.query('COMMIT');

      res.status(201).json(courseResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Course creation error:', err);

    if (err.code === '23505') {
      return res.status(400).json({ error: 'Course code already exists' });
    }

    res.status(500).json({ error: 'Server error creating course' });
  }
});

// ------------------ PUT update course (Program Leader/Lecturer with ownership) ------------------
router.put('/:id', authenticateToken, validateCourseUpdate, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { 
      name, code, lecturer_id, description, credits, faculty_name, 
      department, semester, academic_year, max_students, prerequisites,
      learning_outcomes, status
    } = req.body;

    // Check if course exists
    const courseCheck = await pool.query(
      'SELECT * FROM courses WHERE id = $1',
      [id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseCheck.rows[0];

    // Authorization check
    if (req.user.role === 'Lecturer' && course.lecturer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only update your own courses.' });
    }

    if (req.user.role === 'PRL' && course.faculty_name !== req.user.faculty_name) {
      return res.status(403).json({ error: 'Access denied. You can only update courses in your faculty.' });
    }

    // Check for duplicate course code (excluding current course)
    if (code && code !== course.code) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM courses WHERE code = $1 AND id != $2',
        [code, id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Course code already exists' });
      }
    }

    const result = await pool.query(
      `UPDATE courses 
       SET name = $1, code = $2, lecturer_id = $3, description = $4, credits = $5, 
           faculty_name = $6, department = $7, semester = $8, academic_year = $9,
           max_students = $10, prerequisites = $11, learning_outcomes = $12, 
           status = $13, updated_at = NOW()
       WHERE id = $14 
       RETURNING *`,
      [
        name, code, lecturer_id, description, credits, faculty_name, 
        department, semester, academic_year, max_students, prerequisites,
        learning_outcomes, status, id
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Course update error:', err);
    res.status(500).json({ error: 'Server error updating course' });
  }
});

// ------------------ PATCH update course status ------------------
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !COURSE_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Valid status required' });
    }

    // Check if course exists
    const courseCheck = await pool.query(
      'SELECT * FROM courses WHERE id = $1',
      [id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseCheck.rows[0];

    // Authorization check
    if (req.user.role === 'Lecturer' && course.lecturer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'PRL' && course.faculty_name !== req.user.faculty_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'UPDATE courses SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Course status update error:', err);
    res.status(500).json({ error: 'Server error updating course status' });
  }
});

// ------------------ DELETE course (Program Leader only) ------------------
router.delete('/:id', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if course exists
      const courseCheck = await client.query(
        'SELECT * FROM courses WHERE id = $1 AND faculty_name = $2',
        [id, req.user.faculty_name]
      );

      if (courseCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Course not found or access denied' });
      }

      const course = courseCheck.rows[0];

      // Check for dependencies
      const hasStudents = await client.query(
        'SELECT 1 FROM student_courses WHERE course_id = $1 LIMIT 1',
        [id]
      );

      if (hasStudents.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Cannot delete course with enrolled students. Archive the course instead.' 
        });
      }

      // Check for assignments
      const hasAssignments = await client.query(
        'SELECT 1 FROM assignments WHERE course_id = $1 LIMIT 1',
        [id]
      );

      if (hasAssignments.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Cannot delete course with assignments. Remove assignments first or archive the course.' 
        });
      }

      await client.query('DELETE FROM courses WHERE id = $1', [id]);

      // Log activity
      await client.query(
        `INSERT INTO activities (user_id, activity_type, description, created_by) 
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'course_deleted', `Deleted course: ${course.name} (${course.code})`, req.user.id]
      );

      await client.query('COMMIT');

      res.json({ message: 'Course deleted successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Course deletion error:', err);
    
    if (err.code === '23503') {
      res.status(400).json({ error: 'Cannot delete course with existing references' });
    } else {
      res.status(500).json({ error: 'Server error deleting course' });
    }
  }
});

// ------------------ GET course statistics ------------------
router.get('/:id/statistics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course exists
    const courseCheck = await pool.query(
      'SELECT * FROM courses WHERE id = $1',
      [id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseCheck.rows[0];

    // Authorization check
    if (req.user.role === 'Lecturer' && course.lecturer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'PRL' && course.faculty_name !== req.user.faculty_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get comprehensive statistics using only existing tables
    const statisticsQuery = `
      SELECT 
        -- Student counts
        (SELECT COUNT(*) FROM student_courses WHERE course_id = $1 AND status = 'Enrolled') AS enrolled_students,
        (SELECT COUNT(*) FROM student_courses WHERE course_id = $1 AND status = 'Completed') AS completed_students,
        (SELECT COUNT(*) FROM student_courses WHERE course_id = $1 AND status = 'Dropped') AS dropped_students,
        
        -- Rating statistics
        (SELECT COUNT(*) FROM course_ratings WHERE course_id = $1) AS total_ratings,
        (SELECT AVG(rating) FROM course_ratings WHERE course_id = $1) AS average_rating,
        (SELECT COUNT(*) FROM course_ratings WHERE course_id = $1 AND rating >= 4) AS positive_ratings,
        
        -- Assignment statistics
        (SELECT COUNT(*) FROM assignments WHERE course_id = $1) AS total_assignments,
        (SELECT COUNT(*) FROM assignments WHERE course_id = $1 AND due_date > NOW()) AS upcoming_assignments,
        
        -- Grade statistics (if available)
        (SELECT AVG(g.grade) 
         FROM grades g 
         JOIN student_submissions ss ON g.submission_id = ss.id 
         JOIN assignments a ON ss.assignment_id = a.id 
         WHERE a.course_id = $1) AS average_grade
    `;

    const statisticsResult = await pool.query(statisticsQuery, [id]);

    res.json(statisticsResult.rows[0] || {});
  } catch (err) {
    console.error('Course statistics error:', err);
    res.status(500).json({ error: 'Server error fetching course statistics' });
  }
});

// ------------------ GET top rated courses ------------------
router.get('/top-rated', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        c.*,
        u.username AS lecturer_name,
        (SELECT AVG(rating) FROM course_ratings WHERE course_id = c.id) AS average_rating,
        (SELECT COUNT(*) FROM course_ratings WHERE course_id = c.id) AS rating_count
      FROM courses c
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE c.status = 'Active'
    `;
    let params = [];

    // Role-based filtering
    if (req.user.role === 'Lecturer') {
      query += ` AND c.lecturer_id = $1`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $1`;
      params.push(req.user.faculty_name);
    }

    query += ` ORDER BY average_rating DESC NULLS LAST, rating_count DESC LIMIT 10`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Top rated courses error:', err);
    res.status(500).json({ error: 'Server error fetching top rated courses' });
  }
});

// ------------------ GET course stats ------------------
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_courses,
        COUNT(DISTINCT lecturer_id) as total_lecturers,
        SUM((SELECT COUNT(*) FROM student_courses sc WHERE sc.course_id = c.id AND sc.status = 'Enrolled')) as total_enrollments,
        AVG(credits) as average_credits,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_courses,
        COUNT(CASE WHEN status = 'Archived' THEN 1 END) as archived_courses
      FROM courses c
      WHERE 1=1
    `;
    let params = [];

    // Role-based filtering
    if (req.user.role === 'Lecturer') {
      query += ` AND c.lecturer_id = $1`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $1`;
      params.push(req.user.faculty_name);
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Course stats error:', err);
    res.status(500).json({ error: 'Server error fetching course statistics' });
  }
});

// ------------------ GET courses by faculty ------------------
router.get('/faculty/:faculty', authenticateToken, async (req, res) => {
  try {
    const { faculty } = req.params;

    if (!FACULTIES.includes(faculty)) {
      return res.status(400).json({ error: 'Invalid faculty' });
    }

    // Authorization check
    if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name !== faculty) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = `
      SELECT 
        c.*,
        u.username AS lecturer_name,
        (SELECT COUNT(*) FROM student_courses sc WHERE sc.course_id = c.id AND sc.status = 'Enrolled') AS enrolled_students_count
      FROM courses c
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE c.faculty_name = $1 AND c.status = 'Active'
      ORDER BY c.name ASC
    `;

    const result = await pool.query(query, [faculty]);
    res.json(result.rows);
  } catch (err) {
    console.error('Courses by faculty error:', err);
    res.status(500).json({ error: 'Server error fetching courses by faculty' });
  }
});

module.exports = router;