import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Button, Form, Alert, Row, Col, Modal, Card,
  Badge, Tabs, Tab, Table, Spinner, Dropdown, InputGroup,
  ProgressBar, Toast, ToastContainer, ListGroup
} from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Simple debounce utility
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// NEW FEATURE: Enhanced Analytics Dashboard Component
const ReportsAnalyticsDashboard = ({ reports, courses, currentUser }) => {
  const [timeRange, setTimeRange] = useState('month');
  const [selectedMetric, setSelectedMetric] = useState('submissions');

  // Calculate enhanced analytics
  const totalReports = reports.length;
  const approvedReports = reports.filter(r => r.status === 'approved').length;
  const pendingReports = reports.filter(r => r.status === 'pending').length;
  const rejectedReports = reports.filter(r => r.status === 'rejected').length;

  // Attendance analytics
  const attendanceData = reports.map(report => ({
    date: report.date_lecture,
    attendance: report.actual_students / report.total_students * 100 || 0
  }));

  const avgAttendance = attendanceData.length > 0 
    ? attendanceData.reduce((sum, item) => sum + item.attendance, 0) / attendanceData.length 
    : 0;

  // Course performance
  const coursePerformance = courses.map(course => {
    const courseReports = reports.filter(r => r.course_id === course.id);
    const approved = courseReports.filter(r => r.status === 'approved').length;
    return {
      name: course.name,
      total: courseReports.length,
      approved,
      approvalRate: courseReports.length > 0 ? (approved / courseReports.length) * 100 : 0,
      avgAttendance: courseReports.length > 0 
        ? courseReports.reduce((sum, r) => sum + (r.actual_students / r.total_students * 100 || 0), 0) / courseReports.length 
        : 0
    };
  });

  // Weekly trends
  const weeklyTrends = Array.from({ length: 16 }, (_, i) => {
    const week = i + 1;
    const weekReports = reports.filter(r => r.week === week);
    return {
      week,
      submissions: weekReports.length,
      approved: weekReports.filter(r => r.status === 'approved').length,
      attendance: weekReports.length > 0 
        ? weekReports.reduce((sum, r) => sum + (r.actual_students / r.total_students * 100 || 0), 0) / weekReports.length 
        : 0
    };
  });

  return (
    <div className="reports-analytics-dashboard">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Reports Analytics</h4>
        <div className="d-flex gap-2">
          <Form.Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} size="sm">
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </Form.Select>
          <Form.Select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)} size="sm">
            <option value="submissions">Submissions</option>
            <option value="attendance">Attendance</option>
            <option value="approval">Approval Rate</option>
          </Form.Select>
        </div>
      </div>

      {/* Key Metrics */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="metric-card text-center">
            <Card.Body>
              <div className="metric-icon submissions">
                <i className="fas fa-file-alt"></i>
              </div>
              <h3 className="metric-value">{totalReports}</h3>
              <p className="metric-label">Total Reports</p>
              <ProgressBar 
                now={(totalReports / Math.max(totalReports, 1)) * 100} 
                variant="primary" 
                className="metric-progress"
              />
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="metric-card text-center">
            <Card.Body>
              <div className="metric-icon approved">
                <i className="fas fa-check-circle"></i>
              </div>
              <h3 className="metric-value">{approvedReports}</h3>
              <p className="metric-label">Approved</p>
              <ProgressBar 
                now={totalReports > 0 ? (approvedReports / totalReports) * 100 : 0} 
                variant="success" 
                className="metric-progress"
              />
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="metric-card text-center">
            <Card.Body>
              <div className="metric-icon pending">
                <i className="fas fa-clock"></i>
              </div>
              <h3 className="metric-value">{pendingReports}</h3>
              <p className="metric-label">Pending</p>
              <ProgressBar 
                now={totalReports > 0 ? (pendingReports / totalReports) * 100 : 0} 
                variant="warning" 
                className="metric-progress"
              />
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="metric-card text-center">
            <Card.Body>
              <div className="metric-icon attendance">
                <i className="fas fa-users"></i>
              </div>
              <h3 className="metric-value">{avgAttendance.toFixed(1)}%</h3>
              <p className="metric-label">Avg Attendance</p>
              <ProgressBar 
                now={avgAttendance} 
                variant="info" 
                className="metric-progress"
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Course Performance */}
      <Row className="mb-4">
        <Col md={8}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Course Performance</h5>
            </Card.Header>
            <Card.Body>
              {coursePerformance.filter(course => course.total > 0).map(course => (
                <div key={course.name} className="course-performance mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="course-name">{course.name}</span>
                    <Badge bg={course.approvalRate >= 80 ? 'success' : course.approvalRate >= 60 ? 'warning' : 'danger'}>
                      {course.approvalRate.toFixed(1)}% Approved
                    </Badge>
                  </div>
                  <div className="d-flex gap-2 text-sm text-muted mb-1">
                    <span>{course.total} reports</span>
                    <span>{course.approved} approved</span>
                    <span>{course.avgAttendance.toFixed(1)}% attendance</span>
                  </div>
                  <ProgressBar>
                    <ProgressBar 
                      variant="success" 
                      now={course.approvalRate} 
                      key={1}
                      label={`${course.approvalRate.toFixed(1)}%`}
                    />
                  </ProgressBar>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Weekly Trends</h5>
            </Card.Header>
            <Card.Body>
              {weeklyTrends.filter(week => week.submissions > 0).slice(-8).map(week => (
                <div key={week.week} className="weekly-trend mb-2">
                  <div className="d-flex justify-content-between">
                    <small>Week {week.week}</small>
                    <small>{week.submissions} reports</small>
                  </div>
                  <ProgressBar 
                    now={(week.submissions / Math.max(...weeklyTrends.map(w => w.submissions))) * 100} 
                    variant="info" 
                    size="sm"
                  />
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// NEW FEATURE: Quick Actions Component
const ReportsQuickActions = ({ 
  onNewReport, 
  onExportData, 
  onViewAnalytics, 
  onBulkApprove,
  currentUser 
}) => {
  const lecturerActions = [
    {
      title: 'New Report',
      icon: 'fas fa-plus-circle',
      description: 'Submit new course report',
      action: onNewReport,
      variant: 'primary',
      roles: ['Lecturer']
    },
    {
      title: 'Quick Template',
      icon: 'fas fa-file-medical',
      description: 'Use report template',
      action: () => console.log('Quick template'),
      variant: 'success',
      roles: ['Lecturer']
    },
    {
      title: 'Export Data',
      icon: 'fas fa-download',
      description: 'Export reports to Excel',
      action: onExportData,
      variant: 'info',
      roles: ['Lecturer', 'PRL', 'Program Leader']
    },
    {
      title: 'View Analytics',
      icon: 'fas fa-chart-bar',
      description: 'Reports analytics dashboard',
      action: onViewAnalytics,
      variant: 'warning',
      roles: ['Lecturer', 'PRL', 'Program Leader']
    }
  ];

  const prlActions = [
    {
      title: 'Bulk Approve',
      icon: 'fas fa-check-double',
      description: 'Approve multiple reports',
      action: onBulkApprove,
      variant: 'success',
      roles: ['PRL', 'Program Leader']
    },
    {
      title: 'Pending Review',
      icon: 'fas fa-clipboard-check',
      description: 'Review pending reports',
      action: () => console.log('Pending review'),
      variant: 'warning',
      roles: ['PRL', 'Program Leader']
    }
  ];

  const allActions = [...lecturerActions, ...prlActions].filter(action => 
    action.roles.includes(currentUser?.role)
  );

  return (
    <Card className="mb-4">
      <Card.Header>
        <h5 className="mb-0"><i className="fas fa-bolt me-2"></i>Quick Actions</h5>
      </Card.Header>
      <Card.Body>
        <Row>
          {allActions.slice(0, 4).map((action, index) => (
            <Col md={3} key={index} className="mb-3">
              <Button
                variant={action.variant}
                onClick={action.action}
                className="w-100 quick-action-btn h-100"
                disabled={!currentUser}
              >
                <div className="text-center">
                  <i className={`${action.icon} fa-2x mb-2`}></i>
                  <h6>{action.title}</h6>
                  <small>{action.description}</small>
                </div>
              </Button>
            </Col>
          ))}
        </Row>
      </Card.Body>
    </Card>
  );
};

// NEW FEATURE: Bulk Operations Modal
const BulkOperationsModal = ({ show, onClose, reports, onBulkAction, currentUser }) => {
  const [selectedReports, setSelectedReports] = useState([]);
  const [operation, setOperation] = useState('approve');
  const [comment, setComment] = useState('');

  const toggleSelectAll = () => {
    if (selectedReports.length === reports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(reports.map(r => r.id));
    }
  };

  const toggleSelectReport = (reportId) => {
    if (selectedReports.includes(reportId)) {
      setSelectedReports(selectedReports.filter(id => id !== reportId));
    } else {
      setSelectedReports([...selectedReports, reportId]);
    }
  };

  const handleBulkOperation = () => {
    onBulkAction(operation, selectedReports, comment);
    onClose();
  };

  const canPerformAction = currentUser?.role === 'PRL' || currentUser?.role === 'Program Leader';

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Bulk Report Operations</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info">
          Select reports to perform bulk operations ({selectedReports.length} selected)
        </Alert>

        {canPerformAction ? (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Operation Type</Form.Label>
              <Form.Select value={operation} onChange={(e) => setOperation(e.target.value)}>
                <option value="approve">Approve Selected</option>
                <option value="reject">Reject Selected</option>
                <option value="export">Export Selected</option>
              </Form.Select>
            </Form.Group>

            {(operation === 'approve' || operation === 'reject') && (
              <Form.Group className="mb-3">
                <Form.Label>Comment (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add comment for bulk action..."
                />
              </Form.Group>
            )}

            <div className="reports-selection">
              <Form.Check
                type="checkbox"
                label="Select All Reports"
                checked={selectedReports.length === reports.length}
                onChange={toggleSelectAll}
                className="mb-3"
              />
              
              <div className="reports-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {reports.map(report => (
                  <Form.Check
                    key={report.id}
                    type="checkbox"
                    label={`${report.course_name} - Week ${report.week} (${report.status})`}
                    checked={selectedReports.includes(report.id)}
                    onChange={() => toggleSelectReport(report.id)}
                    className="mb-2"
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <Alert variant="warning">
            You don't have permission to perform bulk operations. Only PRLs and Program Leaders can approve/reject reports.
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {canPerformAction && (
          <Button 
            variant="primary" 
            onClick={handleBulkOperation}
            disabled={selectedReports.length === 0}
          >
            Perform {operation} ({selectedReports.length})
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

// NEW FEATURE: Report Templates Component
const ReportTemplates = ({ onUseTemplate, currentUser }) => {
  const templates = [
    {
      id: 1,
      name: 'Standard Lecture Report',
      description: 'Basic template for regular lecture sessions',
      fields: ['course_id', 'week_reporting', 'date_lecture', 'topic_taught', 'learning_outcomes']
    },
    {
      id: 2,
      name: 'Practical Session Report',
      description: 'Template for laboratory and practical sessions',
      fields: ['course_id', 'week_reporting', 'date_lecture', 'topic_taught', 'teaching_methods', 'challenges_faced']
    },
    {
      id: 3,
      name: 'Tutorial Report',
      description: 'Template for tutorial and small group sessions',
      fields: ['course_id', 'week_reporting', 'date_lecture', 'topic_taught', 'actual_students', 'recommendations']
    }
  ];

  const handleTemplateSelect = (template) => {
    const templateData = {
      teaching_methods: template.name.includes('Practical') ? 'Hands-on laboratory work' : 
                       template.name.includes('Tutorial') ? 'Small group discussion' : 'Lecture presentation',
      challenges_faced: template.name.includes('Practical') ? 'Equipment availability' : 
                       template.name.includes('Tutorial') ? 'Student engagement' : 'Time management',
      recommendations: 'Continue with current approach'
    };
    onUseTemplate(templateData);
  };

  if (currentUser?.role !== 'Lecturer') {
    return null;
  }

  return (
    <Card className="mb-4">
      <Card.Header>
        <h5 className="mb-0"><i className="fas fa-sticky-note me-2"></i>Report Templates</h5>
      </Card.Header>
      <Card.Body>
        <Row>
          {templates.map(template => (
            <Col md={4} key={template.id} className="mb-3">
              <Card className="template-card h-100">
                <Card.Body>
                  <Card.Title className="template-title">{template.name}</Card.Title>
                  <Card.Text className="template-description">{template.description}</Card.Text>
                  <div className="template-fields">
                    <small className="text-muted">Includes: {template.fields.length} pre-filled fields</small>
                  </div>
                </Card.Body>
                <Card.Footer>
                  <Button 
                    variant="outline-primary" 
                    size="sm" 
                    onClick={() => handleTemplateSelect(template)}
                    className="w-100"
                  >
                    Use Template
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      </Card.Body>
    </Card>
  );
};

// Authentication Modal with Role Selection - MOVED ABOVE Reports component
const LoginModal = ({ show, onHide, onSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: ''
  });
  const [loginError, setLoginError] = useState('');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');
    try {
      const payload = {
        username: formData.username,
        password: formData.password,
        role: formData.role,
      };
      const res = await axios.post('https://matsepe.onrender.com/api/auth/login', payload);
      const { id, username, role, token } = res.data;
      const allowedRoles = ['Lecturer', 'PRL', 'Program Leader', 'Student'];
      if (!allowedRoles.includes(role)) {
        setLoginError('Access denied. Your role does not have permission to access reports.');
        return;
      }
      
      // Call success callback
      onSuccess({ id, username, role, token });
      
      // Reset form and close modal
      setFormData({ username: '', password: '', role: '' });
      onHide();
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Login failed. Please check your credentials and try again.');
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      backdrop="static"
      keyboard={false}
      centered
      className="login-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>Login to Reports System</Modal.Title>
      </Modal.Header>
      <Form autoComplete="on" onSubmit={handleSubmit}>
        <Modal.Body>
          {loginError && <Alert variant="danger">{loginError}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Username</Form.Label>
            <Form.Control
              type="text"
              autoComplete="username"
              value={formData.username}
              onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
              placeholder="Enter your username"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Enter your password"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Role</Form.Label>
            <Form.Select
              value={formData.role}
              onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
              required
            >
              <option value="">Select Role</option>
              <option value="Student">Student</option>
              <option value="Lecturer">Lecturer</option>
              <option value="PRL">PRL</option>
              <option value="Program Leader">Program Leader</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!formData.username || !formData.password || !formData.role}
          >
            Login
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

// Now the main Reports component
const Reports = () => {
  const [formData, setFormData] = useState({
    course_id: '',
    week_reporting: '',
    date_lecture: '',
    actual_students: '',
    total_students: '',
    venue: '',
    scheduled_time: '',
    topic_taught: '',
    learning_outcomes: '',
    recommendations: '',
    teaching_methods: '',
    challenges_faced: '',
  });
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState({ status: 'all', course: 'all', week: 'all' });
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const [activeTab, setActiveTab] = useState('my-reports');
  const [stats, setStats] = useState({
    totalReports: 0,
    approvedReports: 0,
    pendingReports: 0,
    avgAttendance: 0,
    submissionRate: 0,
  });
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [publicStats, setPublicStats] = useState({
    totalReports: 0,
    approvedReports: 0,
    pendingReports: 0,
    activeLecturers: 0,
    totalCourses: 0,
  });

  // NEW FEATURE STATES
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    dateFrom: '',
    dateTo: '',
    minAttendance: '',
    maxAttendance: '',
    hasChallenges: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Fetch public stats for dashboard
  useEffect(() => {
    const fetchPublicStats = async () => {
      try {
        const res = await axios.get('https://matsepe.onrender.com/api/reports/public-stats');
        setPublicStats(res.data);
      } catch (err) {
        setPublicStats({
          totalReports: 0,
          approvedReports: 0,
          pendingReports: 0,
          activeLecturers: 0,
          totalCourses: 0,
        });
      }
    };
    fetchPublicStats();

    // Authentication check
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
      setIsAuthenticated(true);
      fetchAllData();
      initializeNotifications();
    }
  }, []);

  // NEW FEATURE: Initialize notifications
  const initializeNotifications = () => {
    const sampleNotifications = [
      {
        id: 1,
        title: 'Welcome to Reports System',
        message: 'New analytics features are now available.',
        timestamp: new Date(),
        type: 'info'
      },
      {
        id: 2,
        title: 'Report Submitted',
        message: 'Your course report has been submitted successfully.',
        timestamp: new Date(Date.now() - 3600000),
        type: 'success'
      }
    ];
    setNotifications(sampleNotifications);
  };

  // Login success handler
  const handleLoginSuccess = (userData) => {
    const { id, username, role, token } = userData;
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('user_id', id);
    localStorage.setItem('user_name', username);
    localStorage.setItem('user_username', username);
    setIsAuthenticated(true);
    setCurrentUser({ id, username, role, name: username });
    setShowLoginModal(false);
    fetchAllData();
    initializeNotifications();
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_username');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setReports([]);
    setCourses([]);
    setLecturers([]);
    setStudents([]);
    setNotifications([]);
  };

  // Fetch all data (only when authenticated)
  const fetchAllData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setReports([]);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const requests = [
        axios.get('https://matsepe.onrender.com/api/reports', { headers }),
        axios.get('https://matsepe.onrender.com/api/courses', { headers }),
      ];
      if (currentUser?.role === 'PRL' || currentUser?.role === 'Program Leader') {
        requests.push(axios.get('https://matsepe.onrender.com/api/users?role=Lecturer', { headers }));
      }
      if (currentUser?.role === 'Student') {
        requests.push(axios.get('https://matsepe.onrender.com/api/users?role=Student', { headers }));
      }
      const [reportsRes, coursesRes, ...otherRes] = await Promise.all(requests);
      setReports(reportsRes.data || []);
      setCourses(coursesRes.data || []);
      if (otherRes[0]) {
        if (currentUser?.role === 'PRL' || currentUser?.role === 'Program Leader') {
          setLecturers(otherRes[0].data || []);
        } else if (currentUser?.role === 'Student') {
          setStudents(otherRes[0].data || []);
        }
      }
      calculateStats(reportsRes.data || []);
    } catch (err) {
      showAlert('Error loading data', 'danger');
    }
    setLoading(false);
  }, [isAuthenticated, currentUser]);

  const calculateStats = (reportsData) => {
    const totalReports = reportsData.length;
    const approvedReports = reportsData.filter((r) => r.status === 'approved').length;
    const pendingReports = reportsData.filter((r) => r.status === 'pending').length;
    const avgAttendance = reportsData.length > 0
      ? (reportsData.reduce((acc, report) => acc + (report.actual_students / report.total_students), 0) / reportsData.length) * 100
      : 0;
    const submissionRate = totalReports > 0 ? Math.min((totalReports / 20) * 100, 100) : 0;
    setStats({
      totalReports,
      approvedReports,
      pendingReports,
      avgAttendance,
      submissionRate,
    });
  };

  const debouncedFetch = useCallback(debounce(() => fetchAllData(), 300), [fetchAllData]);

  useEffect(() => {
    debouncedFetch();
  }, [debouncedFetch]);

  // Enhanced filtering with advanced filters
  const filteredReports = reports.filter((report) => {
    const matchesSearch = search === '' ||
      report.course_name?.toLowerCase().includes(search.toLowerCase()) ||
      report.lecturer_name?.toLowerCase().includes(search.toLowerCase()) ||
      report.topic_taught?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filter.status === 'all' || report.status === filter.status;
    const matchesCourse = filter.course === 'all' || report.course_id == filter.course;
    const matchesWeek = filter.week === 'all' || report.week == filter.week;
    
    // NEW: Advanced filters
    const matchesDateFrom = !advancedFilters.dateFrom || new Date(report.date_lecture) >= new Date(advancedFilters.dateFrom);
    const matchesDateTo = !advancedFilters.dateTo || new Date(report.date_lecture) <= new Date(advancedFilters.dateTo);
    const attendanceRate = (report.actual_students / report.total_students) * 100 || 0;
    const matchesMinAttendance = !advancedFilters.minAttendance || attendanceRate >= parseInt(advancedFilters.minAttendance);
    const matchesMaxAttendance = !advancedFilters.maxAttendance || attendanceRate <= parseInt(advancedFilters.maxAttendance);
    const matchesChallenges = advancedFilters.hasChallenges === '' || 
      (advancedFilters.hasChallenges === 'yes' && report.challenges_faced) ||
      (advancedFilters.hasChallenges === 'no' && !report.challenges_faced);

    let matchesRole = true;
    if (currentUser?.role === 'Lecturer') {
      matchesRole = report.lecturer_id === currentUser.id;
    } else if (currentUser?.role === 'Student') {
      matchesRole = report.status === 'approved';
    }
    
    return matchesSearch && matchesStatus && matchesCourse && matchesWeek && 
           matchesRole && matchesDateFrom && matchesDateTo && matchesMinAttendance && 
           matchesMaxAttendance && matchesChallenges;
  });

  // Submit report
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (currentUser?.role !== 'Lecturer') {
      showAlert('Only lecturers can submit reports', 'warning');
      return;
    }
    if (!formData.course_id || !formData.week_reporting || !formData.date_lecture || !formData.topic_taught) {
      showAlert('Please fill in all required fields', 'danger');
      return;
    }
    const processedData = {
      ...formData,
      course_id: parseInt(formData.course_id),
      week: parseInt(formData.week_reporting),
      actual_students: parseInt(formData.actual_students) || 0,
      total_students: parseInt(formData.total_students) || 0,
      lecturer_id: currentUser?.id,
      lecturer_name: currentUser?.name,
      status: 'pending',
      submission_date: new Date().toISOString(),
    };
    try {
      const token = localStorage.getItem('token');
      await axios.post('https://matsepe.onrender.com/api/reports', processedData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showAlert('Report submitted successfully! Waiting for approval.', 'success');
      
      // NEW: Add notification
      setNotifications(prev => [{
        id: Date.now(),
        title: 'Report Submitted',
        message: `Your report for ${courses.find(c => c.id == formData.course_id)?.name} has been submitted.`,
        timestamp: new Date(),
        type: 'success'
      }, ...prev]);
      
      setFormData({
        course_id: '',
        week_reporting: '',
        date_lecture: '',
        actual_students: '',
        total_students: '',
        venue: '',
        scheduled_time: '',
        topic_taught: '',
        learning_outcomes: '',
        recommendations: '',
        teaching_methods: '',
        challenges_faced: '',
      });
      fetchAllData();
      setActiveTab('my-reports');
    } catch (err) {
      showAlert('Error: ' + (err.response?.data?.error || 'Submission failed'), 'danger');
    }
  };

  // NEW FEATURE: Use template
  const handleUseTemplate = (templateData) => {
    setFormData(prev => ({
      ...prev,
      ...templateData
    }));
    setActiveTab('submit-report');
    showAlert('Template applied! Please fill in the remaining details.', 'info');
  };

  // Approve/Reject
  const handleApproveReject = async (reportId, action) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (currentUser?.role !== 'PRL' && currentUser?.role !== 'Program Leader') {
      showAlert('Only PRLs and Program Leaders can approve/reject reports', 'warning');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `https://matsepe.onrender.com/api/reports/${reportId}`,
        {
          status: action,
          reviewed_by: currentUser?.id,
          review_date: new Date().toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showAlert(`Report ${action} successfully`, 'success');
      fetchAllData();
      setShowModal(false);
    } catch (err) {
      showAlert('Error updating report status', 'danger');
    }
  };

  // NEW FEATURE: Bulk operations
  const handleBulkOperation = async (operation, selectedReports, comment = '') => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (currentUser?.role !== 'PRL' && currentUser?.role !== 'Program Leader') {
      showAlert('Only PRLs and Program Leaders can perform bulk operations', 'warning');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      if (operation === 'export') {
        // Export selected reports
        const selectedReportData = reports.filter(report => selectedReports.includes(report.id));
        const excelData = selectedReportData.map(report => ({
          'Course': report.course_name,
          'Week': report.week,
          'Date': new Date(report.date_lecture).toLocaleDateString(),
          'Lecturer': report.lecturer_name,
          'Topic': report.topic_taught,
          'Status': report.status,
          'Attendance': `${report.actual_students}/${report.total_students}`,
          'Attendance Rate': `${((report.actual_students / report.total_students) * 100).toFixed(1)}%`
        }));
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Selected Reports');
        XLSX.writeFile(wb, `reports_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showAlert(`Exported ${selectedReports.length} reports successfully!`, 'success');
      } else {
        // Bulk approve/reject
        const promises = selectedReports.map(reportId =>
          axios.put(
            `https://matsepe.onrender.com/api/reports/${reportId}`,
            {
              status: operation,
              reviewed_by: currentUser?.id,
              review_date: new Date().toISOString(),
              ...(comment && { review_comment: comment })
            },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        );
        
        await Promise.all(promises);
        showAlert(`Successfully ${operation}d ${selectedReports.length} reports`, 'success');
        fetchAllData();
      }
    } catch (err) {
      showAlert('Error performing bulk operation', 'danger');
    }
  };

  const showAlert = (message, type) => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: '' }), 5000);
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

  // Public Dashboard - Updated to match Students component style
  const PublicDashboard = () => (
    <div className="public-dashboard">
      <div className="university-hero">
        <Container>
          <div className="hero-content text-center">
            <h1 className="university-title">University Reports Management System</h1>
            <p className="university-subtitle">Streamline Course Reporting, Approval, and Analytics</p>
          </div>
        </Container>
      </div>
      
      <Container className="py-5">
        <div className="login-section text-center mb-5">
          <Card className="login-feature-card">
            <Card.Body className="p-5">
              <h2 className="portal-title">Reports Portal</h2>
              <p className="portal-subtitle mb-4">Access comprehensive course reporting and analytics tools</p>
              <Button variant="primary" size="lg" onClick={() => setShowLoginModal(true)} className="login-btn-main">
                <i className="fas fa-sign-in-alt me-2"></i>Login to Access Reports
              </Button>
            </Card.Body>
          </Card>
        </div>
        
        {/* Feature Showcase */}
        <div className="feature-showcase mt-5">
          <h3 className="feature-title mb-4">Comprehensive Reports Management</h3>
          
          <Row className="g-4">
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Course Reporting</Card.Title>
                  <Card.Text className="feature-card-text">
                    Submit detailed course reports including attendance, topics taught, 
                    learning outcomes, and teaching methodologies for each session.
                  </Card.Text>
                  <Badge bg="info" className="feature-badge">Course Management</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Approval Workflow</Card.Title>
                  <Card.Text className="feature-card-text">
                    Streamlined approval process with PRL and Program Leader review. 
                    Track report status and receive timely feedback on submissions.
                  </Card.Text>
                  <Badge bg="success" className="feature-badge">Quality Assurance</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Analytics & Insights</Card.Title>
                  <Card.Text className="feature-card-text">
                    Comprehensive analytics on attendance rates, submission trends, 
                    and course performance metrics for data-driven decisions.
                  </Card.Text>
                  <Badge bg="warning" className="feature-badge">Data Analytics</Badge>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          {/* Additional Features Row */}
          <Row className="g-4 mt-2">
            <Col md={6}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Role-Based Access</Card.Title>
                  <Card.Text className="feature-card-text">
                    Secure access control with different permissions for Lecturers, 
                    PRLs, Program Leaders, and Students based on their responsibilities.
                  </Card.Text>
                  <Badge bg="primary" className="feature-badge">Security</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Export Capabilities</Card.Title>
                  <Card.Text className="feature-card-text">
                    Download reports and analytics in multiple formats including Excel, 
                    PDF, and CSV for documentation and presentation purposes.
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
                <div className="stat-number">{publicStats.totalReports}</div>
                <div className="stat-label">Total Reports</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.approvedReports}</div>
                <div className="stat-label">Approved Reports</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.activeLecturers}</div>
                <div className="stat-label">Active Lecturers</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.totalCourses}</div>
                <div className="stat-label">Courses</div>
              </div>
            </Col>
          </Row>
        </div>
      </Container>
    </div>
  );

  // Main Reports Management
  const ReportsManagementSystem = () => (
    <div>
      {/* NEW: Notification Toast Container */}
      <ToastContainer position="top-end" className="p-3">
        {notifications.slice(0, 3).map((notification, index) => (
          <Toast key={notification.id} show={true} delay={5000} autohide>
            <Toast.Header>
              <strong className="me-auto">{notification.title}</strong>
              <small>{new Date(notification.timestamp).toLocaleTimeString()}</small>
            </Toast.Header>
            <Toast.Body>{notification.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Reports Module</h2>
        <div>
          <Badge bg="secondary" className="me-2">
            {currentUser?.name} ({currentUser?.role})
          </Badge>
          <Button variant="outline-danger" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
      {alert.show && <Alert variant={alert.type}>{alert.message}</Alert>}
      
      {/* NEW: Quick Actions */}
      <ReportsQuickActions
        onNewReport={() => setActiveTab('submit-report')}
        onExportData={() => setShowBulkModal(true)}
        onViewAnalytics={() => setActiveTab('analytics')}
        onBulkApprove={() => setShowBulkModal(true)}
        currentUser={currentUser}
      />

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading reports data...</p>
        </div>
      ) : (
        <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-3">
          <Tab eventKey="my-reports" title="My Reports">
            <div className="d-flex justify-content-between mb-3">
              <InputGroup style={{ maxWidth: '300px' }}>
                <InputGroup.Text>Search</InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search reports..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
              <div className="d-flex gap-2">
                <Button 
                  variant="outline-secondary" 
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <i className="fas fa-filter me-2"></i>
                  Advanced Filters
                </Button>
                <Dropdown>
                  <Dropdown.Toggle variant="secondary">Quick Filters</Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Header>Status</Dropdown.Header>
                    <Dropdown.Item onClick={() => setFilter(prev => ({ ...prev, status: 'all' }))}>All</Dropdown.Item>
                    <Dropdown.Item onClick={() => setFilter(prev => ({ ...prev, status: 'approved' }))}>Approved</Dropdown.Item>
                    <Dropdown.Item onClick={() => setFilter(prev => ({ ...prev, status: 'pending' }))}>Pending</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Header>Course</Dropdown.Header>
                    {courses.map((course) => (
                      <Dropdown.Item key={course.id} onClick={() => setFilter(prev => ({ ...prev, course: course.id }))}>
                        {course.name}
                      </Dropdown.Item>
                    ))}
                    <Dropdown.Divider />
                    <Dropdown.Header>Week</Dropdown.Header>
                    {[...Array(16)].map((_, i) => (
                      <Dropdown.Item key={i + 1} onClick={() => setFilter(prev => ({ ...prev, week: i + 1 }))}>
                        Week {i + 1}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </div>

            {/* NEW: Advanced Filters */}
            {showAdvancedFilters && (
              <Card className="mb-3">
                <Card.Body>
                  <Row>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Date From</Form.Label>
                        <Form.Control
                          type="date"
                          value={advancedFilters.dateFrom}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Date To</Form.Label>
                        <Form.Control
                          type="date"
                          value={advancedFilters.dateTo}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Min Attendance %</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          max="100"
                          value={advancedFilters.minAttendance}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, minAttendance: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Max Attendance %</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          max="100"
                          value={advancedFilters.maxAttendance}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, maxAttendance: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Has Challenges</Form.Label>
                        <Form.Select
                          value={advancedFilters.hasChallenges}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, hasChallenges: e.target.value }))}
                        >
                          <option value="">All</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}

            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Week</th>
                  <th>Date</th>
                  <th>Lecturer</th>
                  <th>Topic</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.course_name}</td>
                    <td>Week {report.week}</td>
                    <td>{new Date(report.date_lecture).toLocaleDateString()}</td>
                    <td>{report.lecturer_name}</td>
                    <td>{report.topic_taught}</td>
                    <td>
                      <Badge
                        bg={
                          report.status === 'approved'
                            ? 'success'
                            : report.status === 'pending'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {report.status}
                      </Badge>
                    </td>
                    <td>
                      <Button variant="info" size="sm" onClick={() => { setSelectedReport(report); setShowModal(true); }}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Tab>
          <Tab eventKey="submit-report" title="Submit Report" disabled={currentUser?.role !== 'Lecturer'}>
            {/* NEW: Report Templates */}
            <ReportTemplates 
              onUseTemplate={handleUseTemplate}
              currentUser={currentUser}
            />
            
            <Form onSubmit={handleSubmit}>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Course</Form.Label>
                    <Form.Select
                      value={formData.course_id}
                      onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                      required
                    >
                      <option value="">Select course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Week</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      max="16"
                      value={formData.week_reporting}
                      onChange={(e) => setFormData({ ...formData, week_reporting: e.target.value })}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={formData.date_lecture}
                      onChange={(e) => setFormData({ ...formData, date_lecture: e.target.value })}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Actual Students</Form.Label>
                    <Form.Control
                      type="number"
                      value={formData.actual_students}
                      onChange={(e) => setFormData({ ...formData, actual_students: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Total Students</Form.Label>
                    <Form.Control
                      type="number"
                      value={formData.total_students}
                      onChange={(e) => setFormData({ ...formData, total_students: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Venue</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.venue}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Scheduled Time</Form.Label>
                    <Form.Control
                      type="time"
                      value={formData.scheduled_time}
                      onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Topic Taught</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.topic_taught}
                      onChange={(e) => setFormData({ ...formData, topic_taught: e.target.value })}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Learning Outcomes</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.learning_outcomes}
                      onChange={(e) => setFormData({ ...formData, learning_outcomes: e.target.value })}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Teaching Methods</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={formData.teaching_methods}
                      onChange={(e) => setFormData({ ...formData, teaching_methods: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Challenges Faced</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={formData.challenges_faced}
                      onChange={(e) => setFormData({ ...formData, challenges_faced: e.target.value })}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Recommendations</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formData.recommendations}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                />
              </Form.Group>
              <Button variant="primary" type="submit">Submit Report</Button>
            </Form>
          </Tab>
          <Tab eventKey="analytics" title="Analytics" disabled={currentUser?.role === 'Student'}>
            {/* NEW: Enhanced Analytics Dashboard */}
            <ReportsAnalyticsDashboard
              reports={reports}
              courses={courses}
              currentUser={currentUser}
            />
          </Tab>
        </Tabs>
      )}

      {/* Report Detail Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Report Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedReport && (
            <>
              <p><strong>Course:</strong> {selectedReport.course_name}</p>
              <p><strong>Week:</strong> {selectedReport.week}</p>
              <p><strong>Date:</strong> {new Date(selectedReport.date_lecture).toLocaleDateString()}</p>
              <p><strong>Lecturer:</strong> {selectedReport.lecturer_name}</p>
              <p><strong>Topic:</strong> {selectedReport.topic_taught}</p>
              <p><strong>Learning Outcomes:</strong> {selectedReport.learning_outcomes}</p>
              <p><strong>Teaching Methods:</strong> {selectedReport.teaching_methods}</p>
              <p><strong>Challenges:</strong> {selectedReport.challenges_faced}</p>
              <p><strong>Recommendations:</strong> {selectedReport.recommendations}</p>
              <p>
                <strong>Status:</strong>{' '}
                <Badge
                  bg={
                    selectedReport.status === 'approved'
                      ? 'success'
                      : selectedReport.status === 'pending'
                      ? 'warning'
                      : 'danger'
                  }
                >
                  {selectedReport.status}
                </Badge>
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {currentUser?.role !== 'Lecturer' && (
            <>
              <Button
                variant="success"
                onClick={() => handleApproveReject(selectedReport.id, 'approved')}
                disabled={selectedReport?.status === 'approved'}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() => handleApproveReject(selectedReport.id, 'rejected')}
                disabled={selectedReport?.status === 'rejected'}
              >
                Reject
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* NEW: Bulk Operations Modal */}
      <BulkOperationsModal
        show={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        reports={reports.filter(r => r.status === 'pending')}
        onBulkAction={handleBulkOperation}
        currentUser={currentUser}
      />
    </div>
  );

  return (
    <Container className="py-4">
      {!isAuthenticated ? <PublicDashboard /> : <ReportsManagementSystem />}
      
      {/* Login Modal - Now available for both authenticated and non-authenticated states */}
      <LoginModal
        show={showLoginModal}
        onHide={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </Container>
  );
};

export default Reports;