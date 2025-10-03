import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Row, Col, Card, ProgressBar,
  Badge, Alert, Dropdown, Button, Modal, Form,
  Tabs, Tab, InputGroup, ListGroup, Spinner, Table
} from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Monitoring = () => {
  const [metrics, setMetrics] = useState([]);
  const [search, setSearch] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [attendanceThreshold, setAttendanceThreshold] = useState(50);
  const [filter, setFilter] = useState({ type: 'all', status: 'all' });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isPublic, setIsPublic] = useState(false);
  const [publicStats, setPublicStats] = useState({});

  // Mock student data for modal
  const mockStudents = [
    { id: 1, name: 'John Doe', attendance: 85, lastWeek: 12, status: 'Regular' },
    { id: 2, name: 'Jane Smith', attendance: 65, lastWeek: 10, status: 'Irregular' },
    { id: 3, name: 'Alex Johnson', attendance: 45, lastWeek: 8, status: 'At Risk' },
  ];

  // Get current user from localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');
    const userName = localStorage.getItem('user_name');
    const userId = localStorage.getItem('user_id');

    if (token && userRole && userName && userId) {
      setCurrentUser({
        id: userId,
        name: userName,
        role: userRole,
        username: localStorage.getItem('user_username') || '',
      });
      setIsPublic(false);
      fetchMonitoringData();
    } else {
      setIsPublic(true);
      fetchPublicData();
    }
  }, []);

  // Login success handler
  const handleLoginSuccess = (userData) => {
    const { id, username, role, token } = userData;
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('user_id', id);
    localStorage.setItem('user_name', username);
    localStorage.setItem('user_username', username);
    setCurrentUser({ id, username, role, name: username });
    setIsPublic(false);
    setShowLoginModal(false);
    fetchMonitoringData();
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_username');
    setIsPublic(true);
    setCurrentUser(null);
    setMetrics([]);
    setCourses([]);
    setLecturers([]);
    setRatings([]);
    setReports([]);
    setAlerts([]);
    fetchPublicData();
  };

  // Fetch all monitoring data (authenticated)
  const fetchMonitoringData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [coursesRes, lecturersRes, ratingsRes, reportsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/courses', { headers }),
        axios.get('http://localhost:5000/api/users?role=Lecturer', { headers }),
        axios.get('http://localhost:5000/api/ratings', { headers }),
        axios.get('http://localhost:5000/api/reports', { headers })
      ]);

      setCourses(coursesRes.data || []);
      setLecturers(lecturersRes.data || []);
      setRatings(ratingsRes.data || []);
      setReports(reportsRes.data || []);

      calculateMetrics(
        coursesRes.data || [],
        reportsRes.data || [],
        ratingsRes.data || [],
        lecturersRes.data || []
      );

      generateAlerts(
        coursesRes.data || [],
        reportsRes.data || [],
        lecturersRes.data || []
      );
    } catch (err) {
      console.error('Error fetching monitoring data:', err);
    }
    setLoading(false);
  }, []);

  // Fetch public data
  const fetchPublicData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/monitoring/public-stats')
      ]);

      setPublicStats(statsRes.data || {});

    } catch (err) {
      console.error('Error fetching public data:', err);
      setPublicStats({
        totalCourses: 0,
        totalReports: 0,
        totalRatings: 0,
        avgAttendance: 0,
        systemUptime: '99.9%'
      });
    }
    setLoading(false);
  }, []);

  // Calculate metrics for each course
  const calculateMetrics = (coursesData, reportsData, ratingsData, lecturersData) => {
    const calculatedMetrics = coursesData.map(course => {
      const courseReports = reportsData.filter(r => r.course_id === course.id);
      const courseRatings = ratingsData.filter(r => r.course_id === course.id);

      const attendanceData = courseReports.map(report => ({
        week: report.week,
        attendance: report.total_students > 0 ? (report.actual_students / report.total_students) * 100 : 0
      }));

      const totalWeeks = 16;
      const progress = (courseReports.length / totalWeeks) * 100;

      const lecturer = lecturersData.find(l => l.id === course.lecturer_id);

      const lecturerReports = reportsData.filter(r => r.lecturer_id === course.lecturer_id);
      const onTimeSubmissions = lecturerReports.filter(r => {
        const submissionDate = new Date(r.submission_date);
        const lectureDate = new Date(r.date_lecture);
        return submissionDate <= new Date(lectureDate.setDate(lectureDate.getDate() + 2));
      }).length;
      const submissionRate = lecturerReports.length > 0 ? (onTimeSubmissions / lecturerReports.length) * 100 : 0;

      const avgRating = courseRatings.length > 0 ? courseRatings.reduce((acc, r) => acc + r.rating, 0) / courseRatings.length : 0;

      const avgAttendance = attendanceData.length > 0 ? attendanceData.reduce((acc, d) => acc + d.attendance, 0) / attendanceData.length : 0;

      // Calculate course status
      let status = 'Needs Attention';
      if (avgAttendance >= 80 && progress >= 80 && avgRating >= 4) status = 'Excellent';
      else if (avgAttendance >= 60 && progress >= 60 && avgRating >= 3) status = 'Good';

      // Mock trend arrows
      const trend = Math.random() > 0.5 ? '↑' : Math.random() > 0.5 ? '↓' : '→';

      return {
        id: course.id,
        course_id: course.id,
        course_name: course.name,
        course_code: course.code,
        lecturer_name: lecturer?.username || 'Unknown',
        attendance_trend: attendanceData,
        progress,
        submission_rate: submissionRate,
        avg_rating: avgRating,
        avg_attendance: avgAttendance,
        total_reports: courseReports.length,
        last_report: courseReports.length > 0 ? courseReports[courseReports.length - 1].week : 0,
        status,
        trend
      };
    });

    setMetrics(calculatedMetrics);
  };

  // Generate alerts based on thresholds
  const generateAlerts = (coursesData, reportsData, lecturersData) => {
    const generatedAlerts = [];

    coursesData.forEach(course => {
      const courseReports = reportsData.filter(r => r.course_id === course.id);
      const recentReport = courseReports[courseReports.length - 1];

      if (recentReport) {
        const attendanceRate = (recentReport.actual_students / recentReport.total_students) * 100;
        if (attendanceRate < attendanceThreshold) {
          generatedAlerts.push({
            id: `attendance-${course.id}-${recentReport.week}`,
            type: 'attendance',
            severity: 'high',
            title: `Low Attendance Alert`,
            message: `Course ${course.name} has ${attendanceRate.toFixed(1)}% attendance in Week ${recentReport.week}`,
            course_id: course.id,
            week: recentReport.week,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    lecturersData.forEach(lecturer => {
      const lecturerCourses = coursesData.filter(c => c.lecturer_id === lecturer.id);
      lecturerCourses.forEach(course => {
        const expectedWeeks = 16;
        const submittedWeeks = reportsData.filter(r => r.course_id === course.id && r.lecturer_id === lecturer.id).length;

        if (submittedWeeks < expectedWeeks) {
          generatedAlerts.push({
            id: `missing-${course.id}-${lecturer.id}`,
            type: 'missing_report',
            severity: 'medium',
            title: `Missing Reports Alert`,
            message: `Lecturer ${lecturer.username} has submitted only ${submittedWeeks}/${expectedWeeks} reports for ${course.name}`,
            lecturer_id: lecturer.id,
            course_id: course.id,
            timestamp: new Date().toISOString()
          });
        }
      });
    });

    setAlerts(generatedAlerts);
  };

  // Filter logic
  const filteredMetrics = metrics.filter(metric => {
    const matchesSearch = search === '' || 
      metric.course_name.toLowerCase().includes(search.toLowerCase()) || 
      metric.lecturer_name.toLowerCase().includes(search.toLowerCase());

    const matchesType = filter.type === 'all' ||
      (filter.type === 'attendance' && metric.avg_attendance < attendanceThreshold) ||
      (filter.type === 'progress' && metric.progress < 50) ||
      (filter.type === 'rating' && metric.avg_rating < 3);

    return matchesSearch && matchesType;
  });

  const filteredAlerts = alerts.filter(alert => filter.status === 'all' || alert.severity === filter.status);

  // Role-based filtering
  const roleFilteredMetrics = () => {
    if (currentUser?.role === 'Lecturer') {
      return filteredMetrics.filter(m => m.lecturer_name === currentUser.username);
    } else if (currentUser?.role === 'Student') {
      return [];
    }
    return filteredMetrics;
  };

  const roleFilteredAlerts = () => {
    if (currentUser?.role === 'Lecturer') {
      return filteredAlerts.filter(a => a.lecturer_id === currentUser.id);
    }
    return filteredAlerts;
  };

  // Export functions
  const exportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportToPDF = (data, filename) => {
    const doc = new jsPDF();
    doc.autoTable({
      head: [Object.keys(data[0])],
      body: data.map(row => Object.values(row)),
    });
    doc.save(`${filename}.pdf`);
  };

  const exportToCSV = (data, filename) => {
    const csv = data.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  // Authentication Modal with Role Selection - Same pattern as other components
  const AuthModal = ({ show, onClose, onSuccess }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [formData, setFormData] = useState({
      username: '',
      password: '',
      email: '',
      faculty_name: '',
      role: 'Student'
    });
    const [authError, setAuthError] = useState('');

    const handleSubmit = async () => {
      try {
        setAuthError('');
        const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
       
        const res = await axios.post(`http://localhost:5000${endpoint}`, formData);
       
        if (isRegister) {
          onSuccess(res.data);
        } else {
          localStorage.setItem('token', res.data.token);
          onSuccess(res.data);
        }
        onClose();
      } catch (err) {
        setAuthError(err.response?.data?.error || 'Authentication failed');
      }
    };

    return (
      <Modal show={show} onHide={onClose} centered className="auth-modal">
        <Modal.Header closeButton className="auth-header">
          <Modal.Title>{isRegister ? 'Create Account' : 'Login to Monitoring System'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="auth-body">
          {authError && <Alert variant="danger" className="auth-alert">{authError}</Alert>}
          <div className="role-selection mb-4">
            <h6>Select Your Role:</h6>
            <div className="role-buttons">
              {['Student', 'Lecturer', 'PRL', 'Program Leader'].map(role => (
                <Button
                  key={role}
                  variant={formData.role === role ? 'primary' : 'outline-primary'}
                  onClick={() => setFormData({...formData, role})}
                  className="role-btn"
                >
                  {role}
                </Button>
              ))}
            </div>
          </div>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="auth-label">Username</Form.Label>
              <Form.Control
                type="text"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
                className="auth-input"
                placeholder="Enter your username"
              />
            </Form.Group>
            {isRegister && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label className="auth-label">Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="auth-input"
                    placeholder="Enter your email"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="auth-label">Faculty/Department</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.faculty_name}
                    onChange={e => setFormData({...formData, faculty_name: e.target.value})}
                    className="auth-input"
                    placeholder="Enter your faculty/department"
                  />
                </Form.Group>
              </>
            )}
            <Form.Group className="mb-3">
              <Form.Label className="auth-label">Password</Form.Label>
              <Form.Control
                type="password"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="auth-input"
                placeholder="Enter your password"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer className="auth-footer">
          <Button variant="link" onClick={() => setIsRegister(!isRegister)} className="auth-switch">
            {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="auth-submit">
            {isRegister ? 'Create Account' : 'Login'}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  // Public Dashboard Component - Consistent with other components
  const PublicDashboard = () => (
    <div className="public-dashboard">
      <div className="university-hero">
        <Container>
          <div className="hero-content text-center">
            <h1 className="university-title">University Monitoring System</h1>
            <p className="university-subtitle">Real-time Academic Performance Tracking and Analytics</p>
          </div>
        </Container>
      </div>
      
      <Container className="py-5">
        <div className="login-section text-center mb-5">
          <Card className="login-feature-card">
            <Card.Body className="p-5">
              <h2 className="portal-title">Monitoring Portal</h2>
              <p className="portal-subtitle mb-4">
                Track course progress, attendance trends, and academic performance metrics
              </p>
              <Button 
                variant="primary" 
                size="lg" 
                onClick={() => setShowLoginModal(true)} 
                className="login-btn-main"
              >
                <i className="fas fa-sign-in-alt me-2"></i>Login / Register
              </Button>
            </Card.Body>
          </Card>
        </div>
        
        {/* Feature Showcase */}
        <div className="feature-showcase mt-5">
          <h3 className="feature-title mb-4">Comprehensive Monitoring Features</h3>
          
          <Row className="g-4">
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Real-time Analytics</Card.Title>
                  <Card.Text className="feature-card-text">
                    Monitor course progress, attendance trends, and submission rates in real-time. 
                    Get instant insights into academic performance across all courses.
                  </Card.Text>
                  <Badge bg="info" className="feature-badge">Live Tracking</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Smart Alerts</Card.Title>
                  <Card.Text className="feature-card-text">
                    Automated alert system for low attendance, missing reports, and performance issues. 
                    Proactive notifications help maintain academic standards.
                  </Card.Text>
                  <Badge bg="success" className="feature-badge">Proactive Monitoring</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Performance Metrics</Card.Title>
                  <Card.Text className="feature-card-text">
                    Comprehensive performance indicators for courses, lecturers, and programs. 
                    Track key metrics and identify areas for improvement.
                  </Card.Text>
                  <Badge bg="warning" className="feature-badge">Data Insights</Badge>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          {/* Additional Features Row */}
          <Row className="g-4 mt-2">
            <Col md={6}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Role-based Access</Card.Title>
                  <Card.Text className="feature-card-text">
                    Different monitoring views for Students, Lecturers, PRLs, and Program Leaders. 
                    Each role sees relevant data and actionable insights.
                  </Card.Text>
                  <Badge bg="primary" className="feature-badge">Customized Views</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Export & Reports</Card.Title>
                  <Card.Text className="feature-card-text">
                    Generate comprehensive reports and export data in multiple formats. 
                    Perfect for meetings, reviews, and documentation purposes.
                  </Card.Text>
                  <Badge bg="dark" className="feature-badge">Data Export</Badge>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </div>
        
        {/* Statistics Section */}
        <div className="portal-statistics mt-5">
          <Row className="g-4">
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.totalCourses || 0}</div>
                <div className="stat-label">Active Courses</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.totalReports || 0}</div>
                <div className="stat-label">Reports Submitted</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.totalRatings || 0}</div>
                <div className="stat-label">Course Ratings</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.systemUptime || '99.9%'}</div>
                <div className="stat-label">System Uptime</div>
              </div>
            </Col>
          </Row>
        </div>
      </Container>
    </div>
  );

  // Main Monitoring Management System
  const MonitoringManagementSystem = () => (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="dashboard-title">Monitoring Dashboard</h2>
          <p className="welcome-text">
            {currentUser?.role === 'Program Leader' 
              ? 'Program-wide monitoring and analytics'
              : currentUser?.role === 'PRL'
              ? 'Course and lecturer performance monitoring'
              : currentUser?.role === 'Lecturer'
              ? 'Your course monitoring overview'
              : 'System monitoring overview'}
          </p>
        </div>
        <div className="d-flex align-items-center">
          <Badge bg="secondary" className="me-2">
            {currentUser?.name} ({currentUser?.role})
          </Badge>
          <Button variant="outline-danger" onClick={handleLogout} className="logout-btn">
            <i className="fas fa-sign-out-alt me-2"></i>Logout
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      {currentUser?.role !== 'Student' && (
        <Row className="mb-4">
          <Col md={6}>
            <InputGroup>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Search by course or lecturer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input"
              />
            </InputGroup>
          </Col>
          <Col md={3}>
            <Form.Select
              value={filter.type}
              onChange={e => setFilter({ ...filter, type: e.target.value })}
              className="form-select-custom"
            >
              <option value="all">All Metrics</option>
              <option value="attendance">Low Attendance</option>
              <option value="progress">Low Progress</option>
              <option value="rating">Low Rating</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Select
              value={filter.status}
              onChange={e => setFilter({ ...filter, status: e.target.value })}
              className="form-select-custom"
            >
              <option value="all">All Alerts</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
            </Form.Select>
          </Col>
        </Row>
      )}

      {/* Tabs for different sections */}
      <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4 custom-tabs">
        <Tab eventKey="dashboard" title={<span><i className="fas fa-tachometer-alt me-2"></i>Dashboard</span>}>
          <Row>
            <Col md={3}>
              <Card className="stats-card mb-4">
                <Card.Body className="text-center">
                  <Card.Title className="stats-number">{courses.length}</Card.Title>
                  <Card.Text className="stats-label">Total Courses</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="stats-card mb-4">
                <Card.Body className="text-center">
                  <Card.Title className="stats-number">{lecturers.length}</Card.Title>
                  <Card.Text className="stats-label">Total Lecturers</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="stats-card mb-4">
                <Card.Body className="text-center">
                  <Card.Title className="stats-number">{reports.length}</Card.Title>
                  <Card.Text className="stats-label">Total Reports</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="stats-card mb-4">
                <Card.Body className="text-center">
                  <Card.Title className="stats-number">{ratings.length}</Card.Title>
                  <Card.Text className="stats-label">Total Ratings</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {currentUser?.role !== 'Student' && (
            <>
              <Card className="mb-4">
                <Card.Header className="form-card-header">
                  <h5 className="mb-0">Course Overview</h5>
                </Card.Header>
                <Card.Body>
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Lecturer</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Avg Attendance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleFilteredMetrics().map(metric => (
                        <tr key={metric.id}>
                          <td>
                            <strong>{metric.course_name}</strong>
                            <br />
                            <small className="text-muted">{metric.course_code}</small>
                          </td>
                          <td>{metric.lecturer_name}</td>
                          <td>
                            <Badge bg={
                              metric.status === 'Excellent' ? 'success' : 
                              metric.status === 'Good' ? 'warning' : 'danger'
                            }>
                              {metric.status}
                            </Badge>
                          </td>
                          <td>
                            <ProgressBar 
                              now={metric.progress} 
                              variant={metric.progress < 50 ? 'danger' : metric.progress < 80 ? 'warning' : 'success'}
                              label={`${metric.progress.toFixed(1)}%`} 
                            />
                          </td>
                          <td>
                            <Badge bg={metric.avg_attendance < 60 ? 'danger' : metric.avg_attendance < 80 ? 'warning' : 'success'}>
                              {metric.avg_attendance.toFixed(1)}%
                            </Badge>
                          </td>
                          <td>
                            <Button 
                              size="sm" 
                              variant="outline-primary"
                              onClick={() => { setSelectedCourse(metric); setShowStudentModal(true); }}
                            >
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>

              <Row>
                <Col md={6}>
                  <Card>
                    <Card.Header className="form-card-header">
                      <h5 className="mb-0">Recent Alerts ({roleFilteredAlerts().length})</h5>
                    </Card.Header>
                    <Card.Body>
                      {roleFilteredAlerts().length === 0 ? (
                        <div className="text-center py-4">
                          <i className="fas fa-check-circle fa-2x text-success mb-3"></i>
                          <p className="text-muted">No active alerts</p>
                        </div>
                      ) : (
                        <ListGroup variant="flush">
                          {roleFilteredAlerts().slice(0, 5).map(alert => (
                            <ListGroup.Item 
                              key={alert.id} 
                              className={`alert-item ${alert.severity === 'high' ? 'alert-high' : 'alert-medium'}`}
                            >
                              <div className="d-flex justify-content-between align-items-start">
                                <div>
                                  <strong>{alert.title}</strong>
                                  <p className="mb-1">{alert.message}</p>
                                  <small className="text-muted">
                                    {new Date(alert.timestamp).toLocaleString()}
                                  </small>
                                </div>
                                <Badge bg={alert.severity === 'high' ? 'danger' : 'warning'}>
                                  {alert.severity}
                                </Badge>
                              </div>
                            </ListGroup.Item>
                          ))}
                        </ListGroup>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header className="form-card-header">
                      <h5 className="mb-0">Quick Actions</h5>
                    </Card.Header>
                    <Card.Body>
                      <div className="d-grid gap-2">
                        <Dropdown>
                          <Dropdown.Toggle variant="success" className="export-btn w-100">
                            <i className="fas fa-download me-2"></i>Export Data
                          </Dropdown.Toggle>
                          <Dropdown.Menu className="export-menu">
                            <Dropdown.Item onClick={() => exportToExcel(roleFilteredMetrics(), 'monitoring_metrics')} className="export-item">
                              <i className="fas fa-file-excel me-2"></i>Export to Excel
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => exportToPDF(roleFilteredMetrics(), 'monitoring_metrics')} className="export-item">
                              <i className="fas fa-file-pdf me-2"></i>Export to PDF
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => exportToCSV(roleFilteredMetrics(), 'monitoring_metrics')} className="export-item">
                              <i className="fas fa-file-csv me-2"></i>Export to CSV
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                        <Button variant="outline-primary">
                          <i className="fas fa-chart-line me-2"></i>Generate Report
                        </Button>
                        <Button variant="outline-warning">
                          <i className="fas fa-bell me-2"></i>Manage Alerts
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </Tab>

        {currentUser?.role !== 'Student' && (
          <Tab eventKey="attendance" title={<span><i className="fas fa-users me-2"></i>Attendance</span>}>
            <Card>
              <Card.Header className="form-card-header">
                <h5 className="mb-0">Attendance Monitoring</h5>
              </Card.Header>
              <Card.Body>
                <Row className="mb-4">
                  <Col md={6}>
                    <Form.Label className="form-label">
                      Attendance Threshold: <Badge bg="primary">{attendanceThreshold}%</Badge>
                    </Form.Label>
                    <Form.Range
                      min={0}
                      max={100}
                      value={attendanceThreshold}
                      onChange={e => setAttendanceThreshold(e.target.value)}
                    />
                  </Col>
                </Row>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Lecturer</th>
                      <th>Average Attendance</th>
                      <th>Status</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleFilteredMetrics().map(metric => (
                      <tr key={metric.id}>
                        <td>{metric.course_name}</td>
                        <td>{metric.lecturer_name}</td>
                        <td>
                          <div className="d-flex align-items-center">
                            <ProgressBar 
                              now={metric.avg_attendance} 
                              variant={metric.avg_attendance < attendanceThreshold ? 'danger' : 'success'} 
                              style={{ flex: 1 }}
                              label={`${metric.avg_attendance.toFixed(1)}%`} 
                            />
                          </div>
                        </td>
                        <td>
                          <Badge bg={metric.avg_attendance < attendanceThreshold ? 'danger' : 'success'}>
                            {metric.avg_attendance < attendanceThreshold ? 'Below Threshold' : 'Satisfactory'}
                          </Badge>
                        </td>
                        <td>{metric.trend}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Tab>
        )}

        {currentUser?.role !== 'Student' && (
          <Tab eventKey="progress" title={<span><i className="fas fa-tasks me-2"></i>Progress</span>}>
            <Card>
              <Card.Header className="form-card-header">
                <h5 className="mb-0">Course Progress Tracking</h5>
              </Card.Header>
              <Card.Body>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Lecturer</th>
                      <th>Syllabus Coverage</th>
                      <th>Reports Submitted</th>
                      <th>Last Report Week</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleFilteredMetrics().map(metric => (
                      <tr key={metric.id}>
                        <td>{metric.course_name}</td>
                        <td>{metric.lecturer_name}</td>
                        <td>
                          <ProgressBar 
                            now={metric.progress} 
                            variant={metric.progress < 50 ? 'danger' : metric.progress < 80 ? 'warning' : 'success'}
                            label={`${metric.progress.toFixed(1)}%`} 
                          />
                        </td>
                        <td>
                          <Badge bg="info">{metric.total_reports}/16</Badge>
                        </td>
                        <td>Week {metric.last_report}</td>
                        <td>
                          <Badge bg={
                            metric.progress >= 80 ? 'success' : 
                            metric.progress >= 60 ? 'warning' : 'danger'
                          }>
                            {metric.progress >= 80 ? 'On Track' : 
                             metric.progress >= 60 ? 'Moderate' : 'Behind'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Tab>
        )}

        {(currentUser?.role === 'Program Leader' || currentUser?.role === 'PRL') && (
          <Tab eventKey="lecturers" title={<span><i className="fas fa-chalkboard-teacher me-2"></i>Lecturers</span>}>
            <Card>
              <Card.Header className="form-card-header">
                <h5 className="mb-0">Lecturer Performance</h5>
              </Card.Header>
              <Card.Body>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Lecturer</th>
                      <th>Courses</th>
                      <th>Submission Rate</th>
                      <th>Avg Attendance</th>
                      <th>Avg Rating</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lecturers.map(lecturer => {
                      const lecturerMetrics = roleFilteredMetrics().filter(m => m.lecturer_name === lecturer.username);
                      const avgSubmission = lecturerMetrics.length > 0 ? 
                        lecturerMetrics.reduce((acc, m) => acc + m.submission_rate, 0) / lecturerMetrics.length : 0;
                      const avgAttendance = lecturerMetrics.length > 0 ? 
                        lecturerMetrics.reduce((acc, m) => acc + m.avg_attendance, 0) / lecturerMetrics.length : 0;
                      const avgRating = lecturerMetrics.length > 0 ? 
                        lecturerMetrics.reduce((acc, m) => acc + m.avg_rating, 0) / lecturerMetrics.length : 0;
                      
                      const performance = (avgSubmission * 0.3 + avgAttendance * 0.3 + (avgRating * 20) * 0.4) / 100;
                      
                      return (
                        <tr key={lecturer.id}>
                          <td>{lecturer.username}</td>
                          <td>
                            <Badge bg="secondary">{lecturerMetrics.length}</Badge>
                          </td>
                          <td>{avgSubmission.toFixed(1)}%</td>
                          <td>{avgAttendance.toFixed(1)}%</td>
                          <td>{avgRating.toFixed(1)}/5</td>
                          <td>
                            <ProgressBar 
                              now={performance * 100} 
                              variant={performance >= 0.8 ? 'success' : performance >= 0.6 ? 'warning' : 'danger'}
                              label={`${(performance * 100).toFixed(1)}%`} 
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Tab>
        )}

        {currentUser?.role !== 'Student' && (
          <Tab eventKey="alerts" title={<span><i className="fas fa-bell me-2"></i>Alerts ({roleFilteredAlerts().length})</span>}>
            <Card>
              <Card.Header className="form-card-header">
                <h5 className="mb-0">Alert Management</h5>
              </Card.Header>
              <Card.Body>
                <Row className="mb-3">
                  <Col md={4}>
                    <Card className="text-center bg-danger bg-opacity-10">
                      <Card.Body>
                        <h4 className="text-danger">{roleFilteredAlerts().filter(a => a.severity === 'high').length}</h4>
                        <p className="mb-0">High Priority</p>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={4}>
                    <Card className="text-center bg-warning bg-opacity-10">
                      <Card.Body>
                        <h4 className="text-warning">{roleFilteredAlerts().filter(a => a.severity === 'medium').length}</h4>
                        <p className="mb-0">Medium Priority</p>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={4}>
                    <Card className="text-center bg-success bg-opacity-10">
                      <Card.Body>
                        <h4 className="text-success">{roleFilteredAlerts().filter(a => a.type === 'resolved').length}</h4>
                        <p className="mb-0">Resolved</p>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {roleFilteredAlerts().length === 0 ? (
                  <div className="text-center py-5">
                    <i className="fas fa-check-circle fa-3x text-success mb-3"></i>
                    <h5>No Active Alerts</h5>
                    <p className="text-muted">All systems are running smoothly</p>
                  </div>
                ) : (
                  <ListGroup variant="flush">
                    {roleFilteredAlerts().map(alert => (
                      <ListGroup.Item 
                        key={alert.id}
                        className={`alert-item ${alert.severity === 'high' ? 'alert-high' : 'alert-medium'}`}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center mb-2">
                              <i className={`fas fa-exclamation-triangle me-2 ${
                                alert.severity === 'high' ? 'text-danger' : 'text-warning'
                              }`}></i>
                              <h6 className="mb-0">{alert.title}</h6>
                              <Badge bg={alert.severity === 'high' ? 'danger' : 'warning'} className="ms-2">
                                {alert.severity}
                              </Badge>
                            </div>
                            <p className="mb-2">{alert.message}</p>
                            <div className="d-flex gap-3">
                              <small className="text-muted">
                                <i className="fas fa-calendar me-1"></i>
                                {new Date(alert.timestamp).toLocaleDateString()}
                              </small>
                              <small className="text-muted">
                                <i className="fas fa-clock me-1"></i>
                                {new Date(alert.timestamp).toLocaleTimeString()}
                              </small>
                            </div>
                          </div>
                          <div className="d-flex gap-2">
                            <Button size="sm" variant="outline-success">
                              Resolve
                            </Button>
                            <Button size="sm" variant="outline-primary">
                              View Details
                            </Button>
                          </div>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </Card.Body>
            </Card>
          </Tab>
        )}
      </Tabs>

      {/* Student Details Modal */}
      <Modal show={showStudentModal} onHide={() => setShowStudentModal(false)} size="lg" centered>
        <Modal.Header closeButton className="form-card-header">
          <Modal.Title>
            <i className="fas fa-users me-2"></i>
            Student Details - {selectedCourse?.course_name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Attendance %</th>
                <th>Last Attended Week</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockStudents.map(student => (
                <tr key={student.id}>
                  <td>{student.id}</td>
                  <td>{student.name}</td>
                  <td>
                    <div className="d-flex align-items-center">
                      <ProgressBar 
                        now={student.attendance} 
                        variant={student.attendance < 50 ? 'danger' : student.attendance < 70 ? 'warning' : 'success'} 
                        style={{ flex: 1 }}
                        label={`${student.attendance}%`} 
                      />
                    </div>
                  </td>
                  <td>Week {student.lastWeek}</td>
                  <td>
                    <Badge bg={
                      student.status === 'Regular' ? 'success' : 
                      student.status === 'Irregular' ? 'warning' : 'danger'
                    }>
                      {student.status}
                    </Badge>
                  </td>
                  <td>
                    <Button size="sm" variant="outline-primary">
                      <i className="fas fa-eye"></i>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowStudentModal(false)}>
            Close
          </Button>
          <Button variant="primary">
            <i className="fas fa-download me-2"></i>
            Export Student Data
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );

  if (loading) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Loading monitoring data...</p>
      </Container>
    );
  }

  return (
    <Container className="monitoring-container py-4">
      {!isPublic ? <MonitoringManagementSystem /> : <PublicDashboard />}
      
      {/* Auth Modal */}
      <AuthModal
        show={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </Container>
  );
};

export default Monitoring;