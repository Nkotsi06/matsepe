// backend/routes/courses.js

const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ GET all courses with enhanced filtering and search ------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching courses for user:', req.user);

    let query = `
      SELECT 
        c.*, 
        u.username AS lecturer_name,
        u.email AS lecturer_email,
        COUNT(DISTINCT sc.student_id) AS enrolled_students_count,
        COUNT(DISTINCT cm.id) AS course_materials_count,
        COUNT(DISTINCT a.id) AS assignments_count
      FROM courses c 
      LEFT JOIN users u ON c.lecturer_id = u.id
      LEFT JOIN student_courses sc ON c.id = sc.course_id
      LEFT JOIN course_materials cm ON c.id = cm.course_id
      LEFT JOIN assignments a ON c.id = a.course_id
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

    // Search functionality
    if (req.query.search) {
      paramCount++;
      query += ` AND (
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
      params.push(req.query.faculty_name);
    }

    if (req.query.department) {
      paramCount++;
      query += ` AND c.department = $${paramCount}`;
      params.push(req.query.department);
    }

    // Status filtering
    if (req.query.status) {
      paramCount++;
      query += ` AND c.status = $${paramCount}`;
      params.push(req.query.status);
    }

    query += ' GROUP BY c.id, u.username, u.email';
    query += ' ORDER BY c.created_at DESC, c.name ASC';
    
    console.log('Executing query:', query, 'with params:', params);
    const result = await pool.query(query, params);

    res.json(result.rows);
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
        COUNT(DISTINCT sc.student_id) AS enrolled_students_count,
        COUNT(DISTINCT cm.id) AS course_materials_count,
        COUNT(DISTINCT a.id) AS assignments_count,
        ARRAY_AGG(DISTINCT sc.academic_year) FILTER (WHERE sc.academic_year IS NOT NULL) AS available_academic_years,
        ARRAY_AGG(DISTINCT sc.semester) FILTER (WHERE sc.semester IS NOT NULL) AS available_semesters
      FROM courses c 
      LEFT JOIN users u ON c.lecturer_id = u.id
      LEFT JOIN student_courses sc ON c.id = sc.course_id
      LEFT JOIN course_materials cm ON c.id = cm.course_id
      LEFT JOIN assignments a ON c.id = a.course_id
      WHERE c.id = $1
      GROUP BY c.id, u.username, u.email, u.phone
    `;

    const result = await pool.query(courseQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get enrolled students if user has permission
    let enrolledStudents = [];
    if (['Program Leader', 'Lecturer'].includes(req.user.role)) {
      const studentsQuery = `
        SELECT 
          sc.*,
          u.username AS student_name,
          u.email AS student_email,
          u.student_id AS student_number
        FROM student_courses sc
        JOIN users u ON sc.student_id = u.id
        WHERE sc.course_id = $1
        ORDER BY u.username ASC
      `;
      const studentsResult = await pool.query(studentsQuery, [id]);
      enrolledStudents = studentsResult.rows;
    }

    // Get recent activities
    const activitiesQuery = `
      SELECT 
        ca.*,
        u.username AS created_by_name
      FROM course_activities ca
      LEFT JOIN users u ON ca.created_by = u.id
      WHERE ca.course_id = $1
      ORDER BY ca.created_at DESC
      LIMIT 10
    `;
    const activitiesResult = await pool.query(activitiesQuery, [id]);

    const courseData = {
      ...result.rows[0],
      enrolled_students: enrolledStudents,
      recent_activities: activitiesResult.rows
    };

    res.json(courseData);
  } catch (err) {
    console.error('Course fetch error:', err);
    res.status(500).json({ error: 'Server error fetching course' });
  }
});

// ------------------ POST create course (Program Leader only) ------------------
router.post('/', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
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

    if (!name || !code || !faculty_name || !department) {
      return res.status(400).json({ 
        error: 'Course name, code, faculty name, and department are required' 
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

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
        `INSERT INTO course_activities (
          course_id, activity_type, description, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [
          courseResult.rows[0].id,
          'course_created',
          `Course "${name}" (${code}) was created`,
          req.user.id
        ]
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

    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Course code already exists' });
    }

    res.status(500).json({ error: 'Server error creating course' });
  }
});

