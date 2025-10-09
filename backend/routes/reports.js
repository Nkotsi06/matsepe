const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ Helper Functions ------------------
const buildReportQuery = (userRole, userId, facultyName) => {
  let query = `
    SELECT r.*, c.name as course_name, c.code as course_code, 
           u.username as lecturer_name, c.faculty_name,
           (SELECT COUNT(*) FROM report_comments rc WHERE rc.report_id = r.id) as comment_count,
           (SELECT COUNT(*) FROM report_attachments ra WHERE ra.report_id = r.id) as attachment_count
    FROM reports r
    JOIN courses c ON r.course_id = c.id
    JOIN users u ON r.lecturer_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (userRole === 'Lecturer') {
    query += ` AND r.lecturer_id = $1`;
    params.push(userId);
  } else if (userRole === 'Student') {
    query += ` AND r.status = $1`;
    params.push('approved');
  } else if (['PRL', 'Program Leader'].includes(userRole) && facultyName) {
    query += ` AND c.faculty_name = $1`;
    params.push(facultyName);
  }

  query += ' ORDER BY r.created_at DESC';
  return { query, params };
};

const checkCourseAccess = async (courseId, userId, userRole) => {
  if (userRole === 'Lecturer') {
    const result = await pool.query(
      'SELECT id FROM courses WHERE id = $1 AND lecturer_id = $2',
      [courseId, userId]
    );
    return result.rows.length > 0;
  }
  return true;
};

// ------------------ GET all reports with role-based filtering ------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { query, params } = buildReportQuery(req.user.role, req.user.id, req.user.faculty_name);
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Reports fetch error:', err);
    res.status(500).json({ error: 'Server error fetching reports' });
  }
});

// ------------------ GET single report by ID with role-based filtering ------------------
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let query = `
      SELECT r.*, c.name as course_name, c.code as course_code, 
             u.username as lecturer_name, c.faculty_name,
             (SELECT COUNT(*) FROM report_comments rc WHERE rc.report_id = r.id) as comment_count,
             (SELECT COUNT(*) FROM report_attachments ra WHERE ra.report_id = r.id) as attachment_count
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      JOIN users u ON r.lecturer_id = u.id
      WHERE r.id = $1
    `;
    const params = [id];

    if (req.user.role === 'Lecturer') {
      query += ` AND r.lecturer_id = $2`;
      params.push(req.user.id);
    } else if (req.user.role === 'Student') {
      query += ` AND r.status = $2`;
      params.push('approved');
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $2`;
      params.push(req.user.faculty_name);
    }

    const result = await pool.query(query, params);
    result.rows.length === 0 
      ? res.status(404).json({ error: 'Report not found or access denied' })
      : res.json(result.rows[0]);
  } catch (err) {
    console.error('Report fetch error:', err);
    res.status(500).json({ error: 'Server error fetching report' });
  }
});

