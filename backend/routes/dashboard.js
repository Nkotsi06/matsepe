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

// ------------------ GET public dashboard data ------------------
router.get('/', async (req, res) => {
  console.log('Dashboard public route accessed');
  
  try {
    // === USERS DATA ===
    const [usersData, coursesData, reportsData, ratingsData, studentCoursesData] = await Promise.all([
      // Users by role
      pool.query('SELECT role, COUNT(*) AS count FROM users WHERE status = $1 GROUP BY role', ['Active']),
      
      // Courses statistics
      pool.query(`
        SELECT 
          COUNT(*) AS total, 
          COUNT(*) FILTER (WHERE status = 'Active') AS active,
          COUNT(DISTINCT faculty_name) AS faculties,
          COUNT(DISTINCT lecturer_id) AS total_lecturers
        FROM courses
      `),
      
      // Reports statistics
      pool.query(`
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'Pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'Resolved') AS resolved,
          COUNT(*) FILTER (WHERE status = 'Rejected') AS rejected
        FROM reports
      `),
      
      // Ratings data
      pool.query(`
        SELECT 
          COUNT(*) AS total_ratings,
          ROUND(AVG(rating), 1) AS avg_rating,
          COUNT(DISTINCT course_id) AS courses_rated
        FROM course_ratings
      `),
      
      // Student enrollment data
      pool.query(`
        SELECT 
          COUNT(*) AS total_enrollments,
          COUNT(DISTINCT student_id) AS unique_students,
          COUNT(*) FILTER (WHERE status = 'Enrolled') AS active_enrollments
        FROM student_courses
      `)
    ]);

    const rolesCount = formatRoleCounts(usersData.rows);
    const courses = coursesData.rows[0];
    const reports = reportsData.rows[0];
    const ratings = ratingsData.rows[0];
    const enrollments = studentCoursesData.rows[0];

    // === ATTENDANCE DATA (Alternative approach using available data) ===
    // Since we don't have class_attendance table, we'll calculate based on student activity
    const activityData = await pool.query(`
      SELECT 
        COUNT(DISTINCT student_id) as active_students,
        (SELECT COUNT(DISTINCT student_id) FROM users WHERE role = 'Student' AND status = 'Active') as total_students
      FROM (
        SELECT student_id FROM course_ratings WHERE created_at >= NOW() - INTERVAL '30 days'
        UNION 
        SELECT reported_by as student_id FROM reports WHERE created_at >= NOW() - INTERVAL '30 days'
        UNION
        SELECT student_id FROM student_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
      ) AS active_users
    `);

    const activity = activityData.rows[0];
    const engagementRate = activity.total_students > 0 
      ? Math.round((activity.active_students / activity.total_students) * 100) 
      : 0;

    // === TOP RATED COURSES ===
    const topRatedCourses = await pool.query(`
      SELECT 
        c.id,
        c.name, 
        c.code,
        u.username AS lecturer, 
        ROUND(AVG(cr.rating),1) AS rating, 
        COUNT(cr.id) AS total_ratings,
        c.faculty_name
      FROM course_ratings cr
      JOIN courses c ON cr.course_id = c.id
      LEFT JOIN users u ON c.lecturer_id = u.id
      GROUP BY c.id, u.username, c.faculty_name
      HAVING COUNT(cr.id) >= 1
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
        JOIN users u ON r.reported_by = u.id
        ORDER BY r.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT 
          'rating' as type,
          cr.id,
          CONCAT('Rating for ', c.name) as title,
          cr.created_at,
          c.name as course_name,
          u.username as author_name,
          'completed' as status
        FROM course_ratings cr
        JOIN courses c ON cr.course_id = c.id
        JOIN users u ON cr.student_id = u.id
        ORDER BY cr.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT 
          'enrollment' as type,
          sc.id,
          CONCAT('Enrolled in ', c.name) as title,
          sc.enrollment_date as created_at,
          c.name as course_name,
          u.username as author_name,
          sc.status
        FROM student_courses sc
        JOIN courses c ON sc.course_id = c.id
        JOIN users u ON sc.student_id = u.id
        ORDER BY sc.enrollment_date DESC
        LIMIT 5
      )
      ORDER BY created_at DESC
      LIMIT 8
    `);

    // === PERFORMANCE METRICS ===
    const performanceMetrics = await pool.query(`
      SELECT 
        'engagement' as metric,
        $1 as value,
        'percentage' as unit
      UNION ALL
      SELECT 
        'satisfaction' as metric,
        ROUND(AVG(rating), 1) as value,
        'stars' as unit
      FROM course_ratings
      WHERE created_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 
        'completion' as metric,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'Resolved') * 100.0 / NULLIF(COUNT(*), 0)
        ), 1) as value,
        'percentage' as unit
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 
        'enrollment' as metric,
        COUNT(DISTINCT student_id) as value,
        'students' as unit
      FROM student_courses
      WHERE enrollment_date >= NOW() - INTERVAL '30 days'
    `, [engagementRate]);

    // === ALERTS AND NOTIFICATIONS ===
    const alerts = [];

    // Low engagement alerts (alternative to attendance)
    if (engagementRate < 50) {
      alerts.push({
        type: 'warning',
        title: 'Low Student Engagement',
        message: `Only ${engagementRate}% of students are active`,
        time: 'Recent',
        priority: 'medium'
      });
    }

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
      SELECT c.name, ROUND(AVG(cr.rating),1) as avg_rating
      FROM course_ratings cr
      JOIN courses c ON cr.course_id = c.id
      GROUP BY c.id, c.name
      HAVING AVG(cr.rating) < 2.5 AND COUNT(cr.id) >= 3
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

    // Courses without lecturers alert
    const coursesWithoutLecturers = await pool.query(`
      SELECT COUNT(*) as count
      FROM courses 
      WHERE lecturer_id IS NULL AND status = 'Active'
    `);

    if (parseInt(coursesWithoutLecturers.rows[0].count) > 0) {
      alerts.push({
        type: 'warning',
        title: 'Courses Need Lecturers',
        message: `${coursesWithoutLecturers.rows[0].count} active courses without assigned lecturers`,
        time: 'Needs assignment',
        priority: 'medium'
      });
    }

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
          (SELECT AVG(rating) FROM course_ratings cr WHERE cr.course_id = c.id)
        ), 1) as avg_rating
      FROM courses c
      WHERE faculty_name IS NOT NULL AND status = 'Active'
      GROUP BY faculty_name
      ORDER BY course_count DESC
    `);

    // === GRADES STATISTICS ===
    const gradesStats = await pool.query(`
      SELECT 
        ROUND(AVG(grade), 1) as average_grade,
        COUNT(*) as total_grades,
        COUNT(DISTINCT student_id) as students_graded
      FROM grades g
      JOIN student_submissions ss ON g.submission_id = ss.id
      WHERE g.created_at >= NOW() - INTERVAL '30 days'
    `);

    const grades = gradesStats.rows[0];

    // === SUBMISSION STATISTICS ===
    const submissionStats = await pool.query(`
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(DISTINCT student_id) as active_submitters,
        COUNT(DISTINCT assignment_id) as assignments_with_submissions
      FROM student_submissions
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const submissions = submissionStats.rows[0];

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
        faculties: parseInt(courses?.faculties || 0),
        totalLecturers: parseInt(courses?.total_lecturers || 0)
      },
      
      reports: {
        total: parseInt(reports?.total || 0),
        pending: parseInt(reports?.pending || 0),
        resolved: parseInt(reports?.resolved || 0),
        rejected: parseInt(reports?.rejected || 0),
        completionRate: reports?.total ? Math.round((reports.resolved / reports.total) * 100) : 0
      },
      
      // Enhanced Metrics
      engagement: {
        rate: engagementRate,
        activeStudents: parseInt(activity?.active_students || 0),
        totalStudents: parseInt(activity?.total_students || 0)
      },
      
      ratings: {
        total: parseInt(ratings?.total_ratings || 0),
        average: parseFloat(ratings?.avg_rating) || 0,
        coursesRated: parseInt(ratings?.courses_rated || 0)
      },
      
      enrollments: {
        total: parseInt(enrollments?.total_enrollments || 0),
        uniqueStudents: parseInt(enrollments?.unique_students || 0),
        active: parseInt(enrollments?.active_enrollments || 0)
      },
      
      grades: {
        average: parseFloat(grades?.average_grade) || 0,
        total: parseInt(grades?.total_grades || 0),
        studentsGraded: parseInt(grades?.students_graded || 0)
      },

      submissions: {
        total: parseInt(submissions?.total_submissions || 0),
        activeSubmitters: parseInt(submissions?.active_submitters || 0),
        assignmentsWithSubmissions: parseInt(submissions?.assignments_with_submissions || 0)
      },
      
      // Performance and Highlights
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
      dataRange: 'Last 30 days',
      systemStatus: 'Operational'
    });

  } catch (err) {
    console.error('Dashboard fetch error:', err);
    
    // Fallback data that doesn't depend on missing tables
    res.json({
      totalUsers: { 
        students: 0, lecturers: 0, principalLecturers: 0, programLeaders: 0, total: 0 
      },
      courses: { total: 0, active: 0, faculties: 0, totalLecturers: 0 },
      reports: { total: 0, pending: 0, resolved: 0, rejected: 0, completionRate: 0 },
      engagement: { rate: 0, activeStudents: 0, totalStudents: 0 },
      ratings: { total: 0, average: 0, coursesRated: 0 },
      enrollments: { total: 0, uniqueStudents: 0, active: 0 },
      grades: { average: 0, total: 0, studentsGraded: 0 },
      submissions: { total: 0, activeSubmitters: 0, assignmentsWithSubmissions: 0 },
      performanceMetrics: [],
      highlights: {
        topRatedCourses: [],
        recentActivity: [],
        facultyDistribution: [],
        alerts: [{
          type: 'info',
          title: 'System Initializing',
          message: 'Dashboard data loading...',
          time: 'Setup',
          priority: 'low'
        }]
      },
      lastUpdated: new Date().toISOString(),
      dataRange: 'N/A',
      systemStatus: 'Initializing'
    });
  }
});

module.exports = router;