const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ Helper Functions ------------------
const validateDate = (date) => {
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
};

const checkEnrollment = async (studentId, courseId) => {
  const result = await pool.query(
    `SELECT 1 FROM enrollment WHERE student_id = $1 AND course_id = $2`,
    [studentId, courseId]
  );
  return result.rows.length > 0;
};

// ------------------ Fetch enrolled courses for a student ------------------
router.get('/courses', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username AS lecturer_name,
              (SELECT COUNT(*) FROM student_reports sr WHERE sr.course_id = c.id AND sr.student_id = $1) AS report_count,
              (SELECT AVG(rating) FROM ratings WHERE course_id = c.id) AS avg_rating
       FROM courses c
       JOIN enrollment e ON c.id = e.course_id
       LEFT JOIN users u ON c.lecturer_id = u.id
       WHERE e.student_id = $1
       ORDER BY c.name ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Student courses error:', err);
    res.status(500).json({ error: 'Server error fetching student courses' });
  }
});

// ------------------ Fetch public statistics ------------------
router.get('/public-statistics', async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(DISTINCT id) FROM users WHERE role = 'Student') AS active_students,
        (SELECT COUNT(DISTINCT id) FROM courses) AS courses,
        (SELECT COUNT(DISTINCT id) FROM reports WHERE created_at >= NOW() - INTERVAL '1 month') AS monthly_reports,
        (SELECT COUNT(DISTINCT id) FROM ratings) AS total_ratings,
        (SELECT AVG(rating) FROM ratings) AS avg_satisfaction,
        '24/7' AS access_status`
    );
    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Public statistics error:', err);
    res.status(500).json({ 
      active_students: 1500,
      courses: 85,
      monthly_reports: 320,
      total_ratings: 4500,
      avg_satisfaction: 4.2,
      access_status: '24/7'
    });
  }
});

// ------------------ Fetch student reports ------------------
router.get('/reports', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name AS course_name, c.code AS course_code,
              r.status, r.feedback, r.grade,
              (SELECT COUNT(*) FROM report_comments rc WHERE rc.report_id = r.id) AS comment_count
       FROM reports r
       JOIN courses c ON r.course_id = c.id
       JOIN enrollment e ON r.course_id = e.course_id
       WHERE e.student_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Student reports error:', err);
    res.status(500).json({ error: 'Server error fetching student reports' });
  }
});

// ------------------ Fetch student-specific statistics ------------------
router.get('/statistics', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(DISTINCT e.course_id) FROM enrollment e WHERE e.student_id = $1) AS courses,
        (SELECT COUNT(DISTINCT r.id) FROM reports r JOIN enrollment e ON r.course_id = e.course_id WHERE e.student_id = $1 AND r.created_at >= NOW() - INTERVAL '1 month') AS monthly_reports,
        (SELECT COUNT(DISTINCT sr.id) FROM student_reports sr WHERE sr.student_id = $1) AS total_reports,
        (SELECT AVG(r.rating) FROM ratings r JOIN courses c ON r.course_id = c.id JOIN enrollment e ON c.id = e.course_id WHERE e.student_id = $1) AS avg_rating,
        (SELECT COUNT(DISTINCT r.id) FROM reports r JOIN enrollment e ON r.course_id = e.course_id WHERE e.student_id = $1 AND r.status = 'approved') AS approved_reports,
        '24/7' AS access_status`,
      [req.user.id]
    );

    res.json({
      courses: stats.rows[0].courses,
      monthlyReports: stats.rows[0].monthly_reports,
      totalReports: stats.rows[0].total_reports,
      avgRating: stats.rows[0].avg_rating || 0,
      approvedReports: stats.rows[0].approved_reports,
      accessStatus: stats.rows[0].access_status
    });
  } catch (err) {
    console.error('Student statistics error:', err);
    res.status(500).json({ error: 'Server error fetching student statistics' });
  }
});

