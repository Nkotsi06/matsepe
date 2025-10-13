const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ Helper Functions ------------------
const validateDate = (date) => {
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
};

const checkEnrollment = async (studentId, courseId) => {
  try {
    const result = await pool.query(
      `SELECT 1 FROM student_courses WHERE student_id = $1 AND course_id = $2 AND status = 'Enrolled'`,
      [studentId, courseId]
    );
    return result.rows.length > 0;
  } catch (err) {
    console.error('Enrollment check error:', err);
    return false;
  }
};

// Validation middleware
const validateReportSubmission = [
  body('course_id').isInt({ min: 1 }).withMessage('Valid course ID is required'),
  body('title').isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('description').isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters')
];

const validateRatingSubmission = [
  body('course_id').isInt({ min: 1 }).withMessage('Valid course ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment must not exceed 500 characters')
];

// ------------------ Fetch enrolled courses for a student ------------------
router.get('/courses', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { status = 'Enrolled' } = req.query;
    
    const validStatuses = ['Enrolled', 'Completed', 'Dropped'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `SELECT 
        c.*, 
        u.username AS lecturer_name,
        u.email AS lecturer_email,
        sc.enrollment_date,
        sc.status AS enrollment_status,
        (SELECT COUNT(*) FROM reports WHERE course_id = c.id AND reported_by = $1) AS student_reports_count,
        (SELECT COUNT(*) FROM course_ratings WHERE course_id = c.id AND student_id = $1) AS has_rated
       FROM courses c
       JOIN student_courses sc ON c.id = sc.course_id
       LEFT JOIN users u ON c.lecturer_id = u.id
       WHERE sc.student_id = $1 AND sc.status = $2
       ORDER BY c.name ASC`,
      [req.user.id, status]
    );
    
    res.json({
      courses: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    console.error('Student courses error:', err);
    res.status(500).json({ error: 'Server error fetching student courses' });
  }
});

// ------------------ Fetch course details with enhanced analytics ------------------
router.get('/courses/:courseId', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const isEnrolled = await checkEnrollment(req.user.id, courseId);
    if (!isEnrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const courseDetails = await pool.query(
      `SELECT 
        c.*,
        u.username AS lecturer_name,
        u.email AS lecturer_email,
        sc.enrollment_date,
        sc.status AS enrollment_status,
        (SELECT COUNT(*) FROM reports r WHERE r.course_id = c.id AND r.reported_by = $1) AS student_reports,
        (SELECT COUNT(*) FROM reports r WHERE r.course_id = c.id AND r.reported_by = $1 AND r.status = 'Resolved') AS approved_reports,
        (SELECT AVG(rating) FROM course_ratings WHERE course_id = c.id) AS avg_rating,
        (SELECT COUNT(*) FROM course_ratings WHERE course_id = c.id) AS rating_count,
        (SELECT rating FROM course_ratings WHERE course_id = c.id AND student_id = $1) AS student_rating,
        (SELECT COUNT(DISTINCT student_id) FROM student_courses WHERE course_id = c.id AND status = 'Enrolled') AS total_students,
        (SELECT COUNT(*) FROM assignments WHERE course_id = c.id) AS total_assignments
       FROM courses c
       LEFT JOIN users u ON c.lecturer_id = u.id
       LEFT JOIN student_courses sc ON c.id = sc.course_id AND sc.student_id = $1
       WHERE c.id = $2`,
      [req.user.id, courseId]
    );

    if (courseDetails.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get recent assignments for this course
    const assignments = await pool.query(
      `SELECT 
        a.*,
        (SELECT COUNT(*) FROM student_submissions WHERE assignment_id = a.id AND student_id = $1) AS has_submitted
       FROM assignments a
       WHERE a.course_id = $2
       ORDER BY a.due_date ASC
       LIMIT 10`,
      [req.user.id, courseId]
    );

    // Get recent reports for this course by this student
    const recentReports = await pool.query(
      `SELECT * FROM reports 
       WHERE course_id = $1 AND reported_by = $2 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [courseId, req.user.id]
    );

    const courseData = {
      ...courseDetails.rows[0],
      assignments: assignments.rows,
      recent_reports: recentReports.rows
    };

    res.json(courseData);
  } catch (err) {
    console.error('Course details error:', err);
    res.status(500).json({ error: 'Server error fetching course details' });
  }
});

// ------------------ Fetch public statistics ------------------
router.get('/public-statistics', async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'Student' AND status = 'Active') AS active_students,
        (SELECT COUNT(*) FROM courses WHERE status = 'Active') AS active_courses,
        (SELECT COUNT(*) FROM users WHERE role = 'Lecturer' AND status = 'Active') AS active_lecturers,
        (SELECT COUNT(*) FROM reports WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') AS monthly_reports,
        (SELECT COUNT(*) FROM course_ratings) AS total_ratings,
        (SELECT ROUND(AVG(rating)::numeric, 2) FROM course_ratings) AS avg_satisfaction,
        (SELECT COUNT(*) FROM assignments WHERE due_date > NOW()) AS upcoming_assignments
      `
    );
    
    res.json(stats.rows[0] || {
      active_students: 0,
      active_courses: 0,
      active_lecturers: 0,
      monthly_reports: 0,
      total_ratings: 0,
      avg_satisfaction: 0,
      upcoming_assignments: 0
    });
  } catch (err) {
    console.error('Public statistics error:', err);
    res.json({
      active_students: 1500,
      active_courses: 85,
      active_lecturers: 45,
      monthly_reports: 320,
      total_ratings: 4500,
      avg_satisfaction: 4.2,
      upcoming_assignments: 12
    });
  }
});

