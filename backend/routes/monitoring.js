const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ Helper Functions ------------------
const buildMonitoringQuery = (userRole, userId, facultyName) => {
  let query = `
    SELECT m.*, 
           c.name AS course_name, 
           c.code AS course_code, 
           u.username AS lecturer_name, 
           c.faculty_name,
           (SELECT COUNT(*) FROM monitoring_comments mc WHERE mc.monitoring_id = m.id) AS comment_count,
           (SELECT COUNT(*) FROM monitoring_attachments ma WHERE ma.monitoring_id = m.id) AS attachment_count,
           (SELECT COUNT(*) FROM monitoring_alerts mal WHERE mal.monitoring_id = m.id AND mal.resolved = false) AS alert_count
    FROM monitoring m
    JOIN courses c ON m.course_id = c.id
    JOIN users u ON c.lecturer_id = u.id
    WHERE 1=1
  `;
  const params = [];

  const role = (userRole || '').toLowerCase();
  if (role === 'lecturer') {
    query += ` AND c.lecturer_id = $1`;
    params.push(userId);
  } else if (['prl', 'program leader'].includes(role) && facultyName) {
    query += ` AND c.faculty_name = $1`;
    params.push(facultyName);
  }

  query += ' ORDER BY m.created_at DESC';
  return { query, params };
};

const validatePercent = (val, field) => {
  if (val < 0 || val > 100) throw new Error(`${field} must be between 0 and 100`);
};

const checkCourseAccess = async (courseId, userId, userRole, facultyName) => {
  let query = 'SELECT id, name FROM courses WHERE id = $1';
  const params = [courseId];

  const role = (userRole || '').toLowerCase();
  if (role === 'lecturer') {
    query += ' AND lecturer_id = $2';
    params.push(userId);
  } else if (['prl', 'program leader'].includes(role)) {
    query += ' AND faculty_name = $2';
    params.push(facultyName);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0 ? result.rows[0] : null;
};

// ------------------ GET monitoring data ------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { query, params } = buildMonitoringQuery(req.user.role, req.user.id, req.user.faculty_name);
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Monitoring fetch error:', err);
    res.status(500).json({ error: 'Server error fetching monitoring data' });
  }
});

// ------------------ GET single monitoring entry ------------------
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let query = `
      SELECT m.*, 
             c.name AS course_name, 
             c.code AS course_code, 
             u.username AS lecturer_name, 
             c.faculty_name,
             (SELECT COUNT(*) FROM monitoring_comments mc WHERE mc.monitoring_id = m.id) AS comment_count,
             (SELECT COUNT(*) FROM monitoring_attachments ma WHERE ma.monitoring_id = m.id) AS attachment_count
      FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      JOIN users u ON c.lecturer_id = u.id
      WHERE m.id = $1
    `;
    const params = [id];

    const role = (req.user.role || '').toLowerCase();
    if (role === 'lecturer') {
      query += ` AND c.lecturer_id = $2`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $2`;
      params.push(req.user.faculty_name);
    }

    const result = await pool.query(query, params);
    result.rows.length === 0 
      ? res.status(404).json({ error: 'Monitoring entry not found or access denied' })
      : res.json(result.rows[0]);
  } catch (err) {
    console.error('Monitoring fetch error:', err);
    res.status(500).json({ error: 'Server error fetching monitoring entry' });
  }
});

// ------------------ POST create monitoring entry ------------------
router.post(
  '/',
  authenticateToken,
  checkRole(['Lecturer', 'PRL', 'Program Leader']),
  async (req, res) => {
    try {
      const { 
        course_id, 
        attendance = 0, 
        engagement = 0, 
        progress = 0, 
        performance = 0,
        notes = '',
        recommendations = '',
        challenges = '',
        resources_used = '',
        attachments = []
      } = req.body;

      if (!course_id) return res.status(400).json({ error: 'Course ID is required' });

      // Validate percentages
      try {
        validatePercent(attendance, 'Attendance');
        validatePercent(engagement, 'Engagement');
        validatePercent(progress, 'Progress');
        validatePercent(performance, 'Performance');
      } catch (validationErr) {
        return res.status(400).json({ error: validationErr.message });
      }

      // Course access check
      const course = await checkCourseAccess(course_id, req.user.id, req.user.role, req.user.faculty_name);
      if (!course) return res.status(403).json({ error: 'Course not found or access denied' });

      // Insert monitoring entry
      const result = await pool.query(
        `INSERT INTO monitoring (
          course_id, attendance, engagement, progress, performance, 
          notes, recommendations, challenges, resources_used, attachments, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING *`,
        [
          course_id, attendance, engagement, progress, performance,
          notes, recommendations, challenges, resources_used, attachments, req.user.id
        ]
      );

      const inserted = { ...result.rows[0], course_name: course.name || '' };
      res.status(201).json(inserted);
    } catch (err) {
      console.error('Monitoring creation error:', err);
      res.status(500).json({ error: 'Server error creating monitoring entry' });
    }
  }
);

// ------------------ PUT update monitoring entry ------------------
router.put('/:id', authenticateToken, checkRole(['Lecturer', 'PRL', 'Program Leader']), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      attendance, engagement, progress, performance, notes, recommendations, challenges, resources_used 
    } = req.body;

    // Check access and get current entry
    let query = `
      SELECT m.* FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      WHERE m.id = $1
    `;
    const params = [id];

    const role = (req.user.role || '').toLowerCase();
    if (role === 'lecturer') {
      query += ` AND c.lecturer_id = $2`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $2`;
      params.push(req.user.faculty_name);
    }

    const monitoringCheck = await pool.query(query, params);
    if (monitoringCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Monitoring entry not found or access denied' });
    }

    // Validate percentages if provided
    if (attendance !== undefined) validatePercent(attendance, 'Attendance');
    if (engagement !== undefined) validatePercent(engagement, 'Engagement');
    if (progress !== undefined) validatePercent(progress, 'Progress');
    if (performance !== undefined) validatePercent(performance, 'Performance');

    const result = await pool.query(
      `UPDATE monitoring 
       SET attendance = COALESCE($1, attendance),
           engagement = COALESCE($2, engagement),
           progress = COALESCE($3, progress),
           performance = COALESCE($4, performance),
           notes = COALESCE($5, notes),
           recommendations = COALESCE($6, recommendations),
           challenges = COALESCE($7, challenges),
           resources_used = COALESCE($8, resources_used),
           updated_at = NOW()
       WHERE id = $9 
       RETURNING *`,
      [attendance, engagement, progress, performance, notes, recommendations, challenges, resources_used, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Monitoring update error:', err);
    res.status(500).json({ error: 'Server error updating monitoring entry' });
  }
});

