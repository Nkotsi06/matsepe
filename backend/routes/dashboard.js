const express = require('express');
const pool = require('../db');

const router = express.Router();

// ------------------ Helper Functions ------------------
const formatRoleCounts = (rows) => {
  const counts = { students: 0, lecturers: 0, principalLecturers: 0, programLeaders: 0 };
  rows.forEach(r => {
    const role = (r.role || '').trim().toLowerCase();
    if (role === 'student') counts.students = parseInt(r.count, 10);
    else if (role === 'lecturer') counts.lecturers = parseInt(r.count, 10);
    else if (role === 'prl') counts.principalLecturers = parseInt(r.count, 10);
    else if (role === 'program leader') counts.programLeaders = parseInt(r.count, 10);
  });
  return counts;
};

const calculateTrend = (current, previous) => {
  if (current > previous) return 'increasing';
  if (current < previous) return 'decreasing';
  return 'stable';
};

// ------------------ GET public dashboard data ------------------
router.get('/', async (req, res) => {
  console.log('Dashboard public route accessed');
  
  try {
    // === USERS DATA ===
    const [usersData, coursesData, reportsData, attendanceData, ratingsData, monitoringData] = await Promise.all([
      // Users by role
      pool.query('SELECT role, COUNT(*) AS count FROM users GROUP BY role'),
      
      // Courses statistics
      pool.query(`
        SELECT 
          COUNT(*) AS total, 
          COUNT(*) FILTER (WHERE active = true) AS active,
          COUNT(DISTINCT faculty_name) AS faculties
        FROM courses
      `),
      
      // Reports statistics
      pool.query(`
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'approved') AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
        FROM reports
      `),
      
      // Attendance data
      pool.query(`
        SELECT 
          ROUND(AVG(attendance),1) AS current_avg,
          ROUND(AVG(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN attendance END),1) AS monthly_avg
        FROM monitoring
      `),
      
      // Ratings data
      pool.query(`
        SELECT 
          COUNT(*) AS total_ratings,
          ROUND(AVG(rating), 1) AS avg_rating,
          COUNT(DISTINCT course_id) AS courses_rated
        FROM ratings
      `),
      
      // Monitoring statistics
      pool.query(`
        SELECT 
          COUNT(*) AS total_entries,
          COUNT(DISTINCT course_id) AS monitored_courses,
          ROUND(AVG(progress), 1) AS avg_progress,
          ROUND(AVG(performance), 1) AS avg_performance
        FROM monitoring
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `)
    ]);

    const rolesCount = formatRoleCounts(usersData.rows);
    const courses = coursesData.rows[0];
    const reports = reportsData.rows[0];
    const attendance = attendanceData.rows[0];
    const ratings = ratingsData.rows[0];
    const monitoring = monitoringData.rows[0];

    // === TOP RATED COURSES ===
    const topRatedCourses = await pool.query(`
      SELECT 
        c.id,
        c.name, 
        c.code,
        u.username AS lecturer, 
        ROUND(AVG(r.rating),1) AS rating, 
        COUNT(r.id) AS total_ratings,
        c.faculty_name
      FROM ratings r
      JOIN courses c ON r.course_id = c.id
      JOIN users u ON c.lecturer_id = u.id
      GROUP BY c.id, u.username, c.faculty_name
      HAVING COUNT(r.id) >= 3
      ORDER BY rating DESC, total_ratings DESC
      LIMIT 6
    `);

    // === RECENT ACTIVITY ===
    const recentActivity = await pool.query(`
      (
        SELECT 
          'report' as type,
          r.id,
          r.title,
          r.created_at,
          c.name as course_name,
          u.username as author_name,
          r.status
        FROM reports r
        JOIN courses c ON r.course_id = c.id
        JOIN users u ON r.lecturer_id = u.id
        ORDER BY r.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT 
          'rating' as type,
          ra.id,
          CONCAT('Rating for ', c.name) as title,
          ra.created_at,
          c.name as course_name,
          u.username as author_name,
          'completed' as status
        FROM ratings ra
        JOIN courses c ON ra.course_id = c.id
        JOIN users u ON ra.user_id = u.id
        ORDER BY ra.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT 
          'monitoring' as type,
          m.id,
          'Monitoring Entry' as title,
          m.created_at,
          c.name as course_name,
          u.username as author_name,
          'completed' as status
        FROM monitoring m
        JOIN courses c ON m.course_id = c.id
        JOIN users u ON m.created_by = u.id
        ORDER BY m.created_at DESC
        LIMIT 5
      )
      ORDER BY created_at DESC
      LIMIT 8
    `);

    // === PERFORMANCE METRICS ===
    const performanceMetrics = await pool.query(`
      SELECT 
        'attendance' as metric,
        ROUND(AVG(attendance), 1) as value,
        'percentage' as unit
      FROM monitoring
      WHERE created_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 
        'satisfaction' as metric,
        ROUND(AVG(rating), 1) as value,
        'stars' as unit
      FROM ratings
      WHERE created_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 
        'completion' as metric,
        ROUND((COUNT(*) FILTER (WHERE status = 'approved') * 100.0 / NULLIF(COUNT(*), 0)), 1) as value,
        'percentage' as unit
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 
        'engagement' as metric,
        ROUND(AVG(engagement), 1) as value,
        'percentage' as unit
      FROM monitoring
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // === ALERTS AND NOTIFICATIONS ===
    const alerts = [];

    // Low attendance alerts
    const lowAttendance = await pool.query(`
      SELECT c.name, m.attendance, m.created_at
      FROM monitoring m
      JOIN courses c ON m.course_id = c.id
      WHERE m.attendance < 60
        AND m.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY m.attendance ASC
      LIMIT 3
    `);

    lowAttendance.rows.forEach(row => {
      alerts.push({
        type: 'warning',
        title: 'Low Attendance',
        message: `${row.name} has ${row.attendance}% attendance`,
        time: 'Recent',
        priority: 'medium'
      });
    });

    // Pending reports alert
    if (parseInt(reports.pending) > 5) {
      alerts.push({
        type: 'info',
        title: 'Pending Reports',
        message: `${reports.pending} reports awaiting review`,
        time: 'Now',
        priority: 'low'
      });
    }

    // Low rated courses alert
    const lowRatedCourses = await pool.query(`
      SELECT c.name, ROUND(AVG(r.rating),1) as avg_rating
      FROM ratings r
      JOIN courses c ON r.course_id = c.id
      GROUP BY c.id, c.name
      HAVING AVG(r.rating) < 2.5 AND COUNT(r.id) >= 5
      LIMIT 2
    `);

    lowRatedCourses.rows.forEach(row => {
      alerts.push({
        type: 'danger',
        title: 'Low Course Rating',
        message: `${row.name} has ${row.avg_rating}★ average rating`,
        time: 'Needs attention',
        priority: 'high'
      });
    });

    // System status alert
    if (alerts.length === 0) {
      alerts.push({
        type: 'success',
        title: 'System Status',
        message: 'All systems operational',
        time: 'Current',
        priority: 'low'
      });
    }

    // === FACULTY DISTRIBUTION ===
    const facultyDistribution = await pool.query(`
      SELECT 
        faculty_name,
        COUNT(*) as course_count,
        COUNT(DISTINCT lecturer_id) as lecturer_count,
        ROUND(AVG(
          (SELECT AVG(rating) FROM ratings r WHERE r.course_id = c.id)
        ), 1) as avg_rating
      FROM courses c
      WHERE faculty_name IS NOT NULL
      GROUP BY faculty_name
      ORDER BY course_count DESC
    `);

    console.log('Dashboard data fetched successfully');

    // Compile final response
    res.json({
      // Core Statistics
      totalUsers: {
        ...rolesCount,
        total: Object.values(rolesCount).reduce((sum, count) => sum + count, 0)
      },
      
      courses: {
        total: parseInt(courses?.total || 0),
        active: parseInt(courses?.active || 0),
        faculties: parseInt(courses?.faculties || 0)
      },
      
      reports: {
        total: parseInt(reports?.total || 0),
        pending: parseInt(reports?.pending || 0),
        approved: parseInt(reports?.approved || 0),
        rejected: parseInt(reports?.rejected || 0),
        completionRate: reports?.total ? Math.round((reports.approved / reports.total) * 100) : 0
      },
      
      // Enhanced Metrics
      attendance: {
        average: parseFloat(attendance?.current_avg) || 0,
        monthlyAverage: parseFloat(attendance?.monthly_avg) || 0,
        trend: calculateTrend(
          parseFloat(attendance?.current_avg) || 0,
          parseFloat(attendance?.monthly_avg) || 0
        )
      },
      
      ratings: {
        total: parseInt(ratings?.total_ratings || 0),
        average: parseFloat(ratings?.avg_rating) || 0,
        coursesRated: parseInt(ratings?.courses_rated || 0)
      },
      
      monitoring: {
        totalEntries: parseInt(monitoring?.total_entries || 0),
        monitoredCourses: parseInt(monitoring?.monitored_courses || 0),
        avgProgress: parseFloat(monitoring?.avg_progress) || 0,
        avgPerformance: parseFloat(monitoring?.avg_performance) || 0
      },
      
      // New Features
      performanceMetrics: performanceMetrics.rows,
      
      highlights: {
        topRatedCourses: topRatedCourses.rows,
        recentActivity: recentActivity.rows,
        facultyDistribution: facultyDistribution.rows,
        alerts: alerts.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
      },
      
      // System Info
      lastUpdated: new Date().toISOString(),
      dataRange: 'Last 30 days'
    });

  } catch (err) {
    console.error('Dashboard fetch error:', err);
    
    // Fallback data
    res.status(500).json({
      totalUsers: { 
        students: 0, lecturers: 0, principalLecturers: 0, programLeaders: 0, total: 0 
      },
      courses: { total: 0, active: 0, faculties: 0 },
      reports: { total: 0, pending: 0, approved: 0, rejected: 0, completionRate: 0 },
      attendance: { average: 0, monthlyAverage: 0, trend: 'stable' },
      ratings: { total: 0, average: 0, coursesRated: 0 },
      monitoring: { totalEntries: 0, monitoredCourses: 0, avgProgress: 0, avgPerformance: 0 },
      performanceMetrics: [],
      highlights: {
        topRatedCourses: [],
        recentActivity: [],
        facultyDistribution: [],
        alerts: [{
          type: 'danger',
          title: 'System Error',
          message: 'Unable to load dashboard data',
          time: 'Now',
          priority: 'high'
        }]
      },
      lastUpdated: new Date().toISOString(),
      dataRange: 'N/A',
      error: 'Server error while fetching dashboard data'
    });
  }
});

module.exports = router;