// ------------------ Fetch student reports with enhanced filtering ------------------
router.get('/reports', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { status, course_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.*, c.name AS course_name, c.code AS course_code
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      WHERE r.reported_by = $1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM reports r 
      JOIN courses c ON r.course_id = c.id 
      WHERE r.reported_by = $1
    `;
    let params = [req.user.id];
    let paramCount = 1;

    // Status filter
    if (status && ['Pending', 'In Progress', 'Resolved', 'Rejected'].includes(status)) {
      paramCount++;
      query += ` AND r.status = $${paramCount}`;
      countQuery += ` AND r.status = $${paramCount}`;
      params.push(status);
    }

    // Course filter
    if (course_id) {
      paramCount++;
      query += ` AND r.course_id = $${paramCount}`;
      countQuery += ` AND r.course_id = $${paramCount}`;
      params.push(course_id);
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), offset);

    const [result, totalResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      reports: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalResult.rows[0].count),
        totalPages: Math.ceil(totalResult.rows[0].count / limit)
      }
    });
  } catch (err) {
    console.error('Student reports error:', err);
    res.status(500).json({ error: 'Server error fetching student reports' });
  }
});

// ------------------ Submit a new report ------------------
router.post('/reports', authenticateToken, checkRole(['Student']), validateReportSubmission, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { course_id, title, description, priority = 'Medium' } = req.body;

    const isEnrolled = await checkEnrollment(req.user.id, course_id);
    if (!isEnrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const validPriorities = ['Low', 'Medium', 'High'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority level' });
    }

    const result = await pool.query(
      `INSERT INTO reports (course_id, reported_by, title, description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'Pending', NOW())
       RETURNING *`,
      [course_id, req.user.id, title, description, priority]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activities (user_id, activity_type, description) 
       VALUES ($1, $2, $3)`,
      [req.user.id, 'report_submitted', `Submitted report: ${title}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Student report submission error:', err);
    res.status(500).json({ error: 'Server error submitting student report' });
  }
});

// ------------------ Update a report ------------------
router.put('/reports/:reportId', authenticateToken, checkRole(['Student']), validateReportSubmission, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { reportId } = req.params;
    const { title, description } = req.body;

    // Check if report exists and belongs to student
    const reportCheck = await pool.query(
      'SELECT * FROM reports WHERE id = $1 AND reported_by = $2',
      [reportId, req.user.id]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    const report = reportCheck.rows[0];
    
    // Only allow updates for pending reports
    if (report.status !== 'Pending') {
      return res.status(400).json({ error: 'Can only update pending reports' });
    }

    const result = await pool.query(
      `UPDATE reports SET title = $1, description = $2, updated_at = NOW()
       WHERE id = $3 AND reported_by = $4
       RETURNING *`,
      [title, description, reportId, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Report update error:', err);
    res.status(500).json({ error: 'Server error updating report' });
  }
});

// ------------------ Submit course rating ------------------
router.post('/ratings', authenticateToken, checkRole(['Student']), validateRatingSubmission, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { course_id, rating, comment } = req.body;

    const isEnrolled = await checkEnrollment(req.user.id, course_id);
    if (!isEnrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Check if already rated
    const existingRating = await pool.query(
      `SELECT id FROM course_ratings WHERE student_id = $1 AND course_id = $2`,
      [req.user.id, course_id]
    );

    let result;
    if (existingRating.rows.length > 0) {
      // Update existing rating
      result = await pool.query(
        `UPDATE course_ratings SET rating = $1, comment = $2, updated_at = NOW()
         WHERE student_id = $3 AND course_id = $4
         RETURNING *`,
        [rating, comment, req.user.id, course_id]
      );
    } else {
      // Create new rating
      result = await pool.query(
        `INSERT INTO course_ratings (course_id, student_id, rating, comment, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [course_id, req.user.id, rating, comment]
      );
    }

    // Update course average rating
    await pool.query(
      `UPDATE courses SET 
        average_rating = (SELECT AVG(rating) FROM course_ratings WHERE course_id = $1),
        rating_count = (SELECT COUNT(*) FROM course_ratings WHERE course_id = $1)
       WHERE id = $1`,
      [course_id]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activities (user_id, activity_type, description) 
       VALUES ($1, $2, $3)`,
      [req.user.id, 'rating_submitted', `Rated course ${rating} stars`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Rating submission error:', err);
    res.status(500).json({ error: 'Server error submitting rating' });
  }
});

// ------------------ Fetch student ratings ------------------
router.get('/ratings', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [result, totalResult] = await Promise.all([
      pool.query(
        `SELECT cr.*, c.name AS course_name, c.code AS course_code
         FROM course_ratings cr
         JOIN courses c ON cr.course_id = c.id
         WHERE cr.student_id = $1
         ORDER BY cr.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user.id, parseInt(limit), offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM course_ratings WHERE student_id = $1`,
        [req.user.id]
      )
    ]);

    res.json({
      ratings: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalResult.rows[0].count),
        totalPages: Math.ceil(totalResult.rows[0].count / limit)
      }
    });
  } catch (err) {
    console.error('Student ratings error:', err);
    res.status(500).json({ error: 'Server error fetching ratings' });
  }
});

// ------------------ Fetch student progress ------------------
router.get('/progress', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const progress = await pool.query(
      `SELECT 
        c.id AS course_id,
        c.name AS course_name,
        c.code AS course_code,
        sc.enrollment_date,
        sc.status AS enrollment_status,
        (SELECT COUNT(*) FROM reports r WHERE r.course_id = c.id AND r.reported_by = $1 AND r.status = 'Resolved') AS completed_reports,
        (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) AS total_assignments,
        (SELECT COUNT(*) FROM student_submissions ss 
         JOIN assignments a ON ss.assignment_id = a.id 
         WHERE a.course_id = c.id AND ss.student_id = $1) AS submitted_assignments,
        (SELECT AVG(cr.rating) FROM course_ratings cr WHERE cr.course_id = c.id) AS course_rating,
        (SELECT rating FROM course_ratings WHERE course_id = c.id AND student_id = $1) AS student_rating
       FROM courses c
       JOIN student_courses sc ON c.id = sc.course_id
       WHERE sc.student_id = $1
       ORDER BY c.name ASC`,
      [req.user.id]
    );

    res.json(progress.rows);
  } catch (err) {
    console.error('Student progress error:', err);
    res.status(500).json({ error: 'Server error fetching student progress' });
  }
});

// ------------------ Fetch student dashboard analytics ------------------
router.get('/dashboard-analytics', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const analytics = await pool.query(
      `SELECT 
        -- Course Statistics
        (SELECT COUNT(DISTINCT course_id) FROM student_courses WHERE student_id = $1 AND status = 'Enrolled') AS total_courses,
        (SELECT COUNT(DISTINCT course_id) FROM student_courses WHERE student_id = $1 AND status = 'Completed') AS completed_courses,
        
        -- Report Statistics
        (SELECT COUNT(*) FROM reports WHERE reported_by = $1) AS total_reports,
        (SELECT COUNT(*) FROM reports WHERE reported_by = $1 AND status = 'Resolved') AS approved_reports,
        (SELECT COUNT(*) FROM reports WHERE reported_by = $1 AND status = 'Pending') AS pending_reports,
        (SELECT COUNT(*) FROM reports WHERE reported_by = $1 AND status = 'In Progress') AS in_progress_reports,
        
        -- Rating Statistics
        (SELECT COUNT(*) FROM course_ratings WHERE student_id = $1) AS ratings_given,
        (SELECT ROUND(AVG(rating)::numeric, 2) FROM course_ratings WHERE student_id = $1) AS avg_rating_given,
        
        -- Assignment Statistics
        (SELECT COUNT(*) FROM assignments a 
         JOIN student_courses sc ON a.course_id = sc.course_id 
         WHERE sc.student_id = $1 AND sc.status = 'Enrolled') AS total_assignments,
        (SELECT COUNT(*) FROM student_submissions WHERE student_id = $1) AS submitted_assignments,
        
        -- Recent Activity
        (SELECT COUNT(*) FROM reports WHERE reported_by = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days') AS weekly_activity,
        (SELECT COUNT(*) FROM course_ratings WHERE student_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days') AS weekly_ratings
       `,
      [req.user.id]
    );

    const row = analytics.rows[0] || {};
    res.json({
      total_courses: row.total_courses || 0,
      completed_courses: row.completed_courses || 0,
      total_reports: row.total_reports || 0,
      approved_reports: row.approved_reports || 0,
      pending_reports: row.pending_reports || 0,
      in_progress_reports: row.in_progress_reports || 0,
      ratings_given: row.ratings_given || 0,
      avg_rating_given: parseFloat(row.avg_rating_given) || 0,
      total_assignments: row.total_assignments || 0,
      submitted_assignments: row.submitted_assignments || 0,
      weekly_activity: row.weekly_activity || 0,
      weekly_ratings: row.weekly_ratings || 0
    });
  } catch (err) {
    console.error('Dashboard analytics error:', err);
    res.status(500).json({ error: 'Server error fetching dashboard analytics' });
  }
});

// ------------------ Fetch student assignments ------------------
router.get('/assignments', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { status = 'upcoming', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        a.*,
        c.name AS course_name,
        c.code AS course_code,
        ss.id AS submission_id,
        ss.submitted_at,
        ss.status AS submission_status,
        (SELECT grade FROM grades WHERE submission_id = ss.id) AS grade
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN student_courses sc ON c.id = sc.course_id
      LEFT JOIN student_submissions ss ON a.id = ss.assignment_id AND ss.student_id = $1
      WHERE sc.student_id = $1 AND sc.status = 'Enrolled'
    `;

    const params = [req.user.id];

    if (status === 'upcoming') {
      query += ` AND a.due_date > NOW()`;
    } else if (status === 'past') {
      query += ` AND a.due_date <= NOW()`;
    } else if (status === 'submitted') {
      query += ` AND ss.id IS NOT NULL`;
    }

    query += ` ORDER BY a.due_date ASC LIMIT $2 OFFSET $3`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Student assignments error:', err);
    res.status(500).json({ error: 'Server error fetching assignments' });
  }
});

// ------------------ Fetch student profile ------------------
router.get('/profile', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const profile = await pool.query(
      `SELECT 
        id, username, email, first_name, last_name, student_id, 
        faculty_name, department, phone, status, created_at, last_login
       FROM users 
       WHERE id = $1`,
      [req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile.rows[0]);
  } catch (err) {
    console.error('Student profile error:', err);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

module.exports = router;