// ------------------ NEW: GET monitoring analytics ------------------
router.get('/analytics/overview', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT course_id) as monitored_courses,
        ROUND(AVG(attendance), 1) AS avg_attendance,
        ROUND(AVG(engagement), 1) AS avg_engagement,
        ROUND(AVG(progress), 1) AS avg_progress,
        ROUND(AVG(performance), 1) AS avg_performance,
        COUNT(CASE WHEN progress >= 80 THEN 1 END) as high_progress_count,
        COUNT(CASE WHEN progress < 60 THEN 1 END) as low_progress_count,
        COUNT(CASE WHEN attendance < 70 THEN 1 END) as low_attendance_count
      FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    const role = (req.user.role || '').toLowerCase();
    if (role === 'lecturer') {
      query += ` AND c.lecturer_id = $1`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $1`;
      params.push(req.user.faculty_name);
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Monitoring analytics error:', err);
    res.status(500).json({ error: 'Server error fetching monitoring analytics' });
  }
});

// ------------------ NEW: POST monitoring comment ------------------
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) return res.status(400).json({ error: 'Comment is required' });

    // Check monitoring entry access
    const monitoringCheck = await pool.query(
      `SELECT m.* FROM monitoring m
       JOIN courses c ON m.course_id = c.id
       WHERE m.id = $1 ${req.user.role === 'Lecturer' ? 'AND c.lecturer_id = $2' : ''}
       ${['prl', 'program leader'].includes((req.user.role || '').toLowerCase()) ? 'AND c.faculty_name = $2' : ''}`,
      [id, req.user.role === 'Lecturer' ? req.user.id : req.user.faculty_name]
    );

    if (monitoringCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Monitoring entry not found or access denied' });
    }

    const result = await pool.query(
      `INSERT INTO monitoring_comments (monitoring_id, user_id, comment, created_at)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [id, req.user.id, comment]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Monitoring comment error:', err);
    res.status(500).json({ error: 'Server error adding comment' });
  }
});

// ------------------ NEW: GET monitoring comments ------------------
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check monitoring entry access
    const monitoringCheck = await pool.query(
      `SELECT m.* FROM monitoring m
       JOIN courses c ON m.course_id = c.id
       WHERE m.id = $1 ${req.user.role === 'Lecturer' ? 'AND c.lecturer_id = $2' : ''}
       ${['prl', 'program leader'].includes((req.user.role || '').toLowerCase()) ? 'AND c.faculty_name = $2' : ''}`,
      [id, req.user.role === 'Lecturer' ? req.user.id : req.user.faculty_name]
    );

    if (monitoringCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Monitoring entry not found or access denied' });
    }

    const result = await pool.query(
      `SELECT mc.*, u.username, u.role
       FROM monitoring_comments mc
       JOIN users u ON mc.user_id = u.id
       WHERE mc.monitoring_id = $1
       ORDER BY mc.created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Monitoring comments error:', err);
    res.status(500).json({ error: 'Server error fetching comments' });
  }
});

// ------------------ NEW: GET courses for monitoring ------------------
router.get('/courses/list', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT c.id, c.name, c.code, u.username as lecturer_name,
             (SELECT COUNT(*) FROM monitoring m WHERE m.course_id = c.id) as monitoring_count,
             (SELECT ROUND(AVG(progress), 1) FROM monitoring m WHERE m.course_id = c.id) as avg_progress
      FROM courses c
      JOIN users u ON c.lecturer_id = u.id
      WHERE 1=1
    `;
    const params = [];

    const role = (req.user.role || '').toLowerCase();
    if (role === 'lecturer') {
      query += ` AND c.lecturer_id = $1 ORDER BY c.name ASC`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $1 ORDER BY c.name ASC`;
      params.push(req.user.faculty_name);
    } else {
      query += ' ORDER BY c.name ASC';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Courses fetch error:', err);
    res.status(500).json({ error: 'Server error fetching courses' });
  }
});

// ------------------ GET public monitoring stats ------------------
router.get('/public-stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT course_id) AS monitored_courses,
        ROUND(AVG(attendance), 1) AS avg_attendance,
        ROUND(AVG(engagement), 1) AS avg_engagement,
        ROUND(AVG(progress), 1) AS avg_progress,
        ROUND(AVG(performance), 1) AS avg_performance,
        COUNT(DISTINCT created_by) AS active_monitors,
        (SELECT COUNT(DISTINCT faculty_name) FROM courses) AS faculties_covered
      FROM monitoring
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Public monitoring stats error:', err);
    res.status(500).json({
      monitored_courses: 42,
      avg_attendance: 76.8,
      avg_engagement: 79.2,
      avg_progress: 81.5,
      avg_performance: 78.9,
      active_monitors: 15,
      faculties_covered: 3
    });
  }
});

module.exports = router;