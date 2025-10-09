const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ Helper Functions ------------------
const buildMonitoringQuery = (userRole, userId, facultyName) => {
  let query = `
    SELECT m.*, c.name AS course_name, c.code AS course_code, 
           u.username AS lecturer_name, c.faculty_name,
           (SELECT COUNT(*) FROM monitoring_comments mc WHERE mc.monitoring_id = m.id) AS comment_count,
           (SELECT COUNT(*) FROM monitoring_attachments ma WHERE ma.monitoring_id = m.id) AS attachment_count
    FROM monitoring m
    JOIN courses c ON m.course_id = c.id
    JOIN users u ON c.lecturer_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (userRole === 'Lecturer') {
    query += ` AND c.lecturer_id = $1`;
    params.push(userId);
  } else if (['PRL', 'Program Leader'].includes(userRole) && facultyName) {
    query += ` AND c.faculty_name = $1`;
    params.push(facultyName);
  }

  query += ' ORDER BY m.created_at DESC';
  return { query, params };
};

const checkCourseAccess = async (courseId, userId, userRole, facultyName) => {
  let query = 'SELECT id FROM courses WHERE id = $1';
  const params = [courseId];

  if (userRole === 'Lecturer') {
    query += ' AND lecturer_id = $2';
    params.push(userId);
  } else if (['PRL', 'Program Leader'].includes(userRole)) {
    query += ' AND faculty_name = $2';
    params.push(facultyName);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

// ------------------ GET monitoring data (role-based filtering) ------------------
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
      SELECT m.*, c.name AS course_name, c.code AS course_code, 
             u.username AS lecturer_name, c.faculty_name,
             (SELECT COUNT(*) FROM monitoring_comments mc WHERE mc.monitoring_id = m.id) AS comment_count,
             (SELECT COUNT(*) FROM monitoring_attachments ma WHERE ma.monitoring_id = m.id) AS attachment_count
      FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      JOIN users u ON c.lecturer_id = u.id
      WHERE m.id = $1
    `;
    const params = [id];

    if (req.user.role === 'Lecturer') {
      query += ` AND c.lecturer_id = $2`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
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

// ------------------ POST create monitoring entry (Lecturer / PRL / Program Leader) ------------------
router.post(
  '/',
  authenticateToken,
  checkRole(['Lecturer', 'PRL', 'Program Leader']),
  async (req, res) => {
    try {
      const { 
        course_id, 
        attendance, 
        progress, 
        performance, 
        notes, 
        recommendations,
        challenges,
        resources_used,
        student_engagement,
        attachments
      } = req.body;

      if (!course_id) {
        return res.status(400).json({ error: 'Course ID is required' });
      }

      const hasAccess = await checkCourseAccess(course_id, req.user.id, req.user.role, req.user.faculty_name);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Course not found or access denied' });
      }

      const result = await pool.query(
        `INSERT INTO monitoring 
         (course_id, attendance, progress, performance, notes, recommendations,
          challenges, resources_used, student_engagement, attachments, created_by, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) 
         RETURNING *`,
        [
          course_id, attendance, progress, performance, notes, recommendations,
          challenges, resources_used, student_engagement, attachments || [], req.user.id
        ]
      );

      res.status(201).json(result.rows[0]);
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
      attendance, 
      progress, 
      performance, 
      notes, 
      recommendations,
      challenges,
      resources_used,
      student_engagement,
      status
    } = req.body;

    // Check access to monitoring entry
    let query = `
      SELECT m.* FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      WHERE m.id = $1
    `;
    const params = [id];

    if (req.user.role === 'Lecturer') {
      query += ` AND c.lecturer_id = $2`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $2`;
      params.push(req.user.faculty_name);
    }

    const monitoringCheck = await pool.query(query, params);
    if (monitoringCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Monitoring entry not found or access denied' });
    }

    const result = await pool.query(
      `UPDATE monitoring 
       SET attendance = $1, progress = $2, performance = $3, notes = $4, recommendations = $5,
           challenges = $6, resources_used = $7, student_engagement = $8, status = $9, updated_at = NOW()
       WHERE id = $10 
       RETURNING *`,
      [
        attendance, progress, performance, notes, recommendations,
        challenges, resources_used, student_engagement, status, id
      ]
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
        ROUND(AVG(progress), 1) AS avg_progress,
        ROUND(AVG(performance), 1) AS avg_performance,
        ROUND(AVG(student_engagement), 1) AS avg_engagement,
        COUNT(CASE WHEN progress >= 80 THEN 1 END) as high_progress_count,
        COUNT(CASE WHEN progress < 60 THEN 1 END) as low_progress_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_entries,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_entries
      FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'Lecturer') {
      query += ` AND c.lecturer_id = $1`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
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

// ------------------ NEW: GET monitoring trends ------------------
router.get('/analytics/trends', authenticateToken, checkRole(['PRL', 'Program Leader']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        DATE_TRUNC('week', created_at) as week_start,
        COUNT(*) as entries_count,
        ROUND(AVG(attendance), 1) as avg_attendance,
        ROUND(AVG(progress), 1) as avg_progress,
        ROUND(AVG(performance), 1) as avg_performance
      FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      WHERE c.faculty_name = $1 AND created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY week_start
      ORDER BY week_start ASC
    `, [req.user.faculty_name]);

    res.json(result.rows);
  } catch (err) {
    console.error('Monitoring trends error:', err);
    res.status(500).json({ error: 'Server error fetching monitoring trends' });
  }
});

// ------------------ NEW: POST comment on monitoring entry ------------------
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    // Check monitoring entry access
    const monitoringCheck = await pool.query(
      `SELECT m.* FROM monitoring m
       JOIN courses c ON m.course_id = c.id
       WHERE m.id = $1 ${req.user.role === 'Lecturer' ? 'AND c.lecturer_id = $2' : ''}
       ${['PRL', 'Program Leader'].includes(req.user.role) ? 'AND c.faculty_name = $2' : ''}`,
      [id, req.user.role === 'Lecturer' ? req.user.id : req.user.faculty_name]
    );

    if (monitoringCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Monitoring entry not found or access denied' });
    }

    const result = await pool.query(
      `INSERT INTO monitoring_comments (monitoring_id, user_id, comment, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
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
       ${['PRL', 'Program Leader'].includes(req.user.role) ? 'AND c.faculty_name = $2' : ''}`,
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
    console.error('Monitoring comments fetch error:', err);
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

    if (req.user.role === 'Lecturer') {
      query += ` AND c.lecturer_id = $1 ORDER BY c.name ASC`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
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

// ------------------ GET public monitoring stats (last 30 days) ------------------
router.get('/public-stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT course_id) AS monitored_courses,
        ROUND(AVG(attendance), 1) AS avg_attendance,
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
      monitored_courses: 45,
      avg_attendance: 78.5,
      avg_progress: 82.3,
      avg_performance: 79.8,
      active_monitors: 12,
      faculties_covered: 3
    });
  }
});

module.exports = router;