import React, { useState, useEffect } from 'react';
import { Container, Button, Form, Alert, Row, Col, Modal, Card, Badge, Tabs, Tab, Dropdown } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';

const Lecturers = ({ onProtectedAction }) => {
  const [lecturers, setLecturers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [reports, setReports] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [search, setSearch] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [statistics, setStatistics] = useState({
    activeLecturers: 0,
    classesManaged: 0,
    monthlyReports: 0,
    accessStatus: '24/7',
  });

  const [reportForm, setReportForm] = useState({
    faculty_name: '',
    class_name: '',
    week_of_reporting: '',
    date_lecture: new Date().toISOString().split('T')[0],
    course_name: '',
    course_code: '',
    lecturer_name: '',
    actual_students: '',
    total_students: '',
    venue: '',
    scheduled_time: '',
    topic_taught: '',
    learning_outcomes: '',
    recommendations: '',
  });

  // Faculty options
  const facultyOptions = [
    "Faculty of Information and Communication Technology",
    "Faculty of Business Management and Globalisation", 
    "Faculty of Design and Innovation"
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        if (user.role === 'Lecturer') {
          fetchLecturerData();
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
        handleLogout();
      }
    }
  }, []);

  const fetchLecturerData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const coursesRes = await axios.get('https://matsepe.onrender.com/api/lecturer/courses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(coursesRes.data || []);

      const classesRes = await axios.get('https://matsepe.onrender.com/api/lecturer/classes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClasses(classesRes.data || []);

      const reportsRes = await axios.get('https://matsepe.onrender.com/api/lecturer/reports', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(reportsRes.data || []);

      const ratingsRes = await axios.get('https://matsepe.onrender.com/api/lecturer/ratings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRatings(ratingsRes.data || []);

      const lecturersRes = await axios.get('https://matsepe.onrender.com/api/users?role=Lecturer', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLecturers(lecturersRes.data || []);

      const statsRes = await axios.get('https://matsepe.onrender.com/api/lecturer/statistics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatistics(statsRes.data || {
        activeLecturers: 0,
        classesManaged: 0,
        monthlyReports: 0,
        accessStatus: '24/7',
      });
    } catch (err) {
      console.error('Error fetching lecturer data:', err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const exportReportsToExcel = () => {
    if (!currentUser || !currentUser.username) {
      setError('User information not available for export');
      return;
    }
    
    if (reports.length === 0) {
      setError('No reports to export');
      return;
    }
    try {
      const excelData = reports.map(report => {
        return {
          'Faculty Name': report.faculty_name,
          'Class Name': report.class_name,
          'Week of Reporting': report.week_of_reporting,
          'Date of Lecture': new Date(report.date_lecture).toLocaleDateString(),
          'Course Name': report.course_name,
          'Course Code': report.course_code,
          'Lecturer Name': report.lecturer_name,
          'Actual Students Present': report.actual_students,
          'Total Registered Students': report.total_students,
          'Venue': report.venue,
          'Scheduled Time': report.scheduled_time,
          'Topic Taught': report.topic_taught,
          'Learning Outcomes': report.learning_outcomes,
          'Lecturer Recommendations': report.recommendations,
          'Submitted On': new Date(report.created_at).toLocaleDateString()
        };
      });
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Lecturer Reports');
      XLSX.writeFile(wb, `lecturer_reports_${currentUser.username}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccess('Reports exported to Excel successfully!');
    } catch (err) {
      setError('Error exporting to Excel: ' + err.message);
    }
  };

  const exportRatingsToExcel = () => {
    if (!currentUser || !currentUser.username) {
      setError('User information not available for export');
      return;
    }
    
    if (ratings.length === 0) {
      setError('No ratings to export');
      return;
    }
    try {
      const excelData = ratings.map(rating => {
        const course = courses.find(c => c.id === rating.course_id);
        return {
          'Course': course ? `${course.name} (${course.code})` : 'N/A',
          'Rating': `${rating.rating}/5`,
          'Student Feedback': rating.comment,
          'Submitted Date': new Date(rating.created_at).toLocaleDateString(),
          'Student ID': rating.user_id
        };
      });
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Course Ratings');
      XLSX.writeFile(wb, `course_ratings_${currentUser.username}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccess('Ratings exported to Excel successfully!');
    } catch (err) {
      setError('Error exporting to Excel: ' + err.message);
    }
  };

  const exportAllDataToExcel = () => {
    if (!currentUser || !currentUser.username) {
      setError('User information not available for export');
      return;
    }
    
    try {
      const wb = XLSX.utils.book_new();
      const profileData = [{
        'Username': currentUser.username,
        'Email': currentUser.email,
        'Faculty': currentUser.faculty_name || 'Not specified',
        'Role': currentUser.role,
        'Assigned Courses': courses.length,
        'Total Classes': classes.length,
        'Total Reports': reports.length,
        'Total Ratings': ratings.length
      }];
      const profileWs = XLSX.utils.json_to_sheet(profileData);
      XLSX.utils.book_append_sheet(wb, profileWs, 'Lecturer Profile');
      
      if (reports.length > 0) {
        const reportsData = reports.map(report => {
          return {
            'Faculty Name': report.faculty_name,
            'Class Name': report.class_name,
            'Week of Reporting': report.week_of_reporting,
            'Date of Lecture': new Date(report.date_lecture).toLocaleDateString(),
            'Course Name': report.course_name,
            'Course Code': report.course_code,
            'Lecturer Name': report.lecturer_name,
            'Actual Students Present': report.actual_students,
            'Total Registered Students': report.total_students,
            'Venue': report.venue,
            'Scheduled Time': report.scheduled_time,
            'Topic Taught': report.topic_taught,
            'Learning Outcomes': report.learning_outcomes,
            'Lecturer Recommendations': report.recommendations,
            'Submitted On': new Date(report.created_at).toLocaleDateString()
          };
        });
        const reportsWs = XLSX.utils.json_to_sheet(reportsData);
        XLSX.utils.book_append_sheet(wb, reportsWs, 'Reports');
      }
      
      if (ratings.length > 0) {
        const ratingsData = ratings.map(rating => {
          const course = courses.find(c => c.id === rating.course_id);
          return {
            'Course': course ? `${course.name} (${course.code})` : 'N/A',
            'Rating': `${rating.rating}/5`,
            'Student Feedback': rating.comment,
            'Submitted Date': new Date(rating.created_at).toLocaleDateString()
          };
        });
        const ratingsWs = XLSX.utils.json_to_sheet(ratingsData);
        XLSX.utils.book_append_sheet(wb, ratingsWs, 'Ratings');
      }
      
      if (courses.length > 0) {
        const coursesData = courses.map(course => ({
          'Course Name': course.name,
          'Course Code': course.code,
          'Faculty': course.faculty || 'Not specified',
          'Credits': course.credits,
          'Schedule': course.schedule,
          'Total Students': course.total_students
        }));
        const coursesWs = XLSX.utils.json_to_sheet(coursesData);
        XLSX.utils.book_append_sheet(wb, coursesWs, 'Courses');
      }
      
      XLSX.writeFile(wb, `lecturer_portfolio_${currentUser.username}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccess('All data exported to Excel successfully!');
    } catch (err) {
      setError('Error exporting data to Excel: ' + err.message);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      
      const formData = {
        ...reportForm,
        lecturer_name: reportForm.lecturer_name || currentUser.username
      };
      
      await axios.post('https://matsepe.onrender.com/api/lecturer/reports', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Report submitted successfully!');
      setReportForm({
        faculty_name: '',
        class_name: '',
        week_of_reporting: '',
        date_lecture: new Date().toISOString().split('T')[0],
        course_name: '',
        course_code: '',
        lecturer_name: '',
        actual_students: '',
        total_students: '',
        venue: '',
        scheduled_time: '',
        topic_taught: '',
        learning_outcomes: '',
        recommendations: '',
      });
      fetchLecturerData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setCurrentUser(null);
    setSuccess('Logged out successfully');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAuthSuccess = (userData) => {
    const user = userData.user || userData;
    setCurrentUser(user);
    localStorage.setItem('userData', JSON.stringify(user));
    setSuccess(`Welcome, ${user.username}!`);
    setTimeout(() => setSuccess(''), 3000);

    if (user.role === 'Lecturer') {
      fetchLecturerData();
    }
  };

  if (!currentUser) {
    return (
      <div className="public-dashboard">
        <div className="university-hero">
          <Container>
            <div className="hero-content text-center">
              <h1 className="university-title">Lecturer Portal</h1>
              <p className="university-subtitle">Teaching Management and Reporting System</p>
            </div>
          </Container>
        </div>
        <Container className="py-5">
          <div className="login-section text-center mb-5">
            <Card className="login-feature-card">
              <Card.Body className="p-5">
                <h2 className="portal-title">Lecturer Portal</h2>
                <p className="portal-subtitle mb-4">Access your teaching dashboard and reporting tools</p>
                <Button variant="primary" size="lg" onClick={() => setShowAuthModal(true)} className="login-btn-main">
                  <i className="fas fa-sign-in-alt me-2"></i>Login / Register
                </Button>
              </Card.Body>
            </Card>
          </div>
          <div className="feature-showcase mt-5">
            <h3 className="feature-title mb-4">Lecturer Portal Features</h3>
            <Row className="g-4">
              <Col md={4}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Class Management</Card.Title>
                    <Card.Text className="feature-card-text">
                      View and manage your assigned classes. Track schedules, student enrollment,
                      and class progress throughout the semester.
                    </Card.Text>
                    <Badge bg="info" className="feature-badge">Teaching Tools</Badge>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Academic Reporting</Card.Title>
                    <Card.Text className="feature-card-text">
                      Submit detailed class reports including attendance, topics covered,
                      learning outcomes, and recommendations for improvement.
                    </Card.Text>
                    <Badge bg="success" className="feature-badge">Documentation</Badge>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Progress Analytics</Card.Title>
                    <Card.Text className="feature-card-text">
                      Monitor student attendance trends, track course progress, and analyze
                      teaching effectiveness with comprehensive analytics.
                    </Card.Text>
                    <Badge bg="warning" className="feature-badge">Insights</Badge>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            <Row className="g-4 mt-2">
              <Col md={6}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Student Feedback</Card.Title>
                    <Card.Text className="feature-card-text">
                      View student ratings and feedback for your courses. Understand student
                      perspectives to improve teaching methods and course content.
                    </Card.Text>
                    <Badge bg="primary" className="feature-badge">Feedback</Badge>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Data Export</Card.Title>
                    <Card.Text className="feature-card-text">
                      Export your reports, ratings, and class data to Excel for record keeping,
                      department reviews, or personal analysis.
                    </Card.Text>
                    <Badge bg="dark" className="feature-badge">Export</Badge>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>
          <div className="portal-statistics mt-5">
            <Row className="g-4">
              <Col md={3}>
                <div className="stat-item text-center">
                  <div className="stat-number">{statistics.activeLecturers}</div>
                  <div className="stat-label">Active Lecturers</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="stat-item text-center">
                  <div className="stat-number">{statistics.classesManaged}</div>
                  <div className="stat-label">Classes Managed</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="stat-item text-center">
                  <div className="stat-number">{statistics.monthlyReports}</div>
                  <div className="stat-label">Monthly Reports</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="stat-item text-center">
                  <div className="stat-number">{statistics.accessStatus}</div>
                  <div className="stat-label">Access</div>
                </div>
              </Col>
            </Row>
          </div>
        </Container>
        <AuthModal
          show={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          facultyOptions={facultyOptions}
        />
      </div>
    );
  }

  if (currentUser.role !== 'Lecturer') {
    return (
      <Container className="py-4">
        <Alert variant="warning">
          You are logged in as {currentUser.role}. Please log in as a Lecturer to access this portal.
        </Alert>
        <Button variant="outline-danger" onClick={handleLogout}>
          Logout
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-4 lecturers-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="dashboard-title">Lecturer Dashboard</h2>
          <p className="text-muted welcome-text">Welcome, Professor {currentUser.username}</p>
        </div>
        <div className="d-flex align-items-center">
          <Dropdown className="me-2">
            <Dropdown.Toggle variant="success" id="dropdown-export" className="export-btn">
              <i className="fas fa-download me-2"></i>Export Data
            </Dropdown.Toggle>
            <Dropdown.Menu className="export-menu">
              <Dropdown.Item onClick={() => exportAllDataToExcel()} className="export-item">
                <i className="fas fa-file-excel me-2"></i>Export All Data
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => exportReportsToExcel()} className="export-item">
                <i className="fas fa-file-alt me-2"></i>Export Reports
              </Dropdown.Item>
              <Dropdown.Item onClick={() => exportRatingsToExcel()} className="export-item">
                <i className="fas fa-star me-2"></i>Export Ratings
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button variant="outline-danger" onClick={handleLogout} className="logout-btn">
            <i className="fas fa-sign-out-alt me-2"></i>Logout
          </Button>
        </div>
      </div>
      {error && <Alert variant="danger" onClose={() => setError('')} dismissible className="alert-custom">{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible className="alert-custom">{success}</Alert>}
      <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4 custom-tabs">
        <Tab eventKey="dashboard" title={<span><i className="fas fa-tachometer-alt me-2"></i>Dashboard</span>}>
          <DashboardTab
            currentUser={currentUser}
            classes={classes}
            reports={reports}
            ratings={ratings}
            courses={courses}
            statistics={statistics}
            onExportAll={exportAllDataToExcel}
          />
        </Tab>
        <Tab eventKey="classes" title={<span><i className="fas fa-chalkboard-teacher me-2"></i>My Classes</span>}>
          <ClassesTab
            classes={classes}
            courses={courses}
          />
        </Tab>
        <Tab eventKey="reporting" title={<span><i className="fas fa-file-signature me-2"></i>Reporting</span>}>
          <ReportingTab
            reportForm={reportForm}
            setReportForm={setReportForm}
            courses={courses}
            onSubmit={handleReportSubmit}
            reports={reports}
            onExport={exportReportsToExcel}
            currentUser={currentUser}
            facultyOptions={facultyOptions}
          />
        </Tab>
        <Tab eventKey="ratings" title={<span><i className="fas fa-star me-2"></i>Student Feedback</span>}>
          <RatingsTab
            ratings={ratings}
            courses={courses}
            onExport={exportRatingsToExcel}
          />
        </Tab>
      </Tabs>
    </Container>
  );
};

const DashboardTab = ({ currentUser, classes, reports, ratings, courses, statistics, onExportAll }) => {
  const attendanceRate = reports.length > 0
    ? reports.reduce((acc, report) => acc + (report.actual_students / report.total_students), 0) / reports.length * 100
    : 0;
  const averageRating = ratings.length > 0
    ? ratings.reduce((acc, rating) => acc + rating.rating, 0) / ratings.length
    : 0;
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Teaching Overview</h4>
        <Button variant="outline-primary" onClick={() => onExportAll()} className="export-all-btn">
          <i className="fas fa-file-excel me-2"></i>Export All Data
        </Button>
      </div>
      <Row>
        <Col md={4}>
          <Card className="mb-4 profile-card">
            <Card.Body className="text-center">
              <div className="profile-avatar">
                <i className="fas fa-user-tie"></i>
              </div>
              <Card.Title className="profile-name">Prof. {currentUser.username}</Card.Title>
              <Card.Text className="profile-info">
                <Badge bg="success" className="role-badge">{currentUser.role}</Badge><br/>
                <i className="fas fa-envelope me-2"></i>{currentUser.email}<br/>
                <i className="fas fa-university me-2"></i>{currentUser.faculty_name || 'No faculty assigned'}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={8}>
          <Row>
            <Col md={6}>
              <Card className="mb-4 stats-card">
                <Card.Body className="text-center">
                  <Card.Title className="stats-number">{classes.length}</Card.Title>
                  <Card.Text className="stats-label">Assigned Classes</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-4 stats-card">
                <Card.Body className="text-center">
                  <Card.Title className="stats-number">{reports.length}</Card.Title>
                  <Card.Text className="stats-label">Reports Submitted</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-4 stats-card">
                <Card.Body className="text-center">
                  <Card.Title className="stats-number">{Math.round(attendanceRate)}%</Card.Title>
                  <Card.Text className="stats-label">Average Attendance</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-4 stats-card">
                <Card.Body className="text-center">
                  <Card.Title className="stats-number">{averageRating.toFixed(1)}/5</Card.Title>
                  <Card.Text className="stats-label">Average Rating</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
      <RecentActivity reports={reports} ratings={ratings} />
    </div>
  );
};

const ClassesTab = ({ classes, courses }) => {
  const getCourseName = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    return course ? `${course.name} (${course.code})` : 'Course Not Found';
  };
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">My Assigned Classes</h4>
        <Badge bg="primary" className="classes-count">{classes.length} Classes</Badge>
      </div>
      <Row>
        {classes.length > 0 ? (
          classes.map(cls => (
            <Col md={6} lg={4} key={cls.id} className="mb-4">
              <Card className="class-card">
                <Card.Header className="class-card-header">
                  <h5 className="class-name">{cls.name}</h5>
                </Card.Header>
                <Card.Body>
                  <div className="class-info">
                    <p><i className="fas fa-book me-2"></i><strong>Course:</strong> {getCourseName(cls.course_id)}</p>
                    <p><i className="fas fa-clock me-2"></i><strong>Schedule:</strong> {cls.schedule}</p>
                    <p><i className="fas fa-users me-2"></i><strong>Students:</strong> {cls.total_students || 'Not specified'}</p>
                    <p><i className="fas fa-university me-2"></i><strong>Faculty:</strong> {cls.faculty || 'Not specified'}</p>
                  </div>
                  <div className="class-status">
                    <Badge bg={cls.status === 'active' ? 'success' : 'secondary'} className="status-badge">
                      {cls.status || 'active'}
                    </Badge>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))
        ) : (
          <div className="no-data text-center">
            <i className="fas fa-chalkboard-teacher fa-3x mb-3"></i>
            <p className="text-muted">No classes assigned yet.</p>
          </div>
        )}
      </Row>
    </div>
  );
};

const ReportingTab = ({ reportForm, setReportForm, courses, onSubmit, reports, onExport, currentUser, facultyOptions }) => {
  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Class Reporting</h4>
        <Button variant="outline-primary" onClick={() => onExport()} disabled={reports.length === 0} className="export-btn-tab">
          <i className="fas fa-download me-2"></i>Export Reports
        </Button>
      </div>
      <Row>
        <Col md={6}>
          <Card className="form-card">
            <Card.Header className="form-card-header">
              <h5><i className="fas fa-file-signature me-2"></i>Submit Class Report</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleFormSubmit}>
                {/* Faculty Name Dropdown */}
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Faculty Name *</Form.Label>
                  <Form.Select
                    value={reportForm.faculty_name}
                    onChange={e => setReportForm({ ...reportForm, faculty_name: e.target.value })}
                    className="form-input"
                    required
                  >
                    <option value="">-- Select Faculty --</option>
                    {facultyOptions.map((faculty, index) => (
                      <option key={index} value={faculty}>
                        {faculty}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label">Class Name *</Form.Label>
                      <Form.Control
                        value={reportForm.class_name}
                        onChange={e => setReportForm({ ...reportForm, class_name: e.target.value })}
                        className="form-input"
                        placeholder="Enter class name"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label">Week of Reporting *</Form.Label>
                      <Form.Control
                        type="number"
                        min="1"
                        max="52"
                        value={reportForm.week_of_reporting}
                        onChange={e => setReportForm({ ...reportForm, week_of_reporting: e.target.value })}
                        className="form-input"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Date of Lecture *</Form.Label>
                  <Form.Control
                    type="date"
                    value={reportForm.date_lecture}
                    onChange={e => setReportForm({ ...reportForm, date_lecture: e.target.value })}
                    className="form-input"
                    required
                  />
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label">Course Name *</Form.Label>
                      <Form.Control
                        value={reportForm.course_name}
                        onChange={e => setReportForm({ ...reportForm, course_name: e.target.value })}
                        className="form-input"
                        placeholder="Enter course name"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label">Course Code *</Form.Label>
                      <Form.Control
                        value={reportForm.course_code}
                        onChange={e => setReportForm({ ...reportForm, course_code: e.target.value })}
                        className="form-input"
                        placeholder="Enter course code"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Lecturer's Name *</Form.Label>
                  <Form.Control
                    value={reportForm.lecturer_name || currentUser.username}
                    onChange={e => setReportForm({ ...reportForm, lecturer_name: e.target.value })}
                    className="form-input"
                    placeholder="Enter lecturer's name"
                    required
                  />
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label">Actual Students Present *</Form.Label>
                      <Form.Control
                        type="number"
                        value={reportForm.actual_students}
                        onChange={e => setReportForm({ ...reportForm, actual_students: e.target.value })}
                        className="form-input"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label">Total Registered Students *</Form.Label>
                      <Form.Control
                        type="number"
                        value={reportForm.total_students}
                        onChange={e => setReportForm({ ...reportForm, total_students: e.target.value })}
                        className="form-input"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label">Venue of Class *</Form.Label>
                      <Form.Control
                        value={reportForm.venue}
                        onChange={e => setReportForm({ ...reportForm, venue: e.target.value })}
                        className="form-input"
                        placeholder="Enter class venue"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label">Scheduled Lecture Time *</Form.Label>
                      <Form.Control
                        type="time"
                        value={reportForm.scheduled_time}
                        onChange={e => setReportForm({ ...reportForm, scheduled_time: e.target.value })}
                        className="form-input"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Topic Taught *</Form.Label>
                  <Form.Control
                    value={reportForm.topic_taught}
                    onChange={e => setReportForm({ ...reportForm, topic_taught: e.target.value })}
                    className="form-input"
                    placeholder="Enter the topic taught in this session"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Learning Outcomes of the Topic *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={reportForm.learning_outcomes}
                    onChange={e => setReportForm({ ...reportForm, learning_outcomes: e.target.value })}
                    className="form-textarea"
                    placeholder="Describe what students learned..."
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Lecturer's Recommendations</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={reportForm.recommendations}
                    onChange={e => setReportForm({ ...reportForm, recommendations: e.target.value })}
                    className="form-textarea"
                    placeholder="Any recommendations for improvement..."
                  />
                </Form.Group>

                <Button 
                  type="submit"
                  variant="primary" 
                  disabled={
                    !reportForm.faculty_name || 
                    !reportForm.class_name || 
                    !reportForm.week_of_reporting || 
                    !reportForm.date_lecture || 
                    !reportForm.course_name || 
                    !reportForm.course_code || 
                    !reportForm.lecturer_name || 
                    !reportForm.actual_students || 
                    !reportForm.total_students || 
                    !reportForm.venue || 
                    !reportForm.scheduled_time || 
                    !reportForm.topic_taught || 
                    !reportForm.learning_outcomes
                  } 
                  className="submit-btn"
                >
                  <i className="fas fa-paper-plane me-2"></i>Submit Report
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <div className="reports-list">
            <h5 className="reports-title">Previous Reports ({reports.length})</h5>
            {reports.length > 0 ? (
              reports.map(report => {
                const attendanceRate = Math.round((report.actual_students / report.total_students) * 100);
                return (
                  <Card key={report.id} className="mb-3 report-card">
                    <Card.Body>
                      <Card.Title className="report-title">
                        {report.course_name} - Week {report.week_of_reporting}
                      </Card.Title>
                      <Badge bg={attendanceRate >= 80 ? 'success' : attendanceRate >= 60 ? 'warning' : 'danger'} className="report-badge">
                        {attendanceRate}% Attendance
                      </Badge>
                      <Card.Text className="report-topic mt-2">
                        <strong>Topic:</strong> {report.topic_taught}
                      </Card.Text>
                      <Card.Text className="report-description">
                        <strong>Faculty:</strong> {report.faculty_name}<br/>
                        <strong>Class:</strong> {report.class_name}<br/>
                        <strong>Venue:</strong> {report.venue}<br/>
                        <strong>Time:</strong> {report.scheduled_time}<br/>
                        <strong>Outcomes:</strong> {report.learning_outcomes || 'Not specified'}
                      </Card.Text>
                      <div className="report-meta">
                        <small className="text-muted">
                          <i className="fas fa-calendar me-2"></i>{new Date(report.date_lecture).toLocaleDateString()}
                        </small>
                        <small className="text-muted">
                          <i className="fas fa-users me-2"></i>{report.actual_students}/{report.total_students} students
                        </small>
                      </div>
                    </Card.Body>
                  </Card>
                );
              })
            ) : (
              <div className="no-data">
                <i className="fas fa-inbox fa-3x mb-3"></i>
                <p className="text-muted">No reports submitted yet.</p>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
};

const RatingsTab = ({ ratings, courses, onExport }) => {
  const averageRating = ratings.length > 0
    ? ratings.reduce((acc, rating) => acc + rating.rating, 0) / ratings.length
    : 0;

  const getCourseName = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    return course ? `${course.name} (${course.code})` : 'Course Not Found';
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="section-title">Student Feedback</h4>
          <p className="text-muted">Average Rating: <strong>{averageRating.toFixed(1)}/5</strong> from {ratings.length} ratings</p>
        </div>
        <Button variant="outline-primary" onClick={() => onExport()} disabled={ratings.length === 0} className="export-btn-tab">
          <i className="fas fa-download me-2"></i>Export Ratings
        </Button>
      </div>
      {ratings.length > 0 ? (
        <Row>
          {ratings.map(rating => {
            const course = courses.find(c => c.id === rating.course_id);
            return (
              <Col md={6} key={rating.id} className="mb-3">
                <Card className="rating-card">
                  <Card.Body>
                    <Card.Title className="rating-course-title">
                      <i className="fas fa-graduation-cap me-2"></i>{getCourseName(rating.course_id)}
                    </Card.Title>
                    <div className="d-flex align-items-center mb-2">
                      <div className="rating-stars-static">
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} className={`star ${rating.rating >= star ? 'filled' : ''}`}>★</span>
                        ))}
                      </div>
                      <Badge bg="info" className="ms-2 rating-badge">{rating.rating}/5</Badge>
                    </div>
                    {rating.comment && (
                      <Card.Text className="rating-comment">
                        <i className="fas fa-comment me-2"></i>{rating.comment}
                      </Card.Text>
                    )}
                    <small className="text-muted rating-date">
                      <i className="fas fa-calendar me-2"></i>Submitted: {new Date(rating.created_at).toLocaleDateString()}
                    </small>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <div className="no-data text-center">
          <i className="fas fa-star fa-3x mb-3"></i>
          <p className="text-muted">No student ratings available yet.</p>
        </div>
      )}
    </div>
  );
};

const RecentActivity = ({ reports, ratings }) => {
  const recentActivities = [
    ...reports.map(r => ({ ...r, type: 'report', date: r.created_at, title: `Week ${r.week_of_reporting} Report` })),
    ...ratings.map(r => ({ ...r, type: 'rating', date: r.created_at, title: 'New Student Rating' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  return (
    <Card className="activity-card">
      <Card.Header className="activity-header">
        <h5><i className="fas fa-history me-2"></i>Recent Activity</h5>
      </Card.Header>
      <Card.Body>
        {recentActivities.length > 0 ? (
          recentActivities.map(activity => (
            <div key={`${activity.type}-${activity.id}`} className="activity-item">
              <div className="activity-icon">
                {activity.type === 'report' && <i className="fas fa-file-alt"></i>}
                {activity.type === 'rating' && <i className="fas fa-star"></i>}
              </div>
              <div className="activity-content">
                <strong>{activity.title}</strong>
                <div className="activity-time">
                  <i className="fas fa-clock me-2"></i>
                  {new Date(activity.date).toLocaleDateString()} at {new Date(activity.date).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-activity">
            <i className="fas fa-inbox fa-2x mb-2"></i>
            <p className="text-muted">No recent activity</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

// Authentication Modal with Faculty Dropdown
const AuthModal = ({ show, onClose, onSuccess, facultyOptions }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    faculty_name: '',
    role: 'Lecturer'
  });
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    
    try {
      setAuthError('');
      setLoading(true);
      
      if (isRegister && !formData.faculty_name) {
        setAuthError('Please select a faculty');
        setLoading(false);
        return;
      }
      
      const roleMap = {
        'Student': 'Student',
        'Lecturer': 'Lecturer',
        'Principal Lecturer': 'PRL',
        'Program Leader': 'PL'
      };
      const normalizedRole = roleMap[formData.role] || formData.role;

      const dataToSend = isRegister
        ? { ...formData, role: normalizedRole }
        : { username: formData.username, password: formData.password, role: normalizedRole };

      console.log('Sending to:', `https://matsepe.onrender.com${endpoint}`, 'Data:', dataToSend);

      const res = await axios.post(`https://matsepe.onrender.com${endpoint}`, dataToSend);
      console.log('Response:', res.data);

      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        
        const userData = res.data.user || res.data;
        localStorage.setItem('userData', JSON.stringify(userData));
        onSuccess({ 
          token: res.data.token,
          user: userData
        });
        onClose();
      } else {
        setAuthError('Authentication failed: No token received');
      }
    } catch (err) {
      console.error('Auth Error Details:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        endpoint: endpoint
      });
      
      if (err.response?.status === 401) {
        setAuthError('Invalid username or password');
      } else if (err.response?.status === 400) {
        setAuthError(err.response.data?.error || 'Invalid request data');
      } else if (err.response?.status === 409) {
        setAuthError('Username already exists');
      } else if (err.response?.data?.error) {
        setAuthError(err.response.data.error);
      } else if (err.request) {
        setAuthError('No response from server. Please check if the server is running.');
      } else {
        setAuthError('Authentication failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered className="auth-modal">
      <Modal.Header closeButton className="auth-header">
        <Modal.Title>{isRegister ? 'Create Account' : 'Login to System'}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="auth-body">
        {authError && <Alert variant="danger" className="auth-alert">{authError}</Alert>}
        <div className="role-selection mb-4">
          <h6>Select Your Role:</h6>
          <div className="role-buttons">
            {['Lecturer', 'Principal Lecturer', 'Program Leader', 'Student'].map(role => (
              <Button
                key={role}
                variant={formData.role === role ? 'primary' : 'outline-primary'}
                onClick={() => setFormData({...formData, role})}
                className="role-btn"
                disabled={loading}
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
              disabled={loading}
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
                  disabled={loading}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="auth-label">Faculty</Form.Label>
                <Form.Select
                  value={formData.faculty_name}
                  onChange={e => setFormData({...formData, faculty_name: e.target.value})}
                  className="auth-input"
                  disabled={loading}
                >
                  <option value="">-- Select Faculty --</option>
                  {facultyOptions.map((faculty, index) => (
                    <option key={index} value={faculty}>
                      {faculty}
                    </option>
                  ))}
                </Form.Select>
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
              disabled={loading}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer className="auth-footer">
        <Button 
          variant="link" 
          onClick={() => setIsRegister(!isRegister)} 
          className="auth-switch"
          disabled={loading}
        >
          {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSubmit} 
          className="auth-submit"
          disabled={loading}
        >
          {loading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Login')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default Lecturers;