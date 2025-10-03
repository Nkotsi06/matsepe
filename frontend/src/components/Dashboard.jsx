import React, { useState, useEffect } from 'react';
import { Badge, Alert } from 'react-bootstrap';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000/api/dashboard';

const Dashboard = () => {
  const initialData = {
    totalUsers: { students: 0, lecturers: 0, principalLecturers: 0, programLeaders: 0 },
    courses: { total: 0, active: 0 },
    reports: { total: 0, pending: 0, missing: 0 },
    attendance: { average: 0, trend: 'stable' },
    highlights: { topRatedCourses: [], alerts: [] } 
  };

  const [dashboardData, setDashboardData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching dashboard data from:', API_BASE_URL); // Debug log
      const response = await axios.get(API_BASE_URL, {
        timeout: 10000,
      });

      console.log('Dashboard data received:', response.data); // Debug log

      const filteredData = {
        ...response.data,
        highlights: {
          topRatedCourses: response.data.highlights?.topRatedCourses || [],
          alerts: response.data.highlights?.alerts || [],
        },
      };

      setDashboardData(filteredData);

    } catch (err) {
      console.error('Dashboard fetch error:', err); // Debug log
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
      setDashboardData(initialData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ... rest of your component remains the same
  const { totalUsers, courses, reports, attendance, highlights } = dashboardData;
  const totalUsersCount = totalUsers.students + totalUsers.lecturers + totalUsers.principalLecturers + totalUsers.programLeaders;

  const renderLoadingCard = (index) => (
    <div key={index} className="dash-card">
      <div className="dashboard-loading" style={{ height: '100%' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="main-container">
      <div className="content-wrapper">
        {/* Header */}
        <div className="dashboard-header mb-4">
          <div className="header-content">
            <h1 className="dashboard-title">LUCT Faculty Reporting Dashboard</h1>
            <p className="welcome-text">Comprehensive overview of faculty performance and metrics</p>
          </div>
        </div>

        {/* Error alert */}
        {error && (
          <Alert variant="danger" className="alert-custom mb-4">
            {error}
          </Alert>
        )}

        {/* Dashboard cards - your existing JSX remains the same */}
        <div className="dashboard-cards">
          {loading && !error ? (
            [...Array(6)].map((_, index) => renderLoadingCard(index))
          ) : (
            <>
              {/* Your existing card JSX here */}
              <div className="dash-card stats-card">
                <div className="card-body">
                  <h3>Total Users</h3>
                  <div className="metric-value-large">{totalUsersCount}</div>
                  <div className="user-breakdown-grid">
                    <div className="breakdown-item">
                      <span className="breakdown-count">{totalUsers.students}</span>
                      <span className="breakdown-label">Students</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-count">{totalUsers.lecturers}</span>
                      <span className="breakdown-label">Lecturers</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-count">{totalUsers.principalLecturers}</span>
                      <span className="breakdown-label">Principal Lecturers</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-count">{totalUsers.programLeaders}</span>
                      <span className="breakdown-label">Program Leaders</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other cards remain the same... */}
              {/* Courses Card */}
              <div className="dash-card stats-card">
                <div className="card-body">
                  <h3>Courses</h3>
                  <div className="metric-value-large">{courses.total}</div>
                  <div className="breakdown-simple">
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count active">{courses.active}</span>
                      <span className="breakdown-label">Active</span>
                    </div>
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count inactive">{courses.total - courses.active}</span>
                      <span className="breakdown-label">Inactive</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reports Card */}
              <div className="dash-card stats-card">
                <div className="card-body">
                  <h3>Reports</h3>
                  <div className="metric-value-large">{reports.total}</div>
                  <div className="breakdown-simple">
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count total">{reports.total}</span>
                      <span className="breakdown-label">Total</span>
                    </div>
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count pending">{reports.pending}</span>
                      <span className="breakdown-label">Pending</span>
                    </div>
                    <div className="breakdown-item-simple">
                      <span className="breakdown-count missing">{reports.missing || 0}</span>
                      <span className="breakdown-label">Missing</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Card */}
              <div className="dash-card stats-card">
                <div className="card-body">
                  <h3>Attendance</h3>
                  <div className="metric-value-large">{attendance.average}%</div>
                  <div className="attendance-trend">
                    <span>{attendance.trend}</span>
                  </div>
                </div>
              </div>

              {/* Top Rated Courses */}
              <div className="dash-card">
                <div className="card-body">
                  <h3>Top Rated Courses</h3>
                  <div className="highlight-content">
                    {highlights.topRatedCourses.length > 0 ? (
                      highlights.topRatedCourses.map((course, index) => (
                        <div key={index} className="highlight-item">
                          <div className="highlight-main">
                            <div className="highlight-title">{course.name}</div>
                            <div className="highlight-subtitle">{course.lecturer}</div>
                          </div>
                          <div className="highlight-value">
                            <Badge bg={course.rating >= 4 ? 'success' : course.rating >= 3 ? 'warning' : 'danger'} className="rating-badge">
                              {course.rating}/5
                            </Badge>
                            <div className="highlight-meta">{course.totalratings} ratings</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-data">
                        <p>No rating data available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Priority Alerts */}
              <div className="dash-card">
                <div className="card-body">
                  <h3>Priority Alerts</h3>
                  <div className="highlight-content">
                    {highlights.alerts.length > 0 ? (
                      highlights.alerts.map((alert, index) => (
                        <div key={index} className={`highlight-item alert-item alert-${alert.type}`}>
                          <div className="highlight-main">
                            <div className="highlight-title">{alert.title}</div>
                            <div className="highlight-subtitle">{alert.message}</div>
                            <div className="highlight-meta">
                              {alert.time}
                              {alert.count > 1 && <Badge bg="secondary" className="ms-2">{alert.count} items</Badge>}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-data">
                        <p>No alerts at this time</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;