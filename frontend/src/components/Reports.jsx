import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Button, Form, Alert, Row, Col, Modal, Card,
  Badge, Tabs, Tab, Table, Spinner, Dropdown, InputGroup
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
    setIsAuthenticated(true);
    setCurrentUser({ id, username, role, name: username });
    setShowLoginModal(false);
    fetchAllData();
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

  // Filter reports
  const filteredReports = reports.filter((report) => {
    const matchesSearch = search === '' ||
      report.course_name?.toLowerCase().includes(search.toLowerCase()) ||
      report.lecturer_name?.toLowerCase().includes(search.toLowerCase()) ||
      report.topic_taught?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filter.status === 'all' || report.status === filter.status;
    const matchesCourse = filter.course === 'all' || report.course_id == filter.course;
    const matchesWeek = filter.week === 'all' || report.week == filter.week;
    let matchesRole = true;
    if (currentUser?.role === 'Lecturer') {
      matchesRole = report.lecturer_id === currentUser.id;
    } else if (currentUser?.role === 'Student') {
      matchesRole = report.status === 'approved';
    }
    return matchesSearch && matchesStatus && matchesCourse && matchesWeek && matchesRole;
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

  const showAlert = (message, type) => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: '' }), 5000);
  };

  // Export
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
              <Dropdown>
                <Dropdown.Toggle variant="secondary">Filters</Dropdown.Toggle>
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
            <Row className="mb-3">
              <Col md={3}>
                <Card className="text-center stat-card">
                  <Card.Body>
                    <h3>{stats.totalReports}</h3>
                    <p>Total Reports</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center stat-card">
                  <Card.Body>
                    <h3>{stats.approvedReports}</h3>
                    <p>Approved</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center stat-card">
                  <Card.Body>
                    <h3>{stats.pendingReports}</h3>
                    <p>Pending</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center stat-card">
                  <Card.Body>
                    <h3>{stats.avgAttendance.toFixed(1)}%</h3>
                    <p>Avg Attendance</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
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