// ------------------ Submit a new report (Student) ------------------
router.post('/reports', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { course_id, report_type, title, description, date, attachments } = req.body;

    if (!course_id || !report_type || !title || !description || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!validateDate(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const isEnrolled = await checkEnrollment(req.user.id, course_id);
    if (!isEnrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    const result = await pool.query(
      `INSERT INTO student_reports (course_id, student_id, report_type, title, description, date, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [course_id, req.user.id, report_type, title, description, date, attachments || []]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Student report submission error:', err);
    res.status(500).json({ error: 'Server error submitting student report' });
  }
});

// ------------------ NEW: Submit course rating ------------------
router.post('/ratings', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { course_id, rating, comment, is_anonymous } = req.body;

    if (!course_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid course_id and rating (1-5) are required' });
    }

    const isEnrolled = await checkEnrollment(req.user.id, course_id);
    if (!isEnrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Check if already rated
    const existingRating = await pool.query(
      `SELECT id FROM ratings WHERE student_id = $1 AND course_id = $2`,
      [req.user.id, course_id]
    );

    let result;
    if (existingRating.rows.length > 0) {
      // Update existing rating
      result = await pool.query(
        `UPDATE ratings SET rating = $1, comment = $2, is_anonymous = $3, updated_at = NOW()
         WHERE student_id = $4 AND course_id = $5
         RETURNING *`,
        [rating, comment, is_anonymous || false, req.user.id, course_id]
      );
    } else {
      // Create new rating
      result = await pool.query(
        `INSERT INTO ratings (course_id, student_id, rating, comment, is_anonymous, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [course_id, req.user.id, rating, comment, is_anonymous || false]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Rating submission error:', err);
    res.status(500).json({ error: 'Server error submitting rating' });
  }
});

// ------------------ NEW: Fetch student ratings ------------------
router.get('/ratings', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name AS course_name, c.code AS course_code
       FROM ratings r
       JOIN courses c ON r.course_id = c.id
       WHERE r.student_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Student ratings error:', err);
    res.status(500).json({ error: 'Server error fetching student ratings' });
  }
});

// ------------------ NEW: Fetch student progress ------------------
router.get('/progress', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const progress = await pool.query(
      `SELECT 
        c.id AS course_id,
        c.name AS course_name,
        c.code AS course_code,
        (SELECT COUNT(*) FROM reports r WHERE r.course_id = c.id AND r.student_id = $1 AND r.status = 'approved') AS completed_reports,
        (SELECT COUNT(*) FROM course_requirements cr WHERE cr.course_id = c.id) AS total_requirements,
        (SELECT AVG(r.rating) FROM ratings r WHERE r.course_id = c.id) AS course_rating
       FROM courses c
       JOIN enrollment e ON c.id = e.course_id
       WHERE e.student_id = $1
       ORDER BY c.name ASC`,
      [req.user.id]
    );

    res.json(progress.rows);
  } catch (err) {
    console.error('Student progress error:', err);
    res.status(500).json({ error: 'Server error fetching student progress' });
  }
});

// ------------------ NEW: Fetch student dashboard analytics ------------------
router.get('/dashboard-analytics', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const analytics = await pool.query(
      `SELECT 
        -- Course Statistics
        (SELECT COUNT(DISTINCT course_id) FROM enrollment WHERE student_id = $1) AS total_courses,
        (SELECT COUNT(DISTINCT course_id) FROM reports WHERE student_id = $1 AND status = 'approved') AS completed_courses,
        
        -- Report Statistics
        (SELECT COUNT(*) FROM reports WHERE student_id = $1) AS total_reports,
        (SELECT COUNT(*) FROM reports WHERE student_id = $1 AND status = 'approved') AS approved_reports,
        (SELECT COUNT(*) FROM reports WHERE student_id = $1 AND status = 'pending') AS pending_reports,
        
        -- Rating Statistics
        (SELECT COUNT(*) FROM ratings WHERE student_id = $1) AS ratings_given,
        (SELECT AVG(rating) FROM ratings WHERE student_id = $1) AS avg_rating_given,
        
        -- Recent Activity
        (SELECT COUNT(*) FROM reports WHERE student_id = $1 AND created_at >= NOW() - INTERVAL '7 days') AS weekly_activity
       `,
      [req.user.id]
    );

    res.json(analytics.rows[0]);
  } catch (err) {
    console.error('Dashboard analytics error:', err);
    res.status(500).json({ error: 'Server error fetching dashboard analytics' });
  }
});

// ------------------ NEW: Fetch course details with analytics ------------------
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
        (SELECT COUNT(*) FROM reports r WHERE r.course_id = c.id AND r.student_id = $1) AS student_reports,
        (SELECT AVG(rating) FROM ratings WHERE course_id = c.id) AS avg_rating,
        (SELECT COUNT(*) FROM ratings WHERE course_id = c.id) AS rating_count,
        (SELECT COUNT(DISTINCT student_id) FROM enrollment WHERE course_id = c.id) AS total_students
       FROM courses c
       LEFT JOIN users u ON c.lecturer_id = u.id
       WHERE c.id = $2`,
      [req.user.id, courseId]
    );

    if (courseDetails.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(courseDetails.rows[0]);
  } catch (err) {
    console.error('Course details error:', err);
    res.status(500).json({ error: 'Server error fetching course details' });
  }
});

module.exports = router;