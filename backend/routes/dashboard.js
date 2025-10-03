const express = require('express');
const pool = require('../db');
// Remove the auth middleware import
// const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Remove authenticateToken middleware - make this route public
router.get('/', async (req, res) => {
  console.log('Dashboard public route accessed'); // Add logging for debugging
  try {
    // === USERS ===
    const usersData = await pool.query(`
      SELECT role, COUNT(*) AS count
      FROM users
      GROUP BY role
    `);

    const rolesCount = { students: 0, lecturers: 0, principalLecturers: 0, programLeaders: 0 };
    usersData.rows.forEach(r => {
      const role = (r.role || '').trim().toLowerCase();
      if (role === 'student') rolesCount.students = parseInt(r.count, 10);
      else if (role === 'lecturer') rolesCount.lecturers = parseInt(r.count, 10);
      else if (role === 'prl') rolesCount.principalLecturers = parseInt(r.count, 10);
      else if (role === 'program leader') rolesCount.programLeaders = parseInt(r.count, 10);
    });

    // === COURSES ===
    const courses = await pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE active = true) AS active FROM courses');
    const totalCourses = parseInt(courses.rows[0]?.total || 0, 10);
    const activeCourses = parseInt(courses.rows[0]?.active || 0, 10);

    // === REPORTS ===
    const reports = await pool.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'pending') AS pending,
             COUNT(*) FILTER (WHERE status = 'approved') AS approved
      FROM reports
    `);
    const totalReports = parseInt(reports.rows[0]?.total || 0, 10);
    const pendingReports = parseInt(reports.rows[0]?.pending || 0, 10);
    const approvedReports = parseInt(reports.rows[0]?.approved || 0, 10);

    // === ATTENDANCE ===
    const attendance = await pool.query('SELECT ROUND(AVG(attendance),1) AS average FROM monitoring');
    const avgAttendance = parseFloat(attendance.rows[0]?.average) || 0;

    // === TOP RATED COURSES ===
    const topRatedCourses = await pool.query(`
      SELECT c.name, u.username AS lecturer, ROUND(AVG(r.rating),1) AS rating, COUNT(r.id) AS totalratings
      FROM ratings r
      JOIN courses c ON r.course_id = c.id
      JOIN users u ON c.lecturer_id = u.id
      GROUP BY c.id, u.username
      ORDER BY rating DESC 
      LIMIT 3
    `);

    // === ALERTS ===
    const alerts = [];

    // Low attendance alerts
    const lowAttendanceQuery = `
      SELECT c.name, m.attendance
      FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      WHERE m.attendance < 60
        AND m.created_at >= NOW() - INTERVAL '7 days'
      LIMIT 5
    `;
    const lowAttendance = await pool.query(lowAttendanceQuery);
    lowAttendance.rows.forEach(row => {
      alerts.push({
        type: 'warning',
        title: 'Low Attendance Alert',
        message: `Course "${row.name}" has ${row.attendance}% attendance`,
        time: 'Recent'
      });
    });

    // General pending reports alert
    const pendingReportsCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM reports
      WHERE status = 'pending'
    `);

    if (pendingReportsCount.rows[0].count > 0) {
      alerts.push({
        type: 'info',
        title: 'Pending Reports',
        message: `There are ${pendingReportsCount.rows[0].count} reports awaiting review`,
        time: 'Now'
      });
    }

    // If no alerts, add a default "all good" message
    if (alerts.length === 0) {
      alerts.push({
        type: 'success',
        title: 'All Systems Operational',
        message: 'No critical issues detected',
        time: 'Current'
      });
    }

    console.log('Dashboard data fetched successfully'); // Debug log

    res.json({
      totalUsers: rolesCount,
      courses: { total: totalCourses, active: activeCourses },
      reports: { total: totalReports, pending: pendingReports, approved: approvedReports, missing: 0 }, // Added missing field for frontend
      attendance: { average: avgAttendance, trend: avgAttendance > 75 ? 'increasing' : avgAttendance < 50 ? 'decreasing' : 'stable' },
      highlights: { 
        topRatedCourses: topRatedCourses.rows || [], 
        alerts: alerts 
      }
    });

  } catch (err) {
    console.error('Dashboard fetch error:', err);
    res.status(500).json({
      totalUsers: { students: 0, lecturers: 0, principalLecturers: 0, programLeaders: 0 },
      courses: { total: 0, active: 0 },
      reports: { total: 0, pending: 0, approved: 0, missing: 0 },
      attendance: { average: 0, trend: 'stable' },
      highlights: { topRatedCourses: [], alerts: [] },
      error: 'Server error while fetching dashboard data: ' + err.message
    });
  }
});

module.exports = router;