// ------------------ PUT update course (Program Leader/Lecturer with ownership) ------------------
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, code, lecturer_id, description, credits, faculty_name, 
      department, semester, academic_year, max_students, prerequisites,
      learning_outcomes, status
    } = req.body;

    // Check if course exists and user has permission
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

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const result = await client.query(
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

      // Log activity
      await client.query(
        `INSERT INTO course_activities (
          course_id, activity_type, description, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [
          id,
          'course_updated',
          `Course "${name}" (${code}) was updated`,
          req.user.id
        ]
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
    console.error('Course update error:', err);
    res.status(500).json({ error: 'Server error updating course' });
  }
});

// ------------------ DELETE course (Program Leader only) ------------------
router.delete('/:id', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if course exists and get course info for activity log
      const courseCheck = await client.query(
        'SELECT * FROM courses WHERE id = $1',
        [id]
      );

      if (courseCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Course not found' });
      }

      const course = courseCheck.rows[0];

      // Check for dependencies
      const hasStudents = await client.query(
        'SELECT 1 FROM student_courses WHERE course_id = $1 LIMIT 1',
        [id]
      );

      const hasMaterials = await client.query(
        'SELECT 1 FROM course_materials WHERE course_id = $1 LIMIT 1',
        [id]
      );

      const hasAssignments = await client.query(
        'SELECT 1 FROM assignments WHERE course_id = $1 LIMIT 1',
        [id]
      );

      if (hasStudents.rows.length > 0 || hasMaterials.rows.length > 0 || hasAssignments.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Cannot delete course with existing students, materials, or assignments. Archive the course instead.' 
        });
      }

      // Log activity before deletion
      await client.query(
        `INSERT INTO course_activities (
          course_id, activity_type, description, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [
          id,
          'course_deleted',
          `Course "${course.name}" (${course.code}) was deleted`,
          req.user.id
        ]
      );

      await client.query('DELETE FROM courses WHERE id = $1', [id]);

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
    res.status(500).json({ error: 'Server error deleting course' });
  }
});

// ------------------ PATCH archive course (Program Leader only) ------------------
router.patch('/:id/archive', authenticateToken, checkRole(['Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const courseCheck = await client.query(
        'SELECT * FROM courses WHERE id = $1',
        [id]
      );

      if (courseCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Course not found' });
      }

      const course = courseCheck.rows[0];

      const result = await client.query(
        'UPDATE courses SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        ['Archived', id]
      );

      // Log activity
      await client.query(
        `INSERT INTO course_activities (
          course_id, activity_type, description, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [
          id,
          'course_archived',
          `Course "${course.name}" (${course.code}) was archived`,
          req.user.id
        ]
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
    console.error('Course archive error:', err);
    res.status(500).json({ error: 'Server error archiving course' });
  }
});

// ------------------ GET course statistics ------------------
router.get('/:id/statistics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has access to this course
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

    // Get statistics
    const statisticsQuery = `
      SELECT 
        COUNT(DISTINCT sc.student_id) AS total_students,
        COUNT(DISTINCT cm.id) AS total_materials,
        COUNT(DISTINCT a.id) AS total_assignments,
        COUNT(DISTINCT sm.id) AS total_submissions,
        AVG(g.grade) AS average_grade,
        COUNT(DISTINCT CASE WHEN g.grade >= 70 THEN g.id END) AS students_passing,
        COUNT(DISTINCT CASE WHEN g.grade < 70 THEN g.id END) AS students_failing
      FROM courses c
      LEFT JOIN student_courses sc ON c.id = sc.course_id
      LEFT JOIN course_materials cm ON c.id = cm.course_id
      LEFT JOIN assignments a ON c.id = a.course_id
      LEFT JOIN student_submissions sm ON a.id = sm.assignment_id
      LEFT JOIN grades g ON sm.id = g.submission_id
      WHERE c.id = $1
      GROUP BY c.id
    `;

    const statisticsResult = await pool.query(statisticsQuery, [id]);

    res.json(statisticsResult.rows[0] || {});
  } catch (err) {
    console.error('Course statistics error:', err);
    res.status(500).json({ error: 'Server error fetching course statistics' });
  }
});

module.exports = router;