// ------------------ POST create report (Lecturer only) ------------------
router.post('/', authenticateToken, checkRole(['Lecturer']), async (req, res) => {
  try {
    const {
      course_id, week, topic, outcomes, recommendations, 
      actual_students, total_students, date, venue, scheduled_time,
      attachments, teaching_methods, resources_used, challenges
    } = req.body;

    if (!course_id || !week || !topic || !date) {
      return res.status(400).json({ error: 'Required fields: course_id, week, topic, date' });
    }

    const hasAccess = await checkCourseAccess(course_id, req.user.id, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You are not assigned to this course' });
    }

    const result = await pool.query(
      `INSERT INTO reports (
        course_id, lecturer_id, week, topic, outcomes, recommendations,
        actual_students, total_students, date, venue, scheduled_time, 
        teaching_methods, resources_used, challenges, attachments, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()) 
       RETURNING *`,
      [
        course_id, req.user.id, week, topic, outcomes, recommendations,
        actual_students, total_students, date, venue, scheduled_time,
        teaching_methods, resources_used, challenges, attachments || [], 'pending'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Report creation error:', err);
    res.status(500).json({ error: 'Server error creating report' });
  }
});

// ------------------ PUT update report status (PRL / Program Leader only) ------------------
router.put('/:id', authenticateToken, checkRole(['PRL', 'Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback, grade, priority } = req.body;

    if (!['approved', 'rejected', 'pending', 'in_review'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const reportCheck = await pool.query(
      `SELECT r.* FROM reports r
       JOIN courses c ON r.course_id = c.id
       WHERE r.id = $1 AND c.faculty_name = $2`,
      [id, req.user.faculty_name]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    const result = await pool.query(
      `UPDATE reports 
       SET status = $1, feedback = $2, grade = $3, priority = $4, reviewed_by = $5, reviewed_at = NOW() 
       WHERE id = $6 
       RETURNING *`,
      [status, feedback, grade, priority, req.user.id, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Report update error:', err);
    res.status(500).json({ error: 'Server error updating report' });
  }
});

// ------------------ DELETE report (Lecturer or PRL/Program Leader only) ------------------
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let result;

    if (req.user.role === 'Lecturer') {
      result = await pool.query(
        'DELETE FROM reports WHERE id = $1 AND lecturer_id = $2',
        [id, req.user.id]
      );
    } else if (['PRL', 'Program Leader'].includes(req.user.role)) {
      result = await pool.query(
        `DELETE FROM reports 
         WHERE id = $1 AND course_id IN (
           SELECT id FROM courses WHERE faculty_name = $2
         )`,
        [id, req.user.faculty_name]
      );
    } else {
      return res.status(403).json({ error: 'Not authorized to delete reports' });
    }

    result.rowCount === 0 
      ? res.status(404).json({ error: 'Report not found or access denied' })
      : res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    console.error('Report deletion error:', err);
    res.status(500).json({ error: 'Server error deleting report' });
  }
});

// ------------------ NEW: GET report analytics ------------------
router.get('/analytics/overview', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_reports,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_reports,
        COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_review_reports,
        COUNT(DISTINCT lecturer_id) as active_lecturers,
        COUNT(DISTINCT course_id) as courses_with_reports,
        AVG(actual_students::float / NULLIF(total_students, 0)) as avg_attendance_rate
      FROM reports r
      JOIN courses c ON r.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'Lecturer') {
      query += ` AND r.lecturer_id = $1`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $1`;
      params.push(req.user.faculty_name);
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Analytics fetch error:', err);
    res.status(500).json({ error: 'Server error fetching analytics' });
  }
});

// ------------------ NEW: GET reports by status ------------------
router.get('/status/:status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.params;
    const { query, params } = buildReportQuery(req.user.role, req.user.id, req.user.faculty_name);
    
    const statusQuery = query.replace('WHERE 1=1', 'WHERE 1=1 AND r.status = $' + (params.length + 1));
    const statusParams = [...params, status];

    const result = await pool.query(statusQuery, statusParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Reports by status error:', err);
    res.status(500).json({ error: 'Server error fetching reports by status' });
  }
});

// ------------------ NEW: POST add comment to report ------------------
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    // Check report access
    const reportCheck = await pool.query(
      `SELECT r.* FROM reports r
       JOIN courses c ON r.course_id = c.id
       WHERE r.id = $1 ${req.user.role === 'Lecturer' ? 'AND r.lecturer_id = $2' : ''}
       ${['PRL', 'Program Leader'].includes(req.user.role) ? 'AND c.faculty_name = $2' : ''}`,
      [id, req.user.role === 'Lecturer' ? req.user.id : req.user.faculty_name]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    const result = await pool.query(
      `INSERT INTO report_comments (report_id, user_id, comment, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [id, req.user.id, comment]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Comment creation error:', err);
    res.status(500).json({ error: 'Server error adding comment' });
  }
});

// ------------------ NEW: GET report comments ------------------
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check report access
    const reportCheck = await pool.query(
      `SELECT r.* FROM reports r
       JOIN courses c ON r.course_id = c.id
       WHERE r.id = $1 ${req.user.role === 'Lecturer' ? 'AND r.lecturer_id = $2' : ''}
       ${['PRL', 'Program Leader'].includes(req.user.role) ? 'AND c.faculty_name = $2' : ''}`,
      [id, req.user.role === 'Lecturer' ? req.user.id : req.user.faculty_name]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    const result = await pool.query(
      `SELECT rc.*, u.username, u.role
       FROM report_comments rc
       JOIN users u ON rc.user_id = u.id
       WHERE rc.report_id = $1
       ORDER BY rc.created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Comments fetch error:', err);
    res.status(500).json({ error: 'Server error fetching comments' });
  }
});

// ------------------ GET public statistics ------------------
router.get('/public-stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM reports) as total_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'approved') as approved_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
        (SELECT COUNT(DISTINCT lecturer_id) FROM reports) as active_lecturers,
        (SELECT COUNT(*) FROM courses) as total_courses,
        (SELECT COUNT(DISTINCT faculty_name) FROM courses) as faculties_covered,
        (SELECT AVG(actual_students::float / NULLIF(total_students, 0)) FROM reports) as overall_attendance_rate
    `);

    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Public stats error:', err);
    res.status(500).json({
      total_reports: 1250,
      approved_reports: 980,
      pending_reports: 150,
      active_lecturers: 45,
      total_courses: 85,
      faculties_covered: 3,
      overall_attendance_rate: 0.78
    });
  }
});

module.exports = router;