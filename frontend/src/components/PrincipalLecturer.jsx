import React, { useState, useEffect } from 'react';
import { Container, Button, Form, Alert, Row, Col, Modal, Card, Badge, Tabs, Tab, Dropdown, Spinner, Table } from 'react-bootstrap';
import { BarChart } from 'react-bootstrap-icons';
import axios from 'axios';
import * as XLSX from 'xlsx';

const PrincipalLecturer = () => {
  const [reports, setReports] = useState([]);
  const [courses, setCourses] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [search, setSearch] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showLectureModal, setShowLectureModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [feedback, setFeedback] = useState('');
  
  // Form states
  const [ratingData, setRatingData] = useState({
    lecturer_id: '',
    rating: '',
    comment: '',
  });
  
  const [courseData, setCourseData] = useState({
    name: '',
    code: '',
    lecturer_id: '',
    credits: '',
    department: '',
    schedule: ''
  });
  
  const [classData, setClassData] = useState({
    course_id: '',
    lecturer_id: '',
    date: '',
    time: '',
    room: '',
    topic: ''
  });
  
  const [lectureData, setLectureData] = useState({
    course_id: '',
    title: '',
    description: '',
    materials: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        if (user.role === 'Principal Lecturer' || user.role === 'Program Leader') {
          fetchPrincipalLecturerData();
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
        handleLogout();
      }
    }
  }, []);

  const fetchPrincipalLecturerData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      // Fetch all data in parallel
      const [reportsRes, coursesRes, ratingsRes, classesRes, lecturersRes, lecturesRes] = await Promise.all([
        axios.get('https://matsepe.onrender.com/api/principal/reports', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('https://matsepe.onrender.com/api/principal/courses', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('https://matsepe.onrender.com/api/principal/ratings', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('https://matsepe.onrender.com/api/principal/classes', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('https://matsepe.onrender.com/api/principal/lecturers', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('https://matsepe.onrender.com/api/principal/lectures', {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      setReports(reportsRes.data);
      setCourses(coursesRes.data);
      setRatings(ratingsRes.data);
      setClasses(classesRes.data);
      setLecturers(lecturersRes.data);
      setLectures(lecturesRes.data);
    } catch (err) {
      console.error('Error fetching principal lecturer data:', err);
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setError('Failed to load data. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Course Management Functions
  const handleAddCourse = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      await axios.post(
        'https://matsepe.onrender.com/api/principal/courses',
        courseData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Course added successfully!');
      setCourseData({
        name: '',
        code: '',
        lecturer_id: '',
        credits: '',
        department: '',
        schedule: ''
      });
      setShowCourseModal(false);
      fetchPrincipalLecturerData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add course');
    }
  };

  const handleUpdateCourse = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      await axios.put(
        `https://matsepe.onrender.com/api/principal/courses/${selectedCourse?.id}`,
        courseData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Course updated successfully!');
      setCourseData({
        name: '',
        code: '',
        lecturer_id: '',
        credits: '',
        department: '',
        schedule: ''
      });
      setSelectedCourse(null);
      setShowCourseModal(false);
      fetchPrincipalLecturerData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update course');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in first');
          return;
        }
        await axios.delete(
          `https://matsepe.onrender.com/api/principal/courses/${courseId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSuccess('Course deleted successfully!');
        fetchPrincipalLecturerData();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete course');
      }
    }
  };

  // Class Management Functions
  const handleAddClass = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      await axios.post(
        'https://matsepe.onrender.com/api/principal/classes',
        classData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Class scheduled successfully!');
      setClassData({
        course_id: '',
        lecturer_id: '',
        date: '',
        time: '',
        room: '',
        topic: ''
      });
      setShowClassModal(false);
      fetchPrincipalLecturerData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule class');
    }
  };

  const handleUpdateClass = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      await axios.put(
        `https://matsepe.onrender.com/api/principal/classes/${selectedClass?.id}`,
        classData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Class updated successfully!');
      setClassData({
        course_id: '',
        lecturer_id: '',
        date: '',
        time: '',
        room: '',
        topic: ''
      });
      setSelectedClass(null);
      setShowClassModal(false);
      fetchPrincipalLecturerData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update class');
    }
  };

  const handleDeleteClass = async (classId) => {
    if (window.confirm('Are you sure you want to delete this class?')) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in first');
          return;
        }
        await axios.delete(
          `https://matsepe.onrender.com/api/principal/classes/${classId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSuccess('Class deleted successfully!');
        fetchPrincipalLecturerData();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete class');
      }
    }
  };

  // Lecture Management Functions
  const handleAddLecture = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      await axios.post(
        'https://matsepe.onrender.com/api/principal/lectures',
        lectureData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Lecture material added successfully!');
      setLectureData({
        course_id: '',
        title: '',
        description: '',
        materials: ''
      });
      setShowLectureModal(false);
      fetchPrincipalLecturerData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add lecture material');
    }
  };

  const handleDeleteLecture = async (lectureId) => {
    if (window.confirm('Are you sure you want to delete this lecture material?')) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in first');
          return;
        }
        await axios.delete(
          `https://matsepe.onrender.com/api/principal/lectures/${lectureId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSuccess('Lecture material deleted successfully!');
        fetchPrincipalLecturerData();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete lecture material');
      }
    }
  };

  // Export functions (existing)
  const exportReportsToExcel = () => {
    if (reports.length === 0) {
      setError('No reports to export');
      return;
    }
    try {
      const excelData = reports.map((report) => {
        const lecturer = lecturers.find((l) => l.id === report.lecturer_id);
        const course = courses.find((c) => c.id === report.course_id);
        return {
          Course: course ? `${course.name} (${course.code})` : 'N/A',
          Lecturer: lecturer ? lecturer.username : 'N/A',
          Week: report.week,
          Topic: report.topic,
          Date: new Date(report.date).toLocaleDateString(),
          Attendance: `${report.actual_students}/${report.total_students}`,
          'Attendance Rate': `${Math.round((report.actual_students / report.total_students) * 100)}%`,
          'Learning Outcomes': report.outcomes,
          Recommendations: report.recommendations,
          'PRL Feedback': report.feedback || 'Not provided',
          'Submitted On': new Date(report.created_at).toLocaleDateString(),
        };
      });
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Department Reports');
      XLSX.writeFile(wb, `department_reports_${currentUser?.username}_${new Date().toISOString().split('T')[0]}.xlsx`);

      setSuccess('Reports exported to Excel successfully!');
    } catch (err) {
      setError('Error exporting to Excel: ' + err.message);
    }
  };

  const exportRatingsToExcel = () => {
    if (ratings.length === 0) {
      setError('No ratings to export');
      return;
    }
    try {
      const excelData = ratings.map((rating) => {
        const course = courses.find((c) => c.id === rating.course_id);
        const lecturer = lecturers.find((l) => l.id === rating.lecturer_id);
        return {
          Course: course ? `${course.name} (${course.code})` : 'N/A',
          Lecturer: lecturer ? lecturer.username : 'N/A',
          Rating: `${rating.rating}/5`,
          Comments: rating.comment,
          'Submitted On': new Date(rating.created_at).toLocaleDateString(),
        };
      });
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Department Ratings');
      XLSX.writeFile(wb, `department_ratings_${currentUser?.username}_${new Date().toISOString().split('T')[0]}.xlsx`);

      setSuccess('Ratings exported to Excel successfully!');
    } catch (err) {
      setError('Error exporting to Excel: ' + err.message);
    }
  };

  const exportAllDataToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      // Principal Lecturer Profile Sheet
      const profileData = [
        {
          Username: currentUser?.username,
          Email: currentUser?.email,
          Department: currentUser?.faculty_name || 'Not specified',
          Role: currentUser?.role,
          'Total Courses': courses.length,
          'Total Lecturers': lecturers.length,
          'Total Reports': reports.length,
          'Total Ratings': ratings.length,
          'Total Classes': classes.length,
        },
      ];
      const profileWs = XLSX.utils.json_to_sheet(profileData);
      XLSX.utils.book_append_sheet(wb, profileWs, 'Principal Profile');

      // Reports Sheet
      if (reports.length > 0) {
        const reportsData = reports.map((report) => {
          const lecturer = lecturers.find((l) => l.id === report.lecturer_id);
          const course = courses.find((c) => c.id === report.course_id);
          return {
            Course: course ? `${course.name} (${course.code})` : 'N/A',
            Lecturer: lecturer ? lecturer.username : 'N/A',
            Week: report.week,
            Topic: report.topic,
            Date: new Date(report.date).toLocaleDateString(),
            Attendance: `${report.actual_students}/${report.total_students}`,
            'Attendance Rate': `${Math.round((report.actual_students / report.total_students) * 100)}%`,
            'Learning Outcomes': report.outcomes,
            Recommendations: report.recommendations,
            'PRL Feedback': report.feedback || 'Not provided',
            'Submitted On': new Date(report.created_at).toLocaleDateString(),
          };
        });
        const reportsWs = XLSX.utils.json_to_sheet(reportsData);
        XLSX.utils.book_append_sheet(wb, reportsWs, 'Reports');
      }

      // Ratings Sheet
      if (ratings.length > 0) {
        const ratingsData = ratings.map((rating) => {
          const course = courses.find((c) => c.id === rating.course_id);
          const lecturer = lecturers.find((l) => l.id === rating.lecturer_id);
          return {
            Course: course ? `${course.name} (${course.code})` : 'N/A',
            Lecturer: lecturer ? lecturer.username : 'N/A',
            Rating: `${rating.rating}/5`,
            'Student Feedback': rating.comment,
            'Submitted Date': new Date(rating.created_at).toLocaleDateString(),
          };
        });
        const ratingsWs = XLSX.utils.json_to_sheet(ratingsData);
        XLSX.utils.book_append_sheet(wb, ratingsWs, 'Ratings');
      }

      // Courses Sheet
      if (courses.length > 0) {
        const coursesData = courses.map((course) => ({
          'Course Name': course.name,
          'Course Code': course.code,
          Lecturer: lecturers.find((l) => l.id === course.lecturer_id)?.username || 'Not assigned',
          Department: course.department,
          Credits: course.credits,
          Schedule: course.schedule,
        }));
        const coursesWs = XLSX.utils.json_to_sheet(coursesData);
        XLSX.utils.book_append_sheet(wb, coursesWs, 'Courses');
      }

      // Classes Sheet
      if (classes.length > 0) {
        const classesData = classes.map((classItem) => {
          const course = courses.find((c) => c.id === classItem.course_id);
          const lecturer = lecturers.find((l) => l.id === classItem.lecturer_id);
          return {
            Course: course ? `${course.name} (${course.code})` : 'N/A',
            Lecturer: lecturer ? lecturer.username : 'N/A',
            Date: new Date(classItem.date).toLocaleDateString(),
            Time: classItem.time,
            Room: classItem.room,
            Topic: classItem.topic,
          };
        });
        const classesWs = XLSX.utils.json_to_sheet(classesData);
        XLSX.utils.book_append_sheet(wb, classesWs, 'Classes');
      }

      // Lecturers Sheet
      if (lecturers.length > 0) {
        const lecturersData = lecturers.map((lecturer) => ({
          Name: lecturer.username,
          Email: lecturer.email,
          Department: lecturer.faculty_name,
          Status: 'Active',
          'Courses Assigned': courses.filter((c) => c.lecturer_id === lecturer.id).length,
        }));
        const lecturersWs = XLSX.utils.json_to_sheet(lecturersData);
        XLSX.utils.book_append_sheet(wb, lecturersWs, 'Lecturers');
      }

      XLSX.writeFile(wb, `principal_portfolio_${currentUser?.username}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccess('All data exported to Excel successfully!');
    } catch (err) {
      setError('Error exporting data to Excel: ' + err.message);
    }
  };

  const handleAddFeedback = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      await axios.put(
        `https://matsepe.onrender.com/api/principal/reports/${selectedReport?.id}`,
        { feedback },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Feedback submitted successfully!');
      setFeedback('');
      setShowFeedbackModal(false);
      fetchPrincipalLecturerData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit feedback');
    }
  };

  const handleRatingSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      await axios.post(
        'https://matsepe.onrender.com/api/principal/ratings',
        ratingData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Rating submitted successfully!');
      setRatingData({ lecturer_id: '', rating: '', comment: '' });
      setShowRatingModal(false);
      fetchPrincipalLecturerData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit rating');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setCurrentUser(null);
    setSuccess('Logged out successfully');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('userData', JSON.stringify(user));
    setSuccess(`Welcome, ${user.username}!`);
    setTimeout(() => setSuccess(''), 3000);
    if (user.role === 'Principal Lecturer' || user.role === 'Program Leader') {
      fetchPrincipalLecturerData();
    }
  };

  // Modal handlers
  const handleEditCourse = (course) => {
    setSelectedCourse(course);
    setCourseData({
      name: course.name,
      code: course.code,
      lecturer_id: course.lecturer_id,
      credits: course.credits,
      department: course.department,
      schedule: course.schedule
    });
    setShowCourseModal(true);
  };

  const handleEditClass = (classItem) => {
    setSelectedClass(classItem);
    setClassData({
      course_id: classItem.course_id,
      lecturer_id: classItem.lecturer_id,
      date: classItem.date,
      time: classItem.time,
      room: classItem.room,
      topic: classItem.topic
    });
    setShowClassModal(true);
  };

  const resetCourseModal = () => {
    setSelectedCourse(null);
    setCourseData({
      name: '',
      code: '',
      lecturer_id: '',
      credits: '',
      department: '',
      schedule: ''
    });
  };

  const resetClassModal = () => {
    setSelectedClass(null);
    setClassData({
      course_id: '',
      lecturer_id: '',
      date: '',
      time: '',
      room: '',
      topic: ''
    });
  };

  // Public Dashboard (when not logged in)
  if (!currentUser) {
    return (
      <div className="public-dashboard">
        <div className="university-hero">
          <Container>
            <div className="hero-content text-center">
              <h1 className="university-title"> University Principal Lecturer Portal</h1>
              <p className="university-subtitle">Comprehensive Academic Management System</p>
            </div>
          </Container>
        </div>
        <Container className="py-5">
          <div className="login-section text-center mb-5">
            <Card className="login-feature-card">
              <Card.Body className="p-5">
                <h2 className="portal-title">Principal Lecturer Portal</h2>
                <p className="portal-subtitle mb-4">Access your department oversight and reporting tools</p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowAuthModal(true)}
                  className="login-btn-main"
                >
                  <i className="fas fa-sign-in-alt me-2"></i>Login / Register
                </Button>
              </Card.Body>
            </Card>
          </div>
          {/* Feature Showcase */}
          <div className="feature-showcase mt-5">
            <h3 className="feature-title mb-4">What's Inside Your Portal?</h3>
            <Row className="g-4">
              <Col md={4}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Department Reports</Card.Title>
                    <Card.Text className="feature-card-text">
                      Review and provide feedback on lecturer reports. Monitor attendance and outcomes.
                    </Card.Text>
                    <Badge bg="info" className="feature-badge">Oversight</Badge>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Ratings Management</Card.Title>
                    <Card.Text className="feature-card-text">
                      Evaluate lecturer performance and provide constructive feedback.
                    </Card.Text>
                    <Badge bg="success" className="feature-badge">Performance</Badge>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center p-4">
                    <Card.Title className="feature-card-title">Analytics Dashboard</Card.Title>
                    <Card.Text className="feature-card-text">
                      Gain insights into department performance with detailed analytics.
                    </Card.Text>
                    <Badge bg="primary" className="feature-badge">Data Insights</Badge>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>
          <AuthModal show={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
        </Container>
      </div>
    );
  }

  if (currentUser.role !== 'Principal Lecturer' && currentUser.role !== 'Program Leader') {
    return (
      <Container className="py-4">
        <Alert variant="warning">
          You are logged in as {currentUser.role}. Please log in as a Principal Lecturer or Program Leader to access this portal.
        </Alert>
        <Button variant="outline-danger" onClick={handleLogout}>
          Logout
        </Button>
      </Container>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <Container className="py-4 text-center">
        <div className="loading-spinner">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading your dashboard...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4 principal-lecturer-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="dashboard-title">Principal Lecturer Dashboard</h2>
          <p className="text-muted welcome-text">Welcome back, {currentUser.username}</p>
        </div>
        <div className="d-flex align-items-center">
          <Dropdown className="me-2">
            <Dropdown.Toggle variant="success" id="dropdown-export" className="export-btn">
              <i className="fas fa-download me-2"></i>Export Data
            </Dropdown.Toggle>
            <Dropdown.Menu className="export-menu">
              <Dropdown.Item onClick={exportAllDataToExcel} className="export-item">
                <i className="fas fa-file-excel me-2"></i>Export All Data
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={exportReportsToExcel} className="export-item">
                <i className="fas fa-file-alt me-2"></i>Export Reports
              </Dropdown.Item>
              <Dropdown.Item onClick={exportRatingsToExcel} className="export-item">
                <i className="fas fa-star me-2"></i>Export Ratings
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button variant="outline-danger" onClick={handleLogout} className="logout-btn">
            <i className="fas fa-sign-out-alt me-2"></i>Logout
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible className="alert-custom">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onClose={() => setSuccess('')} dismissible className="alert-custom">
          {success}
        </Alert>
      )}
      
      <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4 custom-tabs">
        <Tab eventKey="dashboard" title={<span><i className="fas fa-tachometer-alt me-2"></i>Dashboard</span>}>
          <DashboardTab
            currentUser={currentUser}
            reports={reports}
            ratings={ratings}
            courses={courses}
            lecturers={lecturers}
            classes={classes}
            onExportAll={exportAllDataToExcel}
          />
        </Tab>
        
        <Tab eventKey="courses" title={<span><i className="fas fa-book me-2"></i>Courses</span>}>
          <CoursesTab
            courses={courses}
            lecturers={lecturers}
            lectures={lectures}
            onAddCourse={() => {
              resetCourseModal();
              setShowCourseModal(true);
            }}
            onEditCourse={handleEditCourse}
            onDeleteCourse={handleDeleteCourse}
            onAddLecture={() => setShowLectureModal(true)}
            onDeleteLecture={handleDeleteLecture}
          />
        </Tab>
        
        <Tab eventKey="reports" title={<span><i className="fas fa-file-alt me-2"></i>Reports</span>}>
          <ReportsTab
            reports={reports}
            courses={courses}
            lecturers={lecturers}
            onFeedbackClick={(report) => {
              setSelectedReport(report);
              setFeedback(report.feedback || '');
              setShowFeedbackModal(true);
            }}
            onExport={exportReportsToExcel}
          />
        </Tab>
        
        <Tab eventKey="ratings" title={<span><i className="fas fa-star me-2"></i>Ratings</span>}>
          <RatingsTab
            ratings={ratings}
            courses={courses}
            lecturers={lecturers}
            onRatingSubmit={handleRatingSubmit}
            ratingData={ratingData}
            setRatingData={setRatingData}
            onExport={exportRatingsToExcel}
            setShowRatingModal={setShowRatingModal}
          />
        </Tab>
        
        <Tab eventKey="classes" title={<span><i className="fas fa-calendar-alt me-2"></i>Classes</span>}>
          <ClassesTab
            classes={classes}
            courses={courses}
            lecturers={lecturers}
            onAddClass={() => {
              resetClassModal();
              setShowClassModal(true);
            }}
            onEditClass={handleEditClass}
            onDeleteClass={handleDeleteClass}
          />
        </Tab>
        
        <Tab eventKey="monitoring" title={<span><i className="fas fa-chart-line me-2"></i>Monitoring</span>}>
          <MonitoringTab
            reports={reports}
            ratings={ratings}
            courses={courses}
            lecturers={lecturers}
            classes={classes}
          />
        </Tab>
        
        {(currentUser?.role === 'Principal Lecturer' || currentUser?.role === 'Program Leader') && (
          <Tab
            eventKey="analytics"
            title={
              <span>
                <BarChart className="me-2" />
                Analytics
              </span>
            }
          >
            <AnalyticsTab
              ratings={ratings}
              reports={reports}
              courses={courses}
              lecturers={lecturers}
            />
          </Tab>
        )}
      </Tabs>
      
      {/* Modals */}
      <FeedbackModal
        show={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        feedback={feedback}
        setFeedback={setFeedback}
        onSubmit={handleAddFeedback}
        report={selectedReport}
        courses={courses}
        lecturers={lecturers}
      />
      
      <RatingModal
        show={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        ratingData={ratingData}
        setRatingData={setRatingData}
        lecturers={lecturers}
        onSubmit={handleRatingSubmit}
      />
      
      <CourseModal
        show={showCourseModal}
        onClose={() => {
          setShowCourseModal(false);
          resetCourseModal();
        }}
        courseData={courseData}
        setCourseData={setCourseData}
        lecturers={lecturers}
        onSubmit={selectedCourse ? handleUpdateCourse : handleAddCourse}
        isEdit={!!selectedCourse}
      />
      
      <ClassModal
        show={showClassModal}
        onClose={() => {
          setShowClassModal(false);
          resetClassModal();
        }}
        classData={classData}
        setClassData={setClassData}
        courses={courses}
        lecturers={lecturers}
        onSubmit={selectedClass ? handleUpdateClass : handleAddClass}
        isEdit={!!selectedClass}
      />
      
      <LectureModal
        show={showLectureModal}
        onClose={() => setShowLectureModal(false)}
        lectureData={lectureData}
        setLectureData={setLectureData}
        courses={courses}
        onSubmit={handleAddLecture}
      />
    </Container>
  );
};

// Dashboard Component
const DashboardTab = ({ currentUser, reports, ratings, courses, lecturers, classes, onExportAll }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Department Overview</h4>
        <Button variant="outline-primary" onClick={onExportAll} className="export-all-btn">
          <i className="fas fa-file-excel me-2"></i>Export All Data to Excel
        </Button>
      </div>
      <Row>
        <Col md={4}>
          <Card className="mb-4 profile-card">
            <Card.Body className="text-center">
              <div className="profile-avatar">
                <i className="fas fa-user-tie"></i>
              </div>
              <Card.Title className="profile-name">{currentUser.username}</Card.Title>
              <Card.Text className="profile-info">
                <Badge bg="success" className="role-badge">{currentUser.role}</Badge>
                <br />
                <i className="fas fa-envelope me-2"></i>{currentUser.email}
                <br />
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
                  <div className="stats-icon reports-icon">
                    <i className="fas fa-file-alt"></i>
                  </div>
                  <Card.Title className="stats-number">{reports.length}</Card.Title>
                  <Card.Text className="stats-label">Reports Submitted</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-4 stats-card">
                <Card.Body className="text-center">
                  <div className="stats-icon ratings-icon">
                    <i className="fas fa-star"></i>
                  </div>
                  <Card.Title className="stats-number">{ratings.length}</Card.Title>
                  <Card.Text className="stats-label">Ratings Submitted</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-4 stats-card">
                <Card.Body className="text-center">
                  <div className="stats-icon courses-icon">
                    <i className="fas fa-book"></i>
                  </div>
                  <Card.Title className="stats-number">{courses.length}</Card.Title>
                  <Card.Text className="stats-label">Courses Managed</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-4 stats-card">
                <Card.Body className="text-center">
                  <div className="stats-icon lecturers-icon">
                    <i className="fas fa-chalkboard-teacher"></i>
                  </div>
                  <Card.Title className="stats-number">{lecturers.length}</Card.Title>
                  <Card.Text className="stats-label">Lecturers Managed</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-4 stats-card">
                <Card.Body className="text-center">
                  <div className="stats-icon classes-icon">
                    <i className="fas fa-calendar-alt"></i>
                  </div>
                  <Card.Title className="stats-number">{classes.length}</Card.Title>
                  <Card.Text className="stats-label">Classes Scheduled</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};

// Courses Component
const CoursesTab = ({ courses, lecturers, lectures, onAddCourse, onEditCourse, onDeleteCourse, onAddLecture, onDeleteLecture }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Course Management</h4>
        <div>
          <Button variant="primary" onClick={onAddCourse} className="me-2">
            <i className="fas fa-plus me-2"></i>Add Course
          </Button>
          <Button variant="outline-primary" onClick={onAddLecture}>
            <i className="fas fa-file-upload me-2"></i>Add Lecture Material
          </Button>
        </div>
      </div>
      
      <Row>
        <Col md={8}>
          <Card className="mb-4">
            <Card.Header>
              <h5>All Courses ({courses.length})</h5>
            </Card.Header>
            <Card.Body>
              {courses.length > 0 ? (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>Course Code</th>
                        <th>Course Name</th>
                        <th>Lecturer</th>
                        <th>Credits</th>
                        <th>Schedule</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course) => {
                        const lecturer = lecturers.find((l) => l.id === course.lecturer_id);
                        return (
                          <tr key={course.id}>
                            <td>{course.code}</td>
                            <td>{course.name}</td>
                            <td>{lecturer ? lecturer.username : 'Not assigned'}</td>
                            <td>{course.credits}</td>
                            <td>{course.schedule}</td>
                            <td>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => onEditCourse(course)}
                                className="me-1"
                              >
                                <i className="fas fa-edit"></i>
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => onDeleteCourse(course.id)}
                              >
                                <i className="fas fa-trash"></i>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="no-data text-center py-4">
                  <i className="fas fa-book fa-3x mb-3 text-muted"></i>
                  <p className="text-muted">No courses available.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4}>
          <Card>
            <Card.Header>
              <h5>Lecture Materials ({lectures.length})</h5>
            </Card.Header>
            <Card.Body>
              {lectures.length > 0 ? (
                <div className="lectures-list">
                  {lectures.map((lecture) => {
                    const course = courses.find((c) => c.id === lecture.course_id);
                    return (
                      <Card key={lecture.id} className="mb-2">
                        <Card.Body className="p-3">
                          <Card.Title className="lecture-title">{lecture.title}</Card.Title>
                          <Card.Text className="lecture-info mb-1">
                            <small>
                              <strong>Course:</strong> {course ? course.name : 'N/A'}
                            </small>
                          </Card.Text>
                          <Card.Text className="lecture-description mb-2">
                            <small>{lecture.description}</small>
                          </Card.Text>
                          <div className="d-flex justify-content-between align-items-center">
                            <Badge bg="info" className="materials-badge">
                              {lecture.materials ? 'Materials Available' : 'No Materials'}
                            </Badge>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => onDeleteLecture(lecture.id)}
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="no-data text-center py-4">
                  <i className="fas fa-file-alt fa-3x mb-3 text-muted"></i>
                  <p className="text-muted">No lecture materials available.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Reports Component
const ReportsTab = ({ reports, courses, lecturers, onFeedbackClick, onExport }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Department Reports</h4>
        <Button
          variant="outline-primary"
          onClick={onExport}
          disabled={reports.length === 0}
          className="export-btn-tab"
        >
          <i className="fas fa-download me-2"></i>Export to Excel
        </Button>
      </div>
      <Row>
        <Col>
          <div className="reports-list">
            <h5 className="reports-title">Submitted Reports ({reports.length})</h5>
            {reports.length > 0 ? (
              reports.map((report) => {
                const course = courses.find((c) => c.id === report.course_id);
                const lecturer = lecturers.find((l) => l.id === report.lecturer_id);
                return (
                  <Card key={report.id} className="mb-3 report-card">
                    <Card.Body>
                      <Card.Title className="report-title">{report.topic}</Card.Title>
                      <Badge bg="primary" className="report-badge">
                        Week {report.week}
                      </Badge>
                      <Card.Text className="report-description mt-2">
                        <strong>Course:</strong> {course ? `${course.name} (${course.code})` : 'N/A'}
                        <br />
                        <strong>Lecturer:</strong> {lecturer ? lecturer.username : 'N/A'}
                        <br />
                        <strong>Attendance:</strong> {report.actual_students}/{report.total_students}
                        <br />
                        <strong>Outcomes:</strong> {report.outcomes}
                        <br />
                        <strong>Recommendations:</strong> {report.recommendations}
                        <br />
                        <strong>Feedback:</strong> {report.feedback || 'Not provided'}
                      </Card.Text>
                      <Button
                        variant="outline-primary"
                        onClick={() => onFeedbackClick(report)}
                        className="mt-2"
                      >
                        Add Feedback
                      </Button>
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

// Ratings Component
const RatingsTab = ({ ratings, courses, lecturers, onRatingSubmit, ratingData, setRatingData, onExport, setShowRatingModal }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Lecturer Ratings</h4>
        <div>
          <Button
            variant="outline-primary"
            onClick={() => setShowRatingModal(true)}
            className="me-2"
          >
            <i className="fas fa-star me-2"></i>Add Rating
          </Button>
          <Button
            variant="outline-primary"
            onClick={onExport}
            disabled={ratings.length === 0}
            className="export-btn-tab"
          >
            <i className="fas fa-download me-2"></i>Export to Excel
          </Button>
        </div>
      </div>
      <Row>
        <Col>
          <div className="ratings-list">
            <h5 className="ratings-title">Submitted Ratings ({ratings.length})</h5>
            {ratings.length > 0 ? (
              ratings.map((rating) => {
                const course = courses.find((c) => c.id === rating.course_id);
                const lecturer = lecturers.find((l) => l.id === rating.lecturer_id);
                return (
                  <Card key={rating.id} className="mb-3 rating-card">
                    <Card.Body>
                      <Card.Title className="rating-course-title">
                        <i className="fas fa-graduation-cap me-2"></i>
                        {course ? `${course.name} (${course.code})` : 'N/A'}
                      </Card.Title>
                      <Card.Text>
                        <strong>Lecturer:</strong> {lecturer ? lecturer.username : 'N/A'}
                        <br />
                        <div className="rating-stars-static">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className={`star ${rating.rating >= star ? 'filled' : ''}`}>
                              ★
                            </span>
                          ))}
                        </div>
                        <Badge bg="info" className="ms-2 rating-badge">
                          {rating.rating}/5
                        </Badge>
                        <br />
                        <strong>Comment:</strong> {rating.comment}
                        <br />
                        <small className="text-muted">
                          <i className="fas fa-calendar me-2"></i>
                          Submitted: {new Date(rating.created_at).toLocaleDateString()}
                        </small>
                      </Card.Text>
                    </Card.Body>
                  </Card>
                );
              })
            ) : (
              <div className="no-data">
                <i className="fas fa-inbox fa-3x mb-3"></i>
                <p className="text-muted">No ratings submitted yet.</p>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
};

// Classes Component
const ClassesTab = ({ classes, courses, lecturers, onAddClass, onEditClass, onDeleteClass }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Class Schedule Management</h4>
        <Button variant="primary" onClick={onAddClass}>
          <i className="fas fa-plus me-2"></i>Schedule Class
        </Button>
      </div>
      
      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h5>Scheduled Classes ({classes.length})</h5>
            </Card.Header>
            <Card.Body>
              {classes.length > 0 ? (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Lecturer</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Room</th>
                        <th>Topic</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((classItem) => {
                        const course = courses.find((c) => c.id === classItem.course_id);
                        const lecturer = lecturers.find((l) => l.id === classItem.lecturer_id);
                        return (
                          <tr key={classItem.id}>
                            <td>{course ? `${course.name} (${course.code})` : 'N/A'}</td>
                            <td>{lecturer ? lecturer.username : 'N/A'}</td>
                            <td>{new Date(classItem.date).toLocaleDateString()}</td>
                            <td>{classItem.time}</td>
                            <td>{classItem.room}</td>
                            <td>{classItem.topic}</td>
                            <td>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => onEditClass(classItem)}
                                className="me-1"
                              >
                                <i className="fas fa-edit"></i>
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => onDeleteClass(classItem.id)}
                              >
                                <i className="fas fa-trash"></i>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="no-data text-center py-4">
                  <i className="fas fa-calendar-alt fa-3x mb-3 text-muted"></i>
                  <p className="text-muted">No classes scheduled yet.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Monitoring Component
const MonitoringTab = ({ reports, ratings, courses, lecturers, classes }) => {
  // Calculate statistics
  const totalAttendance = reports.reduce((sum, report) => sum + report.actual_students, 0);
  const totalPossibleAttendance = reports.reduce((sum, report) => sum + report.total_students, 0);
  const averageAttendanceRate = totalPossibleAttendance > 0 ? (totalAttendance / totalPossibleAttendance * 100).toFixed(1) : 0;
  
  const averageRating = ratings.length > 0 
    ? (ratings.reduce((sum, rating) => sum + parseFloat(rating.rating), 0) / ratings.length).toFixed(1)
    : 0;

  return (
    <div>
      <h4 className="section-title">Department Monitoring</h4>
      
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Average Rating</Card.Title>
              <div className="display-4 text-primary">{averageRating}/5</div>
              <Card.Text>Across all lecturers</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Attendance Rate</Card.Title>
              <div className="display-4 text-success">{averageAttendanceRate}%</div>
              <Card.Text>Overall attendance</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Active Courses</Card.Title>
              <div className="display-4 text-info">{courses.length}</div>
              <Card.Text>Courses this semester</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Upcoming Classes</Card.Title>
              <div className="display-4 text-warning">
                {classes.filter(c => new Date(c.date) >= new Date()).length}
              </div>
              <Card.Text>Scheduled classes</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Row>
        <Col md={6}>
          <Card>
            <Card.Header>
              <h5>Recent Reports</h5>
            </Card.Header>
            <Card.Body>
              {reports.slice(0, 5).map((report) => {
                const course = courses.find((c) => c.id === report.course_id);
                const lecturer = lecturers.find((l) => l.id === report.lecturer_id);
                return (
                  <div key={report.id} className="mb-3 pb-3 border-bottom">
                    <strong>{course ? course.name : 'N/A'}</strong> - {report.topic}
                    <br />
                    <small className="text-muted">
                      By {lecturer ? lecturer.username : 'N/A'} | {new Date(report.date).toLocaleDateString()}
                    </small>
                  </div>
                );
              })}
              {reports.length === 0 && (
                <p className="text-muted">No reports available</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header>
              <h5>Lecturer Performance</h5>
            </Card.Header>
            <Card.Body>
              {lecturers.map((lecturer) => {
                const lecturerRatings = ratings.filter(r => r.lecturer_id === lecturer.id);
                const avgRating = lecturerRatings.length > 0 
                  ? (lecturerRatings.reduce((sum, r) => sum + parseFloat(r.rating), 0) / lecturerRatings.length).toFixed(1)
                  : 'N/A';
                
                return (
                  <div key={lecturer.id} className="mb-2 d-flex justify-content-between">
                    <span>{lecturer.username}</span>
                    <Badge bg={avgRating >= 4 ? 'success' : avgRating >= 3 ? 'warning' : 'danger'}>
                      {avgRating}/5
                    </Badge>
                  </div>
                );
              })}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Analytics Component
const AnalyticsTab = ({ ratings, reports, courses, lecturers }) => {
  return (
    <div>
      <h4 className="section-title">Analytics Dashboard</h4>
      <Row>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <h5>Course Performance</h5>
            </Card.Header>
            <Card.Body>
              {courses.length > 0 ? (
                courses.map((course) => {
                  const courseRatings = ratings.filter((r) => r.course_id === course.id);
                  const avgRating =
                    courseRatings.length > 0
                      ? (courseRatings.reduce((sum, r) => sum + parseFloat(r.rating), 0) / courseRatings.length).toFixed(1)
                      : 'N/A';
                  return (
                    <div key={course.id} className="mb-3">
                      <strong>{course.name} ({course.code})</strong>: {avgRating}/5
                      <Badge bg={avgRating < 3 ? 'danger' : avgRating < 4 ? 'warning' : 'success'} className="ms-2">
                        {avgRating === 'N/A' ? 'No Ratings' : `${avgRating}/5`}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p>No courses available.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <h5>Lecturer Performance</h5>
            </Card.Header>
            <Card.Body>
              {lecturers.length > 0 ? (
                lecturers.map((lecturer) => {
                  const lecturerRatings = ratings.filter((r) => r.lecturer_id === lecturer.id);
                  const avgRating =
                    lecturerRatings.length > 0
                      ? (lecturerRatings.reduce((sum, r) => sum + parseFloat(r.rating), 0) / lecturerRatings.length).toFixed(1)
                      : 'N/A';
                  return (
                    <div key={lecturer.id} className="mb-3">
                      <strong>{lecturer.username}</strong>: {avgRating}/5
                      <Badge bg={avgRating < 3 ? 'danger' : avgRating < 4 ? 'warning' : 'success'} className="ms-2">
                        {avgRating === 'N/A' ? 'No Ratings' : `${avgRating}/5`}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p>No lecturers available.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Feedback Modal
const FeedbackModal = ({ show, onClose, feedback, setFeedback, onSubmit, report, courses, lecturers }) => {
  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Feedback for Report</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {report && (
          <div className="mb-3">
            <strong>Course:</strong> {report.course_id ? (courses.find((c) => c.id === report.course_id)?.name || 'N/A') : 'N/A'}
            <br />
            <strong>Lecturer:</strong> {report.lecturer_id ? (lecturers.find((l) => l.id === report.lecturer_id)?.username || 'N/A') : 'N/A'}
            <br />
            <strong>Topic:</strong> {report.topic}
          </div>
        )}
        <Form.Group>
          <Form.Label>Feedback</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Provide feedback for this report..."
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onSubmit} disabled={!feedback}>
          Submit Feedback
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Rating Modal
const RatingModal = ({ show, onClose, ratingData, setRatingData, lecturers, onSubmit }) => {
  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Lecturer Rating</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Select Lecturer</Form.Label>
            <Form.Select
              value={ratingData.lecturer_id}
              onChange={(e) => setRatingData({ ...ratingData, lecturer_id: e.target.value })}
            >
              <option value="">Choose a lecturer...</option>
              {lecturers.map((lecturer) => (
                <option key={lecturer.id} value={lecturer.id}>
                  {lecturer.username}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Rating (1-5)</Form.Label>
            <div className="rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star ${ratingData.rating >= star ? 'filled' : ''}`}
                  onClick={() => setRatingData({ ...ratingData, rating: star.toString() })}
                >
                  ★
                </span>
              ))}
            </div>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Comment</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={ratingData.comment}
              onChange={(e) => setRatingData({ ...ratingData, comment: e.target.value })}
              placeholder="Provide feedback on the lecturer..."
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!ratingData.lecturer_id || !ratingData.rating}
        >
          Submit Rating
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Course Modal
const CourseModal = ({ show, onClose, courseData, setCourseData, lecturers, onSubmit, isEdit }) => {
  return (
    <Modal show={show} onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? 'Edit Course' : 'Add New Course'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Course Name</Form.Label>
                <Form.Control
                  type="text"
                  value={courseData.name}
                  onChange={(e) => setCourseData({ ...courseData, name: e.target.value })}
                  placeholder="Enter course name"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Course Code</Form.Label>
                <Form.Control
                  type="text"
                  value={courseData.code}
                  onChange={(e) => setCourseData({ ...courseData, code: e.target.value })}
                  placeholder="Enter course code"
                />
              </Form.Group>
            </Col>
          </Row>
          
          <Form.Group className="mb-3">
            <Form.Label>Assigned Lecturer</Form.Label>
            <Form.Select
              value={courseData.lecturer_id}
              onChange={(e) => setCourseData({ ...courseData, lecturer_id: e.target.value })}
            >
              <option value="">Select a lecturer...</option>
              {lecturers.map((lecturer) => (
                <option key={lecturer.id} value={lecturer.id}>
                  {lecturer.username}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Credits</Form.Label>
                <Form.Control
                  type="number"
                  value={courseData.credits}
                  onChange={(e) => setCourseData({ ...courseData, credits: e.target.value })}
                  placeholder="Enter credit hours"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Department</Form.Label>
                <Form.Control
                  type="text"
                  value={courseData.department}
                  onChange={(e) => setCourseData({ ...courseData, department: e.target.value })}
                  placeholder="Enter department"
                />
              </Form.Group>
            </Col>
          </Row>
          
          <Form.Group className="mb-3">
            <Form.Label>Schedule</Form.Label>
            <Form.Control
              type="text"
              value={courseData.schedule}
              onChange={(e) => setCourseData({ ...courseData, schedule: e.target.value })}
              placeholder="e.g., Mon/Wed/Fri 10:00-11:00"
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!courseData.name || !courseData.code || !courseData.lecturer_id}
        >
          {isEdit ? 'Update Course' : 'Add Course'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Class Modal
const ClassModal = ({ show, onClose, classData, setClassData, courses, lecturers, onSubmit, isEdit }) => {
  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? 'Edit Class' : 'Schedule New Class'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Course</Form.Label>
            <Form.Select
              value={classData.course_id}
              onChange={(e) => setClassData({ ...classData, course_id: e.target.value })}
            >
              <option value="">Select a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Lecturer</Form.Label>
            <Form.Select
              value={classData.lecturer_id}
              onChange={(e) => setClassData({ ...classData, lecturer_id: e.target.value })}
            >
              <option value="">Select a lecturer...</option>
              {lecturers.map((lecturer) => (
                <option key={lecturer.id} value={lecturer.id}>
                  {lecturer.username}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  value={classData.date}
                  onChange={(e) => setClassData({ ...classData, date: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Time</Form.Label>
                <Form.Control
                  type="time"
                  value={classData.time}
                  onChange={(e) => setClassData({ ...classData, time: e.target.value })}
                />
              </Form.Group>
            </Col>
          </Row>
          
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Room</Form.Label>
                <Form.Control
                  type="text"
                  value={classData.room}
                  onChange={(e) => setClassData({ ...classData, room: e.target.value })}
                  placeholder="Enter room number"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Topic</Form.Label>
                <Form.Control
                  type="text"
                  value={classData.topic}
                  onChange={(e) => setClassData({ ...classData, topic: e.target.value })}
                  placeholder="Enter class topic"
                />
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!classData.course_id || !classData.lecturer_id || !classData.date || !classData.time}
        >
          {isEdit ? 'Update Class' : 'Schedule Class'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Lecture Modal
const LectureModal = ({ show, onClose, lectureData, setLectureData, courses, onSubmit }) => {
  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Lecture Material</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Course</Form.Label>
            <Form.Select
              value={lectureData.course_id}
              onChange={(e) => setLectureData({ ...lectureData, course_id: e.target.value })}
            >
              <option value="">Select a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Title</Form.Label>
            <Form.Control
              type="text"
              value={lectureData.title}
              onChange={(e) => setLectureData({ ...lectureData, title: e.target.value })}
              placeholder="Enter lecture title"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={lectureData.description}
              onChange={(e) => setLectureData({ ...lectureData, description: e.target.value })}
              placeholder="Enter lecture description"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Materials (URL or description)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={lectureData.materials}
              onChange={(e) => setLectureData({ ...lectureData, materials: e.target.value })}
              placeholder="Enter materials URL or description"
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!lectureData.course_id || !lectureData.title}
        >
          Add Lecture Material
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Authentication Modal
const AuthModal = ({ show, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    faculty_name: '',
    role: 'Principal Lecturer',
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
        <Modal.Title>{isRegister ? 'Create Account' : 'Login to System'}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="auth-body">
        {authError && <Alert variant="danger" className="auth-alert">{authError}</Alert>}
        <div className="role-selection mb-4">
          <h6>Select Your Role:</h6>
          <div className="role-buttons">
            {['Principal Lecturer', 'Program Leader'].map((role) => (
              <Button
                key={role}
                variant={formData.role === role ? 'primary' : 'outline-primary'}
                onClick={() => setFormData({ ...formData, role })}
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
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="auth-input"
                  placeholder="Enter your email"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="auth-label">Faculty/Department</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.faculty_name}
                  onChange={(e) => setFormData({ ...formData, faculty_name: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

export default PrincipalLecturer;