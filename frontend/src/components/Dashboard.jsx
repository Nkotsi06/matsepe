import React, { useState, useEffect } from 'react';
import { Badge, Alert, Card, Row, Col } from 'react-bootstrap';
import axios from 'axios';

const API_BASE_URL = 'https://matsepe.onrender.com/api';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    totalUsers: { students: 0, lecturers: 0, principalLecturers: 0, programLeaders: 0, fmg: 0 },
    courses: { total: 0, active: 0, inactive: 0 },
    reports: { total: 0, pending: 0, approved: 0, rejected: 0, inReview: 0 },
    attendance: { average: 0, trend: 'stable', present: 0, absent: 0 },
    recentActivities: [],
    topRatedCourses: [],
    performance: { responseTime: 0, uptime: 0, satisfaction: 0 },
    reportWorkflow: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get user data from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }, []);

  // Role-based welcome message
  const getRoleBasedWelcome = () => {
    if (!user) return "Welcome to LUCT Faculty Reporting Dashboard";
    
    const roleMap = {
      'student': 'Student',
      'lecturer': 'Lecturer', 
      'principalLecturer': 'PRL',
      'programLeader': 'Program Leader',
      'fmg': 'FMG'
    };
    
    const roleName = roleMap[user.role] || user.role;
    const userName = user.name || user.username || '';
    return `Welcome, ${roleName} ${userName}`.trim() + '!';
  };

  // Role-based quick actions
  const getRoleBasedActions = () => {
    if (!user) return [
      { label: 'Submit Report', variant: 'primary' },
      { label: 'View Courses', variant: 'outline-primary' },
      { label: 'Check Ratings', variant: 'outline-primary' },
      { label: 'System Help', variant: 'outline-primary' }
    ];

    const actions = {
      student: [
        { label: 'Report Complaint', variant: 'primary' },
        { label: 'Self-Rate Courses', variant: 'outline-primary' },
        { label: 'View My Reports', variant: 'outline-primary' },
        { label: 'Export Records', variant: 'outline-primary' }
      ],
      lecturer: [
        { label: 'Submit Report', variant: 'primary' },
        { label: 'My Courses', variant: 'outline-primary' },
        { label: 'View Ratings', variant: 'outline-primary' },
        { label: 'Performance', variant: 'outline-primary' }
      ],
      principalLecturer: [
        { label: 'Review Reports', variant: 'primary' },
        { label: 'Lecturer Performance', variant: 'outline-primary' },
        { label: 'Department Overview', variant: 'outline-primary' },
        { label: 'Analytics', variant: 'outline-primary' }
      ],
      programLeader: [
        { label: 'Assign Courses', variant: 'primary' },
        { label: 'Review Reports', variant: 'outline-primary' },
        { label: 'Program Management', variant: 'outline-primary' },
        { label: 'Multi-Department', variant: 'outline-primary' }
      ],
      fmg: [
        { label: 'Institutional Reports', variant: 'primary' },
        { label: 'Analytics Overview', variant: 'outline-primary' },
        { label: 'Performance Trends', variant: 'outline-primary' },
        { label: 'Export Data', variant: 'outline-primary' }
      ]
    };

    return actions[user.role] || actions.student;
  };

  // Fetch all dashboard data from API
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch all data in parallel
      const [
        usersResponse,
        coursesResponse,
        reportsResponse,
        attendanceResponse,
        activitiesResponse,
        ratingsResponse,
        performanceResponse,
        workflowResponse
      ] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/users/stats`, { headers, timeout: 10000 }),
        axios.get(`${API_BASE_URL}/courses/stats`, { headers, timeout: 10000 }),
        axios.get(`${API_BASE_URL}/reports/stats`, { headers, timeout: 10000 }),
        axios.get(`${API_BASE_URL}/attendance/stats`, { headers, timeout: 10000 }),
        axios.get(`${API_BASE_URL}/activities/recent`, { headers, timeout: 10000 }),
        axios.get(`${API_BASE_URL}/courses/top-rated`, { headers, timeout: 10000 }),
        axios.get(`${API_BASE_URL}/system/performance`, { headers, timeout: 10000 }),
        axios.get(`${API_BASE_URL}/reports/workflow`, { headers, timeout: 10000 })
      ]);

      // Process responses and handle failures gracefully
      const processedData = {
        totalUsers: usersResponse.status === 'fulfilled' ? usersResponse.value.data : { students: 0, lecturers: 0, principalLecturers: 0, programLeaders: 0, fmg: 0 },
        courses: coursesResponse.status === 'fulfilled' ? coursesResponse.value.data : { total: 0, active: 0, inactive: 0 },
        reports: reportsResponse.status === 'fulfilled' ? reportsResponse.value.data : { total: 0, pending: 0, approved: 0, rejected: 0, inReview: 0 },
        attendance: attendanceResponse.status === 'fulfilled' ? attendanceResponse.value.data : { average: 0, trend: 'stable', present: 0, absent: 0 },
        recentActivities: activitiesResponse.status === 'fulfilled' ? activitiesResponse.value.data : [],
        topRatedCourses: ratingsResponse.status === 'fulfilled' ? ratingsResponse.value.data : [],
        performance: performanceResponse.status === 'fulfilled' ? performanceResponse.value.data : { responseTime: 0, uptime: 0, satisfaction: 0 },
        reportWorkflow: workflowResponse.status === 'fulfilled' ? workflowResponse.value.data : []
      };

      setDashboardData(processedData);

      // Log any failed API calls for debugging
      const failedCalls = [
        usersResponse.status === 'rejected' && 'Users Stats',
        coursesResponse.status === 'rejected' && 'Courses Stats',
        reportsResponse.status === 'rejected' && 'Reports Stats',
        attendanceResponse.status === 'rejected' && 'Attendance Stats',
        activitiesResponse.status === 'rejected' && 'Recent Activities',
        ratingsResponse.status === 'rejected' && 'Top Rated Courses',
        performanceResponse.status === 'rejected' && 'System Performance',
        workflowResponse.status === 'rejected' && 'Report Workflow'
      ].filter(Boolean);

      if (failedCalls.length > 0) {
        console.warn('Some API calls failed:', failedCalls);
      }

    } catch (err) {
      console.error('Dashboard fetch error:', err);
      let errorMessage = 'Failed to load dashboard data. ';
      
      if (err.code === 'ECONNREFUSED') {
        errorMessage += 'Server is not running or connection refused.';
      } else if (err.response) {
        errorMessage += `Server error: ${err.response.status} - ${err.response.data?.error || 'Unknown error'}`;
      } else if (err.request) {
        errorMessage += 'No response from server. Check if backend is running.';
      } else {
        errorMessage += err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Safe data destructuring with defaults
  const { 
    totalUsers, 
    courses, 
    reports, 
    attendance, 
    recentActivities, 
    topRatedCourses, 
    performance, 
    reportWorkflow 
  } = dashboardData;

  // Safe calculations
  const totalUsersCount = (totalUsers?.students || 0) + 
                         (totalUsers?.lecturers || 0) + 
                         (totalUsers?.principalLecturers || 0) + 
                         (totalUsers?.programLeaders || 0) + 
                         (totalUsers?.fmg || 0);

  const renderLoadingCard = (index) => (
    <div key={index} className="dash-card">
      <div className="dashboard-loading" style={{ height: '100%' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    </div>
  );

  const renderChartBar = (value, maxValue, color) => {
    const safeValue = Number(value) || 0;
    const safeMaxValue = Number(maxValue) || 1;
    const percentage = safeMaxValue > 0 ? (safeValue / safeMaxValue) * 100 : 0;
    return (
      <div className="chart-bar-container">
        <div 
          className="chart-bar-fill"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: color
          }}
        ></div>
      </div>
    );
  };

  // Handle quick action clicks
  const handleQuickAction = (actionLabel) => {
    // Implement navigation or modal opening based on action
    console.log('Quick action clicked:', actionLabel);
    // You can add navigation logic here based on the action
  };

  return (
    <div className="main-container">
      <div className="content-wrapper">
        {/* Header */}
        <div className="dashboard-header mb-4">
          <div className="header-content">
            <div>
              <h1 className="dashboard-title">LUCT Faculty Reporting Dashboard</h1>
              <p className="welcome-text">{getRoleBasedWelcome()}</p>
            </div>
            {user && (
              <div className="user-info-section">
                <Badge bg="primary" className="user-role-badge">
                  {user.role || 'User'}
                </Badge>
                <small className="login-time">
                  Last login: {new Date().toLocaleDateString()}
                </small>
              </div>
            )}
          </div>
        </div>

        {/* Error alert */}
        {error && (
          <Alert variant="danger" className="alert-custom mb-4">
            {error}
            <div className="mt-2">
              <button 
                className="btn btn-sm btn-outline-danger"
                onClick={fetchDashboardData}
              >
                Retry Loading Data
              </button>
            </div>
          </Alert>
        )}

        {/* Dashboard cards */}
        <div className="dashboard-cards">
          {loading && !error ? (
            [...Array(6)].map((_, index) => renderLoadingCard(index))
          ) : (
            <>
              {/* Total Users Card */}
              <div className="dash-card stats-card">
                <div className="card-body">
                  <h3>Total Users</h3>
                  <div className="metric-value-large">{totalUsersCount}</div>
                  <div className="user-breakdown-grid">
                    <div className="breakdown-item">
                      <span className="breakdown-count">{totalUsers?.students || 0}</span>
                      <span className="breakdown-label">Students</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-count">{totalUsers?.lecturers || 0}</span>
                      <span className="breakdown-label">Lecturers</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-count">{totalUsers?.principalLecturers || 0}</span>
                      <span className="breakdown-label">PRLs</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-count">{totalUsers?.programLeaders || 0}</span>
                      <span className="breakdown-label">PLs</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-count">{totalUsers?.fmg || 0}</span>
                      <span className="breakdown-label">FMG</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Courses Card */}
              <div className="dash-card stats-card">
                <div className="card-body">
                  <h3>Courses</h3>
                  <div className="metric-value-large">{courses?.total || 0}</div>
                  <div className="breakdown-simple">
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count active">{courses?.active || 0}</span>
                      <span className="breakdown-label">Active</span>
                    </div>
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count inactive">{courses?.inactive || 0}</span>
                      <span className="breakdown-label">Inactive</span>
                    </div>
                  </div>
                  {renderChartBar(courses?.active || 0, courses?.total || 1, '#1E2A39')}
                </div>
              </div>

              {/* Reports Card */}
              <div className="dash-card stats-card">
                <div className="card-body">
                  <h3>Reports</h3>
                  <div className="metric-value-large">{reports?.total || 0}</div>
                  <div className="breakdown-simple">
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count total">{reports?.total || 0}</span>
                      <span className="breakdown-label">Total</span>
                    </div>
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count pending">{reports?.pending || 0}</span>
                      <span className="breakdown-label">Pending</span>
                    </div>
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count approved">{reports?.approved || 0}</span>
                      <span className="breakdown-label">Approved</span>
                    </div>
                  </div>
                  <div className="reports-chart">
                    {(reports?.total || 0) > 0 && (
                      <>
                        {renderChartBar(reports?.pending || 0, reports?.total || 1, '#F5F1E6')}
                        {renderChartBar(reports?.approved || 0, reports?.total || 1, '#28a745')}
                        {renderChartBar(reports?.rejected || 0, reports?.total || 1, '#dc3545')}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Attendance Card */}
              <div className="dash-card stats-card">
                <div className="card-body">
                  <h3>Attendance</h3>
                  <div className="metric-value-large">{attendance?.average || 0}%</div>
                  <div className="attendance-trend">
                    <Badge bg={attendance?.trend === 'up' ? 'success' : attendance?.trend === 'down' ? 'danger' : 'secondary'}>
                      {attendance?.trend || 'stable'}
                    </Badge>
                  </div>
                  <div className="attendance-breakdown">
                    <div className="attendance-item">
                      <span>Present: {attendance?.present || 0}</span>
                      <span>Absent: {attendance?.absent || 0}</span>
                    </div>
                  </div>
                  {renderChartBar(attendance?.average || 0, 100, '#1E2A39')}
                </div>
              </div>

              {/* System Status Card */}
              <div className="dash-card stats-card">
                <div className="card-body">
                  <h3>System Status</h3>
                  <div className="metric-value-large">
                    <Badge bg={performance?.uptime > 90 ? "success" : performance?.uptime > 70 ? "warning" : "danger"}>
                      {performance?.uptime > 90 ? "Optimal" : performance?.uptime > 70 ? "Stable" : "Degraded"}
                    </Badge>
                  </div>
                  <div className="system-info">
                    <p>Uptime: {performance?.uptime || 0}%</p>
                    <small className="text-muted">Last updated: {new Date().toLocaleTimeString()}</small>
                  </div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="dash-card">
                <div className="card-body">
                  <h3>Quick Actions</h3>
                  <div className="quick-actions">
                    {getRoleBasedActions().map((action, index) => (
                      <button 
                        key={index}
                        className={`btn btn-${action.variant} btn-sm mb-2 w-100 quick-action-btn`}
                        onClick={() => handleQuickAction(action.label)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Report Workflow Section */}
        {!loading && reportWorkflow && reportWorkflow.length > 0 && (
          <Row className="mt-4">
            <Col md={8}>
              <Card className="form-card">
                <Card.Header>
                  <h5 className="mb-0">Report Workflow Status</h5>
                </Card.Header>
                <Card.Body>
                  <div className="workflow-container">
                    {reportWorkflow.map((stage, index) => (
                      <div key={index} className="workflow-stage">
                        <div className="stage-header">
                          <span className="stage-name">{stage.stage}</span>
                          <span className="stage-count">{stage.count}/{stage.total}</span>
                        </div>
                        <div className="stage-progress">
                          {renderChartBar(stage.count, stage.total, stage.color || '#1E2A39')}
                        </div>
                        <div className="stage-percentage">
                          {Math.round((stage.count / (stage.total || 1)) * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="form-card">
                <Card.Header>
                  <h5 className="mb-0">System Performance</h5>
                </Card.Header>
                <Card.Body>
                  <div className="performance-metrics">
                    <div className="performance-item">
                      <span className="metric-label">Response Time</span>
                      <div className="metric-bar">
                        <div 
                          className="metric-fill excellent" 
                          style={{width: `${performance?.responseTime || 0}%`}}
                        ></div>
                      </div>
                      <span className="metric-value">{performance?.responseTime || 0}%</span>
                    </div>
                    <div className="performance-item">
                      <span className="metric-label">System Uptime</span>
                      <div className="metric-bar">
                        <div 
                          className="metric-fill good" 
                          style={{width: `${performance?.uptime || 0}%`}}
                        ></div>
                      </div>
                      <span className="metric-value">{performance?.uptime || 0}%</span>
                    </div>
                    <div className="performance-item">
                      <span className="metric-label">User Satisfaction</span>
                      <div className="metric-bar">
                        <div 
                          className="metric-fill excellent" 
                          style={{width: `${performance?.satisfaction || 0}%`}}
                        ></div>
                      </div>
                      <span className="metric-value">{performance?.satisfaction || 0}%</span>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Additional Data Sections */}
        {!loading && (
          <Row className="mt-4">
            <Col md={6}>
              <Card className="form-card">
                <Card.Header>
                  <h5 className="mb-0">Recent Activities</h5>
                </Card.Header>
                <Card.Body>
                  <div className="activity-list">
                    {recentActivities && recentActivities.length > 0 ? (
                      recentActivities.slice(0, 5).map((activity, index) => (
                        <div key={index} className="activity-item">
                          <div className="activity-content">
                            <p className="mb-1">{activity.message || 'No message'}</p>
                            <small className="text-muted">
                              {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Unknown time'}
                            </small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted">No recent activity</p>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="form-card">
                <Card.Header>
                  <h5 className="mb-0">Top Rated Courses</h5>
                </Card.Header>
                <Card.Body>
                  {topRatedCourses && topRatedCourses.length > 0 ? (
                    topRatedCourses.slice(0, 3).map((course, index) => (
                      <div key={index} className="course-item mb-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong>{course.name || 'Unnamed Course'}</strong>
                            <br />
                            <small className="text-muted">by {course.lecturer || 'Unknown Lecturer'}</small>
                          </div>
                          <Badge bg="success" className="rating-badge">
                            {course.rating || 0}/5
                          </Badge>
                        </div>
                        <div className="rating-stars mt-1">
                          {'★'.repeat(Math.floor(course.rating || 0))}
                          {'☆'.repeat(5 - Math.floor(course.rating || 0))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted">No rating data available</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </div>
    </div>
  );
};

export default Dashboard;