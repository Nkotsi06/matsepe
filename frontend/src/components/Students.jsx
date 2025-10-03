import React, { useState, useEffect } from 'react';
import { Container, Button, Form, Alert, Row, Col, Modal, Card, Badge, Tabs, Tab, Dropdown } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';

const Students = ({ onProtectedAction }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [selfRatings, setSelfRatings] = useState([]);
  const [courseRatings, setCourseRatings] = useState([]);
  const [reports, setReports] = useState([]);
  const [courses, setCourses] = useState([]); // Enrolled courses
  const [statistics, setStatistics] = useState({
    activeStudents: 0,
    courses: 0,
    monthlyReports: 0,
    accessStatus: '24/7'
  });

  // Form states
  const [ratingForm, setRatingForm] = useState({
    course_id: '',
    rating: '',
    comment: '',
    rating_type: 'self'
  });

  const [reportForm, setReportForm] = useState({
    course_id: '',
    report_type: 'attendance',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        if (user.role === 'Student') {
          fetchStudentData();
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
        handleLogout();
      }
    } else {
      fetchPublicStatistics();
    }
  }, []);

  const fetchPublicStatistics = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/student/public-statistics');
      setStatistics(res.data || {
        activeStudents: 0,
        courses: 0,
        monthlyReports: 0,
        accessStatus: '24/7'
      });
    } catch (err) {
      console.error('Error fetching public statistics:', err);
      setStatistics({
        activeStudents: 0,
        courses: 0,
        monthlyReports: 0,
        accessStatus: '24/7'
      });
    }
  };

  const fetchStudentData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const coursesRes = await axios.get('http://localhost:5000/api/student/courses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(coursesRes.data || []);

      const selfRatingsRes = await axios.get('http://localhost:5000/api/ratings/self', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelfRatings(selfRatingsRes.data || []);

      const courseRatingsRes = await axios.get('http://localhost:5000/api/ratings/course', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourseRatings(courseRatingsRes.data || []);

      const reportsRes = await axios.get('http://localhost:5000/api/student/reports', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(reportsRes.data || []);

      setStatistics({
        activeStudents: 1,
        courses: coursesRes.data?.length || 0,
        monthlyReports: reportsRes.data?.length || 0,
        accessStatus: '24/7'
      });
    } catch (err) {
      console.error('Error fetching student data:', err);
      if (err.response?.status === 401) {
        handleLogout();
      }
      setCourses([]);
      setSelfRatings([]);
      setCourseRatings([]);
      setReports([]);
    }
  };

  const exportReportsToExcel = () => {
    if (reports.length === 0) {
      setError('No reports to export');
      return;
    }
    try {
      const excelData = reports.map(report => {
        const course = courses.find(c => c.id === report.course_id);
        return {
          'Report Title': report.title,
          'Course': course ? `${course.name} (${course.code})` : 'N/A',
          'Report Type': report.report_type,
          'Description': report.description,
          'Date': new Date(report.date).toLocaleDateString(),
          'Submitted On': new Date(report.created_at).toLocaleDateString(),
          'Status': report.status || 'Submitted'
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Student Reports');
      XLSX.writeFile(wb, `student_reports_${currentUser.username}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccess('Reports exported to Excel successfully!');
    } catch (err) {
      setError('Error exporting to Excel: ' + err.message);
    }
  };

  const exportRatingsToExcel = (ratingType) => {
    const ratings = ratingType === 'self' ? selfRatings : courseRatings;
    const typeLabel = ratingType === 'self' ? 'Self Ratings' : 'Course Ratings';
    
    if (ratings.length === 0) {
      setError(`No ${typeLabel.toLowerCase()} to export`);
      return;
    }
    
    try {
      const excelData = ratings.map(rating => {
        const course = courses.find(c => c.id === rating.course_id);
        return {
          'Course': course ? `${course.name} (${course.code})` : 'N/A',
          'Rating': `${rating.rating}/5`,
          'Comments': rating.comment,
          'Type': ratingType === 'self' ? 'Self Evaluation' : 'Course Evaluation',
          'Submitted On': new Date(rating.created_at).toLocaleDateString()
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${typeLabel}`);
      XLSX.writeFile(wb, `${typeLabel.toLowerCase()}_${currentUser.username}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccess(`${typeLabel} exported to Excel successfully!`);
    } catch (err) {
      setError('Error exporting to Excel: ' + err.message);
    }
  };

  const exportAllDataToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const profileData = [{
        'Username': currentUser.username,
        'Email': currentUser.email,
        'Faculty': currentUser.faculty_name || 'Not specified',
        'Role': currentUser.role,
        'Total Courses': courses.length,
        'Total Self Ratings': selfRatings.length,
        'Total Course Ratings': courseRatings.length,
        'Total Reports': reports.length
      }];
      const profileWs = XLSX.utils.json_to_sheet(profileData);
      XLSX.utils.book_append_sheet(wb, profileWs, 'Student Profile');
      
      if (selfRatings.length > 0) {
        const selfRatingsData = selfRatings.map(rating => {
          const course = courses.find(c => c.id === rating.course_id);
          return {
            'Course': course ? `${course.name} (${course.code})` : 'N/A',
            'Rating': `${rating.rating}/5`,
            'Self Evaluation Comments': rating.comment,
            'Submitted Date': new Date(rating.created_at).toLocaleDateString()
          };
        });
        const selfRatingsWs = XLSX.utils.json_to_sheet(selfRatingsData);
        XLSX.utils.book_append_sheet(wb, selfRatingsWs, 'Self Ratings');
      }
      
      if (courseRatings.length > 0) {
        const courseRatingsData = courseRatings.map(rating => {
          const course = courses.find(c => c.id === rating.course_id);
          return {
            'Course': course ? `${course.name} (${course.code})` : 'N/A',
            'Instructor': course?.instructor_name || 'N/A',
            'Rating': `${rating.rating}/5`,
            'Feedback Comments': rating.comment,
            'Submitted Date': new Date(rating.created_at).toLocaleDateString()
          };
        });
        const courseRatingsWs = XLSX.utils.json_to_sheet(courseRatingsData);
        XLSX.utils.book_append_sheet(wb, courseRatingsWs, 'Course Ratings');
      }
      
      if (reports.length > 0) {
        const reportsData = reports.map(report => {
          const course = courses.find(c => c.id === report.course_id);
          return {
            'Report Title': report.title,
            'Course': course ? `${course.name} (${course.code})` : 'N/A',
            'Report Type': report.report_type,
            'Description': report.description,
            'Report Date': new Date(report.date).toLocaleDateString(),
            'Submitted On': new Date(report.created_at).toLocaleDateString(),
            'Status': report.status || 'Submitted'
          };
        });
        const reportsWs = XLSX.utils.json_to_sheet(reportsData);
        XLSX.utils.book_append_sheet(wb, reportsWs, 'Reports');
      }
      
      if (courses.length > 0) {
        const coursesData = courses.map(course => ({
          'Course Name': course.name,
          'Course Code': course.code,
          'Instructor': course?.instructor_name || 'N/A',
          'Department': course.department,
          'Credits': course.credits,
          'Schedule': course.schedule
        }));
        const coursesWs = XLSX.utils.json_to_sheet(coursesData);
        XLSX.utils.book_append_sheet(wb, coursesWs, 'Courses');
      }
      
      XLSX.writeFile(wb, `student_portfolio_${currentUser.username}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccess('All data exported to Excel successfully!');
    } catch (err) {
      setError('Error exporting data to Excel: ' + err.message);
    }
  };

  const handleSelfRatingSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      
      if (!ratingForm.course_id || !ratingForm.rating) {
        setError('Please select a course and provide a rating');
        return;
      }
      
      const response = await axios.post('http://localhost:5000/api/ratings/self', {
        course_id: ratingForm.course_id,
        rating: parseInt(ratingForm.rating),
        comment: ratingForm.comment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Self-rating submitted successfully!');
      setRatingForm({ course_id: '', rating: '', comment: '', rating_type: 'self' });
      fetchStudentData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit rating');
    }
  };

  const handleCourseRatingSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      
      if (!ratingForm.course_id || !ratingForm.rating) {
        setError('Please select a course and provide a rating');
        return;
      }
      
      const response = await axios.post('http://localhost:5000/api/ratings/course', {
        course_id: ratingForm.course_id,
        rating: parseInt(ratingForm.rating),
        comment: ratingForm.comment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Course rating submitted successfully!');
      setRatingForm({ course_id: '', rating: '', comment: '', rating_type: 'course' });
      fetchStudentData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit rating');
    }
  };

  const handleReportSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      
      if (!reportForm.course_id || !reportForm.title) {
        setError('Please select a course and provide a title');
        return;
      }
      
      const response = await axios.post('http://localhost:5000/api/student/reports', {
        course_id: reportForm.course_id,
        report_type: reportForm.report_type,
        title: reportForm.title,
        description: reportForm.description,
        date: reportForm.date
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Report submitted successfully!');
      setReportForm({
        course_id: '',
        report_type: 'attendance',
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchStudentData();
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
    // FIX: Handle both response structures
    const user = userData.user || userData; // Support both {user: {...}} and direct user object
    setCurrentUser(user);
    localStorage.setItem('userData', JSON.stringify(user));
    setSuccess(`Welcome, ${user.username}!`);
    setTimeout(() => setSuccess(''), 3000);
   
    if (user.role === 'Student') {
      fetchStudentData();
    }
  };

  if (!currentUser) {
    return (
      <div className="public-dashboard">
        <div className="university-hero">
          <Container>
            <div className="hero-content text-center">
              <h1 className="university-title">University Student Portal</h1>
              <p className="university-subtitle">Comprehensive Academic Management System</p>
            </div>
          </Container>
        </div>
        
        <Container className="py-5">
          <div className="login-section text-center mb-5">
            <Card className="login-feature-card">
              <Card.Body className="p-5">
                <h2 className="portal-title">Student Portal</h2>
                <p className="portal-subtitle mb-4">Access your academic dashboard and reporting tools</p>
                <Button variant="primary" size="lg" onClick={() => setShowAuthModal(true)} className="login-btn-main">
                  Login / Register
                </Button>
              </Card.Body>
            </Card>
          </div>
          
          <div className="feature-showcase mt-5">
            <h3 className="feature-title mb-4">What's Inside Your Portal?</h3>
           
            <Row className="g-4">
              <Col md={4}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Self-Rating System</Card.Title>
                    <Card.Text className="feature-card-text">
                      Evaluate your own performance, effort, and understanding in each course.
                      Track your academic growth over time.
                    </Card.Text>
                    <Badge bg="info" className="feature-badge">Personal Development</Badge>
                  </Card.Body>
                </Card>
              </Col>
             
              <Col md={4}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Course Evaluation</Card.Title>
                    <Card.Text className="feature-card-text">
                      Provide feedback on courses and instructors. Help improve teaching
                      effectiveness and course materials.
                    </Card.Text>
                    <Badge bg="success" className="feature-badge">Quality Feedback</Badge>
                  </Card.Body>
                </Card>
              </Col>
             
              <Col md={4}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Academic Reporting</Card.Title>
                    <Card.Text className="feature-card-text">
                      Submit attendance, progress, and issue reports. Communicate effectively
                      with faculty and administration.
                    </Card.Text>
                    <Badge bg="warning" className="feature-badge">Direct Communication</Badge>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            
            <Row className="g-4 mt-2">
              <Col md={6}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Progress Analytics</Card.Title>
                    <Card.Text className="feature-card-text">
                      Visualize your academic journey with detailed analytics and progress tracking.
                      Monitor your performance across all courses.
                    </Card.Text>
                    <Badge bg="primary" className="feature-badge">Data Insights</Badge>
                  </Card.Body>
                </Card>
              </Col>
             
              <Col md={6}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Export Capabilities</Card.Title>
                    <Card.Text className="feature-card-text">
                      Download your data in Excel format for personal records, advisor meetings,
                      or graduate school applications.
                    </Card.Text>
                    <Badge bg="dark" className="feature-badge">Data Export</Badge>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>
          
          <div className="portal-statistics mt-5">
            <Row className="g-4">
              <Col md={3}>
                <div className="stat-item text-center">
                  <div className="stat-number">{statistics.activeStudents}</div>
                  <div className="stat-label">Active Students</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="stat-item text-center">
                  <div className="stat-number">{statistics.courses}</div>
                  <div className="stat-label">Courses</div>
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
        />
      </div>
    );
  }

  if (currentUser && currentUser.role !== 'Student') {
    return (
      <Container className="py-4">
        <Alert variant="warning">
          You are logged in as {currentUser.role}. Please log in as a Student to access this portal.
        </Alert>
        <Button variant="outline-danger" onClick={handleLogout}>
          Logout
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-4 students-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="dashboard-title">Student Dashboard</h2>
          <p className="text-muted welcome-text">Welcome back, {currentUser.username}</p>
        </div>
        <div className="d-flex align-items-center">
          <Dropdown className="me-2">
            <Dropdown.Toggle variant="success" id="dropdown-export" className="export-btn">
              Export Data
            </Dropdown.Toggle>
            <Dropdown.Menu className="export-menu">
              <Dropdown.Item onClick={exportAllDataToExcel} className="export-item">
                Export All Data
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => exportReportsToExcel()} className="export-item">
                Export Reports
              </Dropdown.Item>
              <Dropdown.Item onClick={() => exportRatingsToExcel('self')} className="export-item">
                Export Self Ratings
              </Dropdown.Item>
              <Dropdown.Item onClick={() => exportRatingsToExcel('course')} className="export-item">
                Export Course Ratings
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button variant="outline-danger" onClick={handleLogout} className="logout-btn">
            Logout
          </Button>
        </div>
      </div>
      
      {error && <Alert variant="danger" onClose={() => setError('')} dismissible className="alert-custom">{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible className="alert-custom">{success}</Alert>}
      
      <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4 custom-tabs">
        <Tab eventKey="dashboard" title={<span>Dashboard</span>}>
          <DashboardTab
            currentUser={currentUser}
            selfRatings={selfRatings}
            courseRatings={courseRatings}
            reports={reports}
            courses={courses}
            statistics={statistics}
            onExportAll={exportAllDataToExcel}
          />
        </Tab>
        <Tab eventKey="self-rating" title={<span>Self-Rating</span>}>
          <SelfRatingTab
            ratingForm={ratingForm}
            setRatingForm={setRatingForm}
            courses={courses}
            onSubmit={handleSelfRatingSubmit}
            selfRatings={selfRatings}
            onExport={() => exportRatingsToExcel('self')}
          />
        </Tab>
        <Tab eventKey="course-rating" title={<span>Course Rating</span>}>
          <CourseRatingTab
            ratingForm={ratingForm}
            setRatingForm={setRatingForm}
            courses={courses}
            onSubmit={handleCourseRatingSubmit}
            courseRatings={courseRatings}
            onExport={() => exportRatingsToExcel('course')}
          />
        </Tab>
        <Tab eventKey="reporting" title={<span>Reporting</span>}>
          <ReportingTab
            reportForm={reportForm}
            setReportForm={setReportForm}
            courses={courses}
            onSubmit={handleReportSubmit}
            reports={reports}
            onExport={exportReportsToExcel}
          />
        </Tab>
      </Tabs>
    </Container>
  );
};

// Dashboard Component
const DashboardTab = ({ currentUser, selfRatings, courseRatings, reports, courses, statistics, onExportAll }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Student Overview</h4>
        <Button variant="outline-primary" onClick={onExportAll} className="export-all-btn">
          Export All Data to Excel
        </Button>
      </div>
     
      <Row>
        <Col md={4}>
          <Card className="mb-4 profile-card">
            <Card.Body className="text-center">
              <div className="profile-avatar">
                <i className="fas fa-user-graduate"></i>
              </div>
              <Card.Title className="profile-name">{currentUser.username}</Card.Title>
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
                  <Card.Title className="stats-number">{selfRatings.length}</Card.Title>
                  <Card.Text className="stats-label">Self-Ratings Submitted</Card.Text>
                </Card.Body>
              </Card>
            </Col>
           
            <Col md={6}>
              <Card className="mb-4 stats-card">
                <Card.Body className="text-center">
                  <Card.Title className="stats-number">{courseRatings.length}</Card.Title>
                  <Card.Text className="stats-label">Course Ratings</Card.Text>
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
                  <Card.Title className="stats-number">{courses.length}</Card.Title>
                  <Card.Text className="stats-label">Enrolled Courses</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
     
      <RecentActivity selfRatings={selfRatings} courseRatings={courseRatings} reports={reports} courses={courses} />
    </div>
  );
};

// Self-Rating Component
const SelfRatingTab = ({ ratingForm, setRatingForm, courses, onSubmit, selfRatings, onExport }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Self-Rating and Evaluation</h4>
        <Button variant="outline-primary" onClick={onExport} disabled={selfRatings.length === 0} className="export-btn-tab">
          Export to Excel
        </Button>
      </div>
     
      <Row>
        <Col md={6}>
          <Card className="form-card">
            <Card.Header className="form-card-header">
              <h5>Submit Self-Rating</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Select Course</Form.Label>
                  <Form.Select
                    value={ratingForm.course_id}
                    onChange={(e) => setRatingForm({...ratingForm, course_id: e.target.value})}
                    className="form-select-custom"
                  >
                    <option value="">Choose a course...</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name} ({course.code})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Performance Rating (1-5)</Form.Label>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        className={`star ${ratingForm.rating >= star ? 'filled' : ''}`}
                        onClick={() => setRatingForm({...ratingForm, rating: star.toString()})}
                        title={`Rate ${star} stars`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <div className="rating-labels">
                    <small>Poor</small>
                    <small>Excellent</small>
                  </div>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Self-Evaluation Comments</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={ratingForm.comment}
                    onChange={(e) => setRatingForm({...ratingForm, comment: e.target.value})}
                    placeholder="Evaluate your performance, effort, and understanding..."
                    className="form-textarea"
                  />
                </Form.Group>
                <Button variant="primary" onClick={onSubmit} disabled={!ratingForm.course_id || !ratingForm.rating} className="submit-btn">
                  Submit Self-Rating
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
       
        <Col md={6}>
          <div className="ratings-list">
            <h5 className="ratings-title">Your Self-Ratings ({selfRatings.length})</h5>
            {selfRatings.length > 0 ? (
              selfRatings.map(rating => {
                const course = courses.find(c => c.id === rating.course_id);
                return (
                  <Card key={rating.id} className="mb-3 rating-card">
                    <Card.Body>
                      <Card.Title className="rating-course-title">
                        {course ? course.name : 'Course'}
                      </Card.Title>
                      <div className="d-flex align-items-center mb-2">
                        <div className="rating-stars-static">
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} className={`star ${rating.rating >= star ? 'filled' : ''}`}>★</span>
                          ))}
                        </div>
                        <Badge bg="info" className="ms-2 rating-badge">{rating.rating}/5</Badge>
                      </div>
                      <Card.Text className="rating-comment">{rating.comment}</Card.Text>
                      <small className="text-muted rating-date">
                        Submitted: {new Date(rating.created_at).toLocaleDateString()}
                      </small>
                    </Card.Body>
                  </Card>
                );
              })
            ) : (
              <div className="no-data">
                <i className="fas fa-inbox fa-3x mb-3"></i>
                <p className="text-muted">No self-ratings submitted yet.</p>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
};

// Course Rating Component
const CourseRatingTab = ({ ratingForm, setRatingForm, courses, onSubmit, courseRatings, onExport }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Course and Instructor Rating</h4>
        <Button variant="outline-primary" onClick={onExport} disabled={courseRatings.length === 0} className="export-btn-tab">
          Export to Excel
        </Button>
      </div>
     
      <Row>
        <Col md={6}>
          <Card className="form-card">
            <Card.Header className="form-card-header">
              <h5>Submit Course Rating</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Select Course</Form.Label>
                  <Form.Select
                    value={ratingForm.course_id}
                    onChange={(e) => setRatingForm({...ratingForm, course_id: e.target.value})}
                    className="form-select-custom"
                  >
                    <option value="">Choose a course...</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name} ({course.code}) - {course.instructor_name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Overall Rating (1-5)</Form.Label>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        className={`star ${ratingForm.rating >= star ? 'filled' : ''}`}
                        onClick={() => setRatingForm({...ratingForm, rating: star.toString()})}
                        title={`Rate ${star} stars`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <div className="rating-labels">
                    <small>Poor</small>
                    <small>Excellent</small>
                  </div>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Feedback Comments</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={ratingForm.comment}
                    onChange={(e) => setRatingForm({...ratingForm, comment: e.target.value})}
                    placeholder="Provide feedback on course design, materials, and teaching effectiveness..."
                    className="form-textarea"
                  />
                </Form.Group>
                <Button variant="primary" onClick={onSubmit} disabled={!ratingForm.course_id || !ratingForm.rating} className="submit-btn">
                  Submit Course Rating
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
       
        <Col md={6}>
          <div className="ratings-list">
            <h5 className="ratings-title">Your Course Ratings ({courseRatings.length})</h5>
            {courseRatings.length > 0 ? (
              courseRatings.map(rating => {
                const course = courses.find(c => c.id === rating.course_id);
                return (
                  <Card key={rating.id} className="mb-3 rating-card">
                    <Card.Body>
                      <Card.Title className="rating-course-title">
                        {course ? course.name : 'Course'}
                      </Card.Title>
                      <div className="d-flex align-items-center mb-2">
                        <div className="rating-stars-static">
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} className={`star ${rating.rating >= star ? 'filled' : ''}`}>★</span>
                          ))}
                        </div>
                        <Badge bg="info" className="ms-2 rating-badge">{rating.rating}/5</Badge>
                      </div>
                      <Card.Text className="rating-comment">{rating.comment}</Card.Text>
                      <small className="text-muted rating-date">
                        Submitted: {new Date(rating.created_at).toLocaleDateString()}
                      </small>
                    </Card.Body>
                  </Card>
                );
              })
            ) : (
              <div className="no-data">
                <i className="fas fa-inbox fa-3x mb-3"></i>
                <p className="text-muted">No course ratings submitted yet.</p>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
};

// Reporting Component
const ReportingTab = ({ reportForm, setReportForm, courses, onSubmit, reports, onExport }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Academic Reporting</h4>
        <Button variant="outline-primary" onClick={onExport} disabled={reports.length === 0} className="export-btn-tab">
          Export to Excel
        </Button>
      </div>
     
      <Row>
        <Col md={6}>
          <Card className="form-card">
            <Card.Header className="form-card-header">
              <h5>Submit Report</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Select Course</Form.Label>
                  <Form.Select
                    value={reportForm.course_id}
                    onChange={(e) => setReportForm({...reportForm, course_id: e.target.value})}
                    className="form-select-custom"
                  >
                    <option value="">Choose a course...</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name} ({course.code})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Report Type</Form.Label>
                  <Form.Select
                    value={reportForm.report_type}
                    onChange={(e) => setReportForm({...reportForm, report_type: e.target.value})}
                    className="form-select-custom"
                  >
                    <option value="attendance">Attendance Report</option>
                    <option value="progress">Progress Report</option>
                    <option value="issue">Issue Report</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Title</Form.Label>
                  <Form.Control
                    type="text"
                    value={reportForm.title}
                    onChange={(e) => setReportForm({...reportForm, title: e.target.value})}
                    placeholder="Enter report title..."
                    className="form-input"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    value={reportForm.description}
                    onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                    placeholder="Provide detailed description..."
                    className="form-textarea"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={reportForm.date}
                    onChange={(e) => setReportForm({...reportForm, date: e.target.value})}
                    className="form-input"
                  />
                </Form.Group>
                <Button variant="primary" onClick={onSubmit} disabled={!reportForm.course_id || !reportForm.title} className="submit-btn">
                  Submit Report
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
       
        <Col md={6}>
          <div className="reports-list">
            <h5 className="reports-title">Your Submitted Reports ({reports.length})</h5>
            {reports.length > 0 ? (
              reports.map(report => {
                const course = courses.find(c => c.id === report.course_id);
                return (
                  <Card key={report.id} className="mb-3 report-card">
                    <Card.Body>
                      <Card.Title className="report-title">{report.title}</Card.Title>
                      <Badge bg={
                        report.report_type === 'attendance' ? 'primary' :
                        report.report_type === 'progress' ? 'success' : 'warning'
                      } className="report-badge">
                        {report.report_type}
                      </Badge>
                      <Card.Text className="report-description mt-2">{report.description}</Card.Text>
                      <div className="report-meta">
                        <small className="text-muted">
                          Course: {course ? course.name : 'N/A'}
                        </small>
                        <small className="text-muted">
                          Date: {new Date(report.date).toLocaleDateString()}
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

// Recent Activity Component
const RecentActivity = ({ selfRatings, courseRatings, reports, courses }) => {
  const recentActivities = [
    ...selfRatings.map(r => ({ 
      ...r, 
      type: 'self-rating', 
      date: r.created_at,
      course_name: courses.find(c => c.id === r.course_id)?.name || 'Course'
    })),
    ...courseRatings.map(r => ({ 
      ...r, 
      type: 'course-rating', 
      date: r.created_at,
      course_name: courses.find(c => c.id === r.course_id)?.name || 'Course'
    })),
    ...reports.map(r => ({ 
      ...r, 
      type: 'report', 
      date: r.created_at,
      course_name: courses.find(c => c.id === r.course_id)?.name || 'Course'
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <Card className="activity-card">
      <Card.Header className="activity-header">
        <h5>Recent Activity</h5>
      </Card.Header>
      <Card.Body>
        {recentActivities.length > 0 ? (
          recentActivities.map(activity => (
            <div key={`${activity.type}-${activity.id}`} className="activity-item">
              <div className="activity-icon">
                {activity.type === 'self-rating' && <i className="fas fa-user-check"></i>}
                {activity.type === 'course-rating' && <i className="fas fa-star"></i>}
                {activity.type === 'report' && <i className="fas fa-file-alt"></i>}
              </div>
              <div className="activity-content">
                <strong>
                  {activity.type === 'self-rating' && `Self-Rating for ${activity.course_name}`}
                  {activity.type === 'course-rating' && `Course Rating for ${activity.course_name}`}
                  {activity.type === 'report' && `Report: ${activity.title}`}
                </strong>
                <div className="activity-time">
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

// Authentication Modal with Role Mapping - FIXED VERSION
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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Define endpoint outside try-catch so it's accessible in both
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    
    try {
      setAuthError('');
      setLoading(true);
      
      // Map frontend role names to backend/database ENUM values
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

      console.log('Sending to:', `http://localhost:5000${endpoint}`, 'Data:', dataToSend);

      const res = await axios.post(`http://localhost:5000${endpoint}`, dataToSend);
      console.log('Response:', res.data);

      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        
        // FIX: Handle both response structures
        // Backend returns user data directly, not nested under 'user' property
        const userData = res.data.user || res.data; // Use 'user' if exists, else use entire response
        
        localStorage.setItem('userData', JSON.stringify(userData));
        onSuccess({ 
          token: res.data.token,
          user: userData // Pass the user data directly
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
      
      // More detailed error handling
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
            {['Student', 'Lecturer', 'Principal Lecturer', 'Program Leader'].map(role => (
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
                <Form.Control
                  type="text"
                  value={formData.faculty_name}
                  onChange={e => setFormData({...formData, faculty_name: e.target.value})}
                  className="auth-input"
                  placeholder="Enter your faculty"
                  disabled={loading}
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

export default Students;