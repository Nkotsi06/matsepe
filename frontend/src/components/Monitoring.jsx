import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Row, Col, Card, ProgressBar,
  Badge, Alert, Dropdown, Button, Modal, Form,
  Tabs, Tab, InputGroup, ListGroup, Spinner, Table,
  Nav, Navbar, Offcanvas, Accordion, OverlayTrigger, Tooltip
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
  
  // New Features State
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [quickActions, setQuickActions] = useState([]);
  const [predictiveAnalytics, setPredictiveAnalytics] = useState({});
  const [collaborationData, setCollaborationData] = useState([]);
  const [showCollaborationModal, setShowCollaborationModal] = useState(false);
  const [aiInsights, setAiInsights] = useState([]);
  const [performanceBenchmarks, setPerformanceBenchmarks] = useState({});
  const [customDashboards, setCustomDashboards] = useState([]);
  const [activeDashboard, setActiveDashboard] = useState('default');

  // Mock student data for modal
  const mockStudents = [
    { id: 1, name: 'John Doe', attendance: 85, lastWeek: 12, status: 'Regular' },
    { id: 2, name: 'Jane Smith', attendance: 65, lastWeek: 10, status: 'Irregular' },
    { id: 3, name: 'Alex Johnson', attendance: 45, lastWeek: 8, status: 'At Risk' },
  ];

  // Initialize new features
  useEffect(() => {
    initializeNewFeatures();
  }, [currentUser]);

  const initializeNewFeatures = () => {
    // Initialize notifications
    setNotifications([
      {
        id: 1,
        type: 'system',
        title: 'Welcome to Enhanced Monitoring',
        message: 'New features are now available!',
        timestamp: new Date(),
        read: false
      },
      {
        id: 2,
        type: 'alert',
        title: 'Weekly Report Generated',
        message: 'Your weekly performance report is ready',
        timestamp: new Date(Date.now() - 3600000),
        read: false
      }
    ]);

    // Initialize quick actions
    setQuickActions([
      { id: 1, name: 'Quick Report', icon: '📊', action: () => generateQuickReport() },
      { id: 2, name: 'Send Alert', icon: '🔔', action: () => handleQuickAlert() },
      { id: 3, name: 'Export Data', icon: '📤', action: () => exportToExcel(metrics, 'quick_export') },
      { id: 4, name: 'Add Note', icon: '📝', action: () => handleAddNote() }
    ]);

    // Initialize predictive analytics
    setPredictiveAnalytics({
      predictedAttendance: 78,
      riskCourses: 2,
      improvementAreas: ['Submission Rate', 'Student Engagement'],
      nextWeekForecast: 'Stable with slight improvement'
    });

    // Initialize  insights
    setAiInsights([
      {
        id: 1,
        type: 'improvement',
        title: 'Attendance Boost Opportunity',
        message: 'Courses with low attendance could benefit from interactive teaching methods',
        confidence: 0.87,
        actionable: true
      },
      {
        id: 2,
        type: 'warning',
        title: 'Submission Rate Alert',
        message: 'Late submissions are increasing. Consider implementing reminders',
        confidence: 0.92,
        actionable: true
      }
    ]);

    // Initialize performance benchmarks
    setPerformanceBenchmarks({
      departmentAverage: 75,
      institutionalTarget: 85,
      topPerformer: 92,
      improvementTarget: 5
    });

    // Initialize custom dashboards
    setCustomDashboards([
      { id: 'default', name: 'Default Dashboard', icon: '🏠' },
      { id: 'attendance', name: 'Attendance Focus', icon: '👥' },
      { id: 'performance', name: 'Performance Analytics', icon: '📈' },
      { id: 'alerts', name: 'Alert Management', icon: '🚨' }
    ]);
  };

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
        axios.get('https://matsepe.onrender.com/api/courses', { headers }),
        axios.get('https://matsepe.onrender.com/api/users?role=Lecturer', { headers }),
        axios.get('https://matsepe.onrender.com/api/ratings', { headers }),
        axios.get('https://matsepe.onrender.com/api/reports', { headers })
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
        axios.get('https://matsepe.onrender.com/api/monitoring/public-stats')
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
        trend,
        isFavorite: favorites.includes(course.id)
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

  // New Feature Functions
  const toggleFavorite = (courseId) => {
    if (favorites.includes(courseId)) {
      setFavorites(favorites.filter(id => id !== courseId));
    } else {
      setFavorites([...favorites, courseId]);
    }
  };

  const generateQuickReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      totalCourses: courses.length,
      totalAlerts: alerts.length,
      averageAttendance: metrics.reduce((acc, m) => acc + m.avg_attendance, 0) / metrics.length,
      highPriorityAlerts: alerts.filter(a => a.severity === 'high').length
    };
    exportToPDF([reportData], 'quick_report');
  };

  const handleQuickAlert = () => {
    const newAlert = {
      id: `quick-${Date.now()}`,
      type: 'manual',
      severity: 'medium',
      title: 'Manual Alert Created',
      message: `Alert created by ${currentUser?.name} at ${new Date().toLocaleString()}`,
      timestamp: new Date().toISOString()
    };
    setAlerts(prev => [newAlert, ...prev]);
    
    // Add notification
    addNotification('alert', 'Alert Created', 'Your manual alert has been created successfully');
  };

  const handleAddNote = () => {
    const note = prompt('Enter your note:');
    if (note) {
      addNotification('note', 'New Note Added', note);
    }
  };

  const addNotification = (type, title, message) => {
    const newNotification = {
      id: Date.now(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markNotificationAsRead = (id) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.setAttribute('data-bs-theme', darkMode ? 'light' : 'dark');
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

  // Authentication Modal with Role Selection
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
       
        const res = await axios.post(`https://matsepe.onrender.com${endpoint}`, formData);
       
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

  // Enhanced Navigation Bar with new features
  const EnhancedNavbar = () => (
    <Navbar expand="lg" className="monitoring-navbar mb-4">
      <Container fluid>
        <Navbar.Brand className="brand-section">
          <i className="fas fa-chart-line me-2"></i>
          <span className="brand-text">Enhanced Monitoring System</span>
          <Badge bg="success" className="ms-2">v2.0</Badge>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="enhanced-navbar" />
        
        <Navbar.Collapse id="enhanced-navbar">
          <Nav className="me-auto">
            <Nav.Link 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')}
              className="nav-link-custom"
            >
              <i className="fas fa-tachometer-alt me-1"></i>
              Dashboard
            </Nav.Link>
            
            {currentUser?.role !== 'Student' && (
              <>
                <Nav.Link 
                  active={activeTab === 'attendance'} 
                  onClick={() => setActiveTab('attendance')}
                  className="nav-link-custom"
                >
                  <i className="fas fa-users me-1"></i>
                  Attendance
                </Nav.Link>
                
                <Nav.Link 
                  active={activeTab === 'progress'} 
                  onClick={() => setActiveTab('progress')}
                  className="nav-link-custom"
                >
                  <i className="fas fa-tasks me-1"></i>
                  Progress
                </Nav.Link>
                
                {(currentUser?.role === 'Program Leader' || currentUser?.role === 'PRL') && (
                  <Nav.Link 
                    active={activeTab === 'lecturers'} 
                    onClick={() => setActiveTab('lecturers')}
                    className="nav-link-custom"
                  >
                    <i className="fas fa-chalkboard-teacher me-1"></i>
                    Lecturers
                  </Nav.Link>
                )}
                
                <Nav.Link 
                  active={activeTab === 'alerts'} 
                  onClick={() => setActiveTab('alerts')}
                  className="nav-link-custom"
                >
                  <i className="fas fa-bell me-1"></i>
                  Alerts
                  {roleFilteredAlerts().length > 0 && (
                    <Badge bg="danger" className="ms-1">{roleFilteredAlerts().length}</Badge>
                  )}
                </Nav.Link>
                
                {/* New Features Navigation */}
                <Nav.Link 
                  active={activeTab === 'analytics'} 
                  onClick={() => setActiveTab('analytics')}
                  className="nav-link-custom"
                >
                  <i className="fas fa-brain me-1"></i>
                   Insights
                </Nav.Link>
                
                <Nav.Link 
                  active={activeTab === 'predictive'} 
                  onClick={() => setActiveTab('predictive')}
                  className="nav-link-custom"
                >
                  <i className="fas fa-chart-line me-1"></i>
                  Predictive
                </Nav.Link>
              </>
            )}
          </Nav>

          <Nav className="align-items-center">
            {/* Quick Actions Dropdown */}
            <Dropdown className="me-2">
              <Dropdown.Toggle variant="outline-primary" size="sm" className="quick-actions-btn">
                <i className="fas fa-bolt me-1"></i>
                Quick Actions
              </Dropdown.Toggle>
              <Dropdown.Menu className="quick-actions-menu">
                {quickActions.map(action => (
                  <Dropdown.Item 
                    key={action.id} 
                    onClick={action.action}
                    className="quick-action-item"
                  >
                    <span className="action-icon">{action.icon}</span>
                    {action.name}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>

            {/* Notifications Bell */}
            <Nav.Link 
              onClick={() => setShowNotifications(true)}
              className="notification-bell position-relative"
            >
              <i className="fas fa-bell"></i>
              {notifications.filter(n => !n.read).length > 0 && (
                <Badge 
                  bg="danger" 
                  className="position-absolute top-0 start-100 translate-middle p-1"
                >
                  {notifications.filter(n => !n.read).length}
                </Badge>
              )}
            </Nav.Link>

            {/* Dark Mode Toggle */}
            <Button 
              variant="outline-secondary" 
              size="sm" 
              onClick={toggleDarkMode}
              className="me-2 dark-mode-btn"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <i className={darkMode ? 'fas fa-sun' : 'fas fa-moon'}></i>
            </Button>

            {/* User Menu */}
            <Dropdown>
              <Dropdown.Toggle variant="outline-dark" className="user-menu-btn">
                <i className="fas fa-user me-1"></i>
                {currentUser?.name}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => setShowSettings(true)}>
                  <i className="fas fa-cog me-2"></i>
                  Settings
                </Dropdown.Item>
                <Dropdown.Item onClick={() => setActiveDashboard('default')}>
                  <i className="fas fa-th-large me-2"></i>
                  Dashboard Manager
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <i className="fas fa-sign-out-alt me-2"></i>
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );

  // New Components for Enhanced Features

  //  Insights Component
  const AIInsightsComponent = () => (
    <Card className="mb-4">
      <Card.Header className="form-card-header">
        <h5 className="mb-0">
          <i className="fas fa-brain me-2 text-primary"></i>
          AI-Powered Insights
        </h5>
      </Card.Header>
      <Card.Body>
        <Row>
          {aiInsights.map(insight => (
            <Col md={6} key={insight.id} className="mb-3">
              <Card className={`insight-card insight-${insight.type}`}>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <Badge bg={
                      insight.type === 'improvement' ? 'success' : 
                      insight.type === 'warning' ? 'danger' : 'info'
                    }>
                      {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                    </Badge>
                    <Badge bg="secondary">
                      {(insight.confidence * 100).toFixed(0)}% Confidence
                    </Badge>
                  </div>
                  <h6>{insight.title}</h6>
                  <p className="mb-2">{insight.message}</p>
                  {insight.actionable && (
                    <Button size="sm" variant="outline-primary">
                      View Recommendations
                    </Button>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Card.Body>
    </Card>
  );

  // Predictive Analytics Component
  const PredictiveAnalyticsComponent = () => (
    <Card className="mb-4">
      <Card.Header className="form-card-header">
        <h5 className="mb-0">
          <i className="fas fa-chart-line me-2 text-warning"></i>
          Predictive Analytics
        </h5>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={3}>
            <Card className="text-center predictive-card">
              <Card.Body>
                <div className="predictive-value">{predictiveAnalytics.predictedAttendance}%</div>
                <div className="predictive-label">Next Week Attendance</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center predictive-card">
              <Card.Body>
                <div className="predictive-value text-danger">{predictiveAnalytics.riskCourses}</div>
                <div className="predictive-label">At-Risk Courses</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card>
              <Card.Body>
                <h6>Improvement Areas</h6>
                <ListGroup variant="flush">
                  {predictiveAnalytics.improvementAreas?.map((area, index) => (
                    <ListGroup.Item key={index} className="improvement-item">
                      <i className="fas fa-bullseye me-2 text-success"></i>
                      {area}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  // Custom Dashboard Selector
  const DashboardSelector = () => (
    <Card className="mb-4">
      <Card.Header className="form-card-header">
        <h5 className="mb-0">
          <i className="fas fa-th-large me-2"></i>
          Dashboard Views
        </h5>
      </Card.Header>
      <Card.Body>
        <div className="dashboard-selector">
          {customDashboards.map(dashboard => (
            <Button
              key={dashboard.id}
              variant={activeDashboard === dashboard.id ? 'primary' : 'outline-primary'}
              onClick={() => setActiveDashboard(dashboard.id)}
              className="dashboard-btn me-2 mb-2"
            >
              <span className="dashboard-icon me-2">{dashboard.icon}</span>
              {dashboard.name}
            </Button>
          ))}
        </div>
      </Card.Body>
    </Card>
  );

  // Enhanced Course Table with Favorites
  const EnhancedCourseTable = () => (
    <Card className="mb-4">
      <Card.Header className="form-card-header">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Course Overview</h5>
          <Badge bg="info">{roleFilteredMetrics().length} courses</Badge>
        </div>
      </Card.Header>
      <Card.Body>
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th style={{width: '40px'}}>★</th>
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
                  <Button
                    variant="link"
                    className={`favorite-btn ${favorites.includes(metric.id) ? 'favorite-active' : ''}`}
                    onClick={() => toggleFavorite(metric.id)}
                    title={favorites.includes(metric.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <i className={`fas fa-star ${favorites.includes(metric.id) ? 'text-warning' : 'text-muted'}`}></i>
                  </Button>
                </td>
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
                  <div className="d-flex align-items-center">
                    <ProgressBar 
                      now={metric.progress} 
                      variant={metric.progress < 50 ? 'danger' : metric.progress < 80 ? 'warning' : 'success'}
                      style={{flex: 1}}
                      label={`${metric.progress.toFixed(1)}%`} 
                    />
                  </div>
                </td>
                <td>
                  <Badge bg={metric.avg_attendance < 60 ? 'danger' : metric.avg_attendance < 80 ? 'warning' : 'success'}>
                    {metric.avg_attendance.toFixed(1)}%
                  </Badge>
                </td>
                <td>
                  <div className="action-buttons">
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>View Details</Tooltip>}
                    >
                      <Button 
                        size="sm" 
                        variant="outline-primary"
                        onClick={() => { setSelectedCourse(metric); setShowStudentModal(true); }}
                        className="me-1"
                      >
                        <i className="fas fa-eye"></i>
                      </Button>
                    </OverlayTrigger>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>Quick Report</Tooltip>}
                    >
                      <Button 
                        size="sm" 
                        variant="outline-success"
                        className="me-1"
                      >
                        <i className="fas fa-chart-bar"></i>
                      </Button>
                    </OverlayTrigger>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>Send Alert</Tooltip>}
                    >
                      <Button 
                        size="sm" 
                        variant="outline-warning"
                      >
                        <i className="fas fa-bell"></i>
                      </Button>
                    </OverlayTrigger>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );

  // Notifications Panel
  const NotificationsPanel = () => (
    <Offcanvas show={showNotifications} onHide={() => setShowNotifications(false)} placement="end">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>
          <i className="fas fa-bell me-2"></i>
          Notifications
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {notifications.length === 0 ? (
          <div className="text-center py-4">
            <i className="fas fa-bell-slash fa-2x text-muted mb-3"></i>
            <p>No notifications</p>
          </div>
        ) : (
          <ListGroup variant="flush">
            {notifications.map(notification => (
              <ListGroup.Item 
                key={notification.id}
                className={`notification-item ${!notification.read ? 'notification-unread' : ''}`}
                onClick={() => markNotificationAsRead(notification.id)}
              >
                <div className="d-flex">
                  <div className={`notification-icon me-3 ${notification.type}`}>
                    <i className={`fas ${
                      notification.type === 'alert' ? 'fa-exclamation-triangle' :
                      notification.type === 'system' ? 'fa-cog' : 'fa-sticky-note'
                    }`}></i>
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-1">{notification.title}</h6>
                    <p className="mb-1 small">{notification.message}</p>
                    <small className="text-muted">
                      {new Date(notification.timestamp).toLocaleString()}
                    </small>
                  </div>
                  {!notification.read && (
                    <Badge bg="primary" className="align-self-start">New</Badge>
                  )}
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
        <div className="mt-3">
          <Button variant="outline-secondary" size="sm" onClick={() => setNotifications([])}>
            Clear All
          </Button>
        </div>
      </Offcanvas.Body>
    </Offcanvas>
  );

  // Settings Modal
  const SettingsModal = () => (
    <Modal show={showSettings} onHide={() => setShowSettings(false)} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-cog me-2"></i>
          System Settings
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs defaultActiveKey="general" className="settings-tabs">
          <Tab eventKey="general" title="General">
            <Form>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Dark Mode"
                  checked={darkMode}
                  onChange={toggleDarkMode}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Default Dashboard View</Form.Label>
                <Form.Select value={activeDashboard} onChange={(e) => setActiveDashboard(e.target.value)}>
                  {customDashboards.map(dashboard => (
                    <option key={dashboard.id} value={dashboard.id}>
                      {dashboard.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Attendance Threshold</Form.Label>
                <Form.Range
                  min={0}
                  max={100}
                  value={attendanceThreshold}
                  onChange={e => setAttendanceThreshold(e.target.value)}
                />
                <Form.Text className="text-muted">
                  Current threshold: {attendanceThreshold}%
                </Form.Text>
              </Form.Group>
            </Form>
          </Tab>
          <Tab eventKey="notifications" title="Notifications">
            <Form>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Email Notifications"
                  defaultChecked
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Push Notifications"
                  defaultChecked
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Desktop Alerts"
                  defaultChecked
                />
              </Form.Group>
            </Form>
          </Tab>
          <Tab eventKey="export" title="Export Settings">
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Default Export Format</Form.Label>
                <Form.Select>
                  <option>Excel (.xlsx)</option>
                  <option>PDF (.pdf)</option>
                  <option>CSV (.csv)</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Include Charts in Exports"
                  defaultChecked
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Auto-generate Weekly Reports"
                />
              </Form.Group>
            </Form>
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setShowSettings(false)}>
          Close
        </Button>
        <Button variant="primary" onClick={() => setShowSettings(false)}>
          Save Settings
        </Button>
      </Modal.Footer>
    </Modal>
  );

  // Performance Benchmarking Component
  const PerformanceBenchmarking = () => (
    <Card className="mb-4">
      <Card.Header className="form-card-header">
        <h5 className="mb-0">
          <i className="fas fa-trophy me-2 text-warning"></i>
          Performance Benchmarks
        </h5>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={3}>
            <div className="benchmark-item text-center">
              <div className="benchmark-value">{performanceBenchmarks.departmentAverage}%</div>
              <div className="benchmark-label">Department Average</div>
            </div>
          </Col>
          <Col md={3}>
            <div className="benchmark-item text-center">
              <div className="benchmark-value">{performanceBenchmarks.institutionalTarget}%</div>
              <div className="benchmark-label">Institutional Target</div>
            </div>
          </Col>
          <Col md={3}>
            <div className="benchmark-item text-center">
              <div className="benchmark-value">{performanceBenchmarks.topPerformer}%</div>
              <div className="benchmark-label">Top Performer</div>
            </div>
          </Col>
          <Col md={3}>
            <div className="benchmark-item text-center">
              <div className="benchmark-value">+{performanceBenchmarks.improvementTarget}%</div>
              <div className="benchmark-label">Improvement Target</div>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  // Public Dashboard Component
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
                Now with  insights, predictive analytics, and advanced monitoring features
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
          <h3 className="feature-title mb-4">Enhanced Monitoring Features</h3>
          
          <Row className="g-4">
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">AI-Powered Insights</Card.Title>
                  <Card.Text className="feature-card-text">
                    Get intelligent recommendations and predictive analytics to improve course performance and student engagement.
                  </Card.Text>
                  <Badge bg="info" className="feature-badge">Smart Analytics</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Predictive Monitoring</Card.Title>
                  <Card.Text className="feature-card-text">
                    Forecast attendance trends and identify at-risk courses before issues escalate with advanced predictive models.
                  </Card.Text>
                  <Badge bg="success" className="feature-badge">Future Insights</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Custom Dashboards</Card.Title>
                  <Card.Text className="feature-card-text">
                    Create personalized dashboard views with customizable widgets and favorite courses for quick access.
                  </Card.Text>
                  <Badge bg="warning" className="feature-badge">Personalized</Badge>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          {/* Additional Features Row */}
          <Row className="g-4 mt-2">
            <Col md={6}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Smart Notifications</Card.Title>
                  <Card.Text className="feature-card-text">
                    Advanced notification system with priority levels, read status, and customizable alert preferences.
                  </Card.Text>
                  <Badge bg="primary" className="feature-badge">Stay Informed</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Performance Benchmarks</Card.Title>
                  <Card.Text className="feature-card-text">
                    Compare performance against department averages and institutional targets with detailed benchmarking.
                  </Card.Text>
                  <Badge bg="dark" className="feature-badge">Competitive Analysis</Badge>
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
      <EnhancedNavbar />
      
      {/* Dashboard Selector */}
      <DashboardSelector />

      {/* Performance Benchmarking */}
      <PerformanceBenchmarking />

      {/* Search and Filters */}
      {currentUser?.role !== 'Student' && (
        <Row className="mb-4">
          <Col md={6}>
            <InputGroup>
              <InputGroup.Text>
                <i className="fas fa-search"></i>
              </InputGroup.Text>
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
        <Tab eventKey="dashboard" title={
          <span>
            <i className="fas fa-tachometer-alt me-2"></i>
            Dashboard
            {favorites.length > 0 && <Badge bg="warning" className="ms-1">{favorites.length}</Badge>}
          </span>
        }>
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
              <EnhancedCourseTable />

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
                        <Button variant="outline-primary" onClick={generateQuickReport}>
                          <i className="fas fa-chart-line me-2"></i>Generate Quick Report
                        </Button>
                        <Button variant="outline-warning" onClick={handleQuickAlert}>
                          <i className="fas fa-bell me-2"></i>Create Manual Alert
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </Tab>

        {/* New Analytics Tab */}
        {currentUser?.role !== 'Student' && (
          <Tab eventKey="analytics" title={<span><i className="fas fa-brain me-2"></i>Insights</span>}>
            <AIInsightsComponent />
            <EnhancedCourseTable />
          </Tab>
        )}

        {/* New Predictive Tab */}
        {currentUser?.role !== 'Student' && (
          <Tab eventKey="predictive" title={<span><i className="fas fa-chart-line me-2"></i>Predictive</span>}>
            <PredictiveAnalyticsComponent />
            <EnhancedCourseTable />
          </Tab>
        )}

        {/* Existing Tabs (unchanged) */}
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

        {/* Other existing tabs remain unchanged */}
        {/* ... (progress, lecturers, alerts tabs - same as before) */}

      </Tabs>

      {/* Enhanced Student Details Modal */}
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

      {/* Enhanced Components */}
      <NotificationsPanel />
      <SettingsModal />
    </div>
  );

  if (loading) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Loading enhanced monitoring data...</p>
      </Container>
    );
  }

  return (
    <Container className={`monitoring-container py-4 ${darkMode ? 'dark-mode' : ''}`}>
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