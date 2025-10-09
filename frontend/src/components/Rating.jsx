import React, { useState, useEffect } from 'react';
import { Container, Button, Form, ListGroup, Card, Row, Col, Badge, Tabs, Tab, Modal, Alert, InputGroup, Table, Spinner, Dropdown, Navbar, Nav, Offcanvas, Accordion, OverlayTrigger, Tooltip } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Rating = () => {
  const [ratings, setRatings] = useState([]);
  const [search, setSearch] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [activeTab, setActiveTab] = useState('submit');
  const [aggregatedData, setAggregatedData] = useState({});
  const [ratingTrends, setRatingTrends] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [poorRatingAlerts, setPoorRatingAlerts] = useState([]);
  
  // New Features State
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [quickActions, setQuickActions] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [sentimentAnalysis, setSentimentAnalysis] = useState({});
  const [ratingDistribution, setRatingDistribution] = useState({});
  const [comparisonData, setComparisonData] = useState({});
  const [customReports, setCustomReports] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [collaborationNotes, setCollaborationNotes] = useState([]);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [performanceGoals, setPerformanceGoals] = useState([]);
  const [ratingTemplates, setRatingTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState('default');
  
  // Public stats
  const [publicStats, setPublicStats] = useState({
    totalRatings: 0,
    averageRating: 0,
    topCourses: [],
    recentReviews: []
  });
  
  // Rating state
  const [rating, setRating] = useState({
    course_id: '',
    rating: 0,
    comment: '',
    anonymous: false,
    template: 'default'
  });

  // Initialize new features
  useEffect(() => {
    if (isAuthenticated) {
      initializeNewFeatures();
    }
  }, [isAuthenticated]);

  const initializeNewFeatures = () => {
    // Initialize notifications
    setNotifications([
      {
        id: 1,
        type: 'system',
        title: 'Welcome to Enhanced Rating System',
        message: 'New features are now available!',
        timestamp: new Date(),
        read: false
      },
      {
        id: 2,
        type: 'rating',
        title: 'Rating Submitted Successfully',
        message: 'Your recent rating has been recorded',
        timestamp: new Date(Date.now() - 3600000),
        read: false
      }
    ]);

    // Initialize quick actions
    setQuickActions([
      { id: 1, name: 'Quick Rating', icon: '⭐', action: () => handleQuickRating() },
      { id: 2, name: 'Export Ratings', icon: '📤', action: () => exportToExcel(ratings, 'my_ratings') },
      { id: 3, name: 'Add Note', icon: '📝', action: () => handleAddNote() },
      { id: 4, name: 'Generate Report', icon: '📊', action: () => generateQuickReport() }
    ]);

    // Initialize AI insights
    setAiInsights([
      {
        id: 1,
        type: 'improvement',
        title: 'Rating Pattern Detected',
        message: 'Your ratings show consistent feedback for practical assignments',
        confidence: 0.85,
        actionable: true
      },
      {
        id: 2,
        type: 'suggestion',
        title: 'Review Distribution',
        message: 'Consider rating more courses to help other students',
        confidence: 0.72,
        actionable: true
      }
    ]);

    // Initialize sentiment analysis
    setSentimentAnalysis({
      positive: 65,
      neutral: 25,
      negative: 10,
      trending: 'improving'
    });

    // Initialize rating distribution
    setRatingDistribution({
      1: 5,
      2: 12,
      3: 28,
      4: 35,
      5: 20
    });

    // Initialize rating templates
    setRatingTemplates([
      { id: 'default', name: 'Standard Rating', icon: '⭐' },
      { id: 'detailed', name: 'Detailed Review', icon: '📝' },
      { id: 'quick', name: 'Quick Rating', icon: '⚡' },
      { id: 'anonymous', name: 'Anonymous', icon: '👤' }
    ]);

    // Initialize performance goals
    setPerformanceGoals([
      { id: 1, goal: 'Rate 5 courses this semester', progress: 2, target: 5 },
      { id: 2, goal: 'Maintain rating consistency', progress: 80, target: 100 },
      { id: 3, goal: 'Provide constructive feedback', progress: 4, target: 10 }
    ]);
  };

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedRole = localStorage.getItem('role');
    const storedUserId = localStorage.getItem('user_id');
    const storedUserName = localStorage.getItem('user_name');
   
    if (token && storedRole && storedUserId) {
      setIsAuthenticated(true);
      setUserRole(storedRole);
      setUserId(storedUserId);
      setUserName(storedUserName);
      fetchPrivateData();
    } else {
      fetchPublicData();
    }
  }, []);

  // Fetch public data
  const fetchPublicData = async () => {
    try {
      const res = await axios.get('https://matsepe.onrender.com/api/ratings/public');
      setPublicStats(res.data);
    } catch (err) {
      console.log('Public data not available, using default stats');
      setPublicStats({
        totalRatings: 0,
        averageRating: 0,
        topCourses: [],
        recentReviews: []
      });
    }
  };

  // Fetch private data - UPDATED ENDPOINTS
  const fetchPrivateData = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch courses using the new endpoint
      const coursesRes = await axios.get('https://matsepe.onrender.com/api/ratings/courses/list', { headers });
      setCourses(coursesRes.data || []);
      
      // Fetch user's course ratings
      const ratingsRes = await axios.get('https://matsepe.onrender.com/api/ratings/course', { headers });
      setRatings(ratingsRes.data || []);

      // Note: The following endpoints might not exist in your backend yet
      // You can remove them or implement them in your backend
      try {
        const [lecturersRes, aggregatedRes, trendsRes] = await Promise.all([
          axios.get('https://matsepe.onrender.com/api/lecturers', { headers }).catch(() => ({ data: [] })),
          axios.get('https://matsepe.onrender.com/api/ratings/aggregated', { headers }).catch(() => ({ data: {} })),
          axios.get('https://matsepe.onrender.com/api/ratings/trends', { headers }).catch(() => ({ data: [] }))
        ]);
        
        setLecturers(lecturersRes.data || []);
        setAggregatedData(aggregatedRes.data || {});
        setRatingTrends(trendsRes.data || []);
        checkPoorRatings(aggregatedRes.data);
      } catch (secondaryError) {
        console.log('Secondary data endpoints not available');
      }
      
    } catch (err) {
      console.error('Error fetching private data:', err);
      setRatings([]);
      setCourses([]);
      setLecturers([]);
      setAggregatedData({});
      setRatingTrends([]);
      setPoorRatingAlerts([]);
    }
    setLoading(false);
  };

  // Check for poor ratings (below 3.0)
  const checkPoorRatings = (data) => {
    if (!data) return;
    
    const alerts = [];
    if (data.courses) {
      Object.entries(data.courses).forEach(([courseId, courseData]) => {
        if (courseData.overall < 3.0) {
          alerts.push({
            type: 'course',
            id: courseId,
            name: courseData.name || courseId,
            rating: courseData.overall,
            message: `Course "${courseData.name || courseId}" has low rating: ${courseData.overall}/5`
          });
        }
      });
    }
    if (data.lecturers) {
      Object.entries(data.lecturers).forEach(([lecturerId, lecturerData]) => {
        if (lecturerData.overall < 3.0) {
          alerts.push({
            type: 'lecturer',
            id: lecturerId,
            name: lecturerData.name || lecturerId,
            rating: lecturerData.overall,
            message: `Lecturer "${lecturerData.name || lecturerId}" has low rating: ${lecturerData.overall}/5`
          });
        }
      });
    }
    setPoorRatingAlerts(alerts);
  };

  // New Feature Functions
  const toggleFavorite = (courseId) => {
    if (favorites.includes(courseId)) {
      setFavorites(favorites.filter(id => id !== courseId));
    } else {
      setFavorites([...favorites, courseId]);
    }
  };

  const handleQuickRating = () => {
    // Auto-select first available course and set a default rating
    if (courses.length > 0) {
      setRating({
        ...rating,
        course_id: courses[0].id,
        rating: 4,
        template: 'quick'
      });
      addNotification('rating', 'Quick Rating Ready', 'First course selected for quick rating');
    }
  };

  const generateQuickReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      totalRatings: ratings.length,
      averageRating: ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length,
      ratingDistribution: ratingDistribution,
      sentiment: sentimentAnalysis
    };
    exportToPDF([reportData], 'ratings_report');
  };

  const handleAddNote = () => {
    const note = prompt('Enter your note about course ratings:');
    if (note) {
      const newNote = {
        id: Date.now(),
        content: note,
        courseId: rating.course_id,
        timestamp: new Date()
      };
      setCollaborationNotes(prev => [newNote, ...prev]);
      addNotification('note', 'Note Added', 'Your note has been saved');
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

  // Login success handler
  const handleLoginSuccess = (userData) => {
    const { id, username, role, token } = userData;
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('user_id', id);
    localStorage.setItem('user_name', username);
    localStorage.setItem('user_username', username);
    setIsAuthenticated(true);
    setUserRole(role);
    setUserId(id);
    setUserName(username);
    setShowLoginModal(false);
    fetchPrivateData();
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_username');
    setIsAuthenticated(false);
    setUserRole('');
    setUserId('');
    setUserName('');
    setRatings([]);
    setCourses([]);
    setLecturers([]);
    setAggregatedData({});
    setRatingTrends([]);
    setPoorRatingAlerts([]);
    fetchPublicData();
  };

  // Submit rating - UPDATED TO USE CORRECT ENDPOINT AND DATA STRUCTURE
  const handleSubmitRating = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (userRole !== 'Student') {
      alert('Only students can submit ratings');
      return;
    }
    if (!rating.course_id || !rating.rating) {
      alert('Course and rating are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Prepare rating data according to backend expectations
      const ratingData = {
        course_id: rating.course_id,
        rating: rating.rating,
        comment: rating.comment
        // Note: 'rating_type' is automatically set to 'course' by your backend
        // The user_id is taken from the token in the backend
      };

      await axios.post('https://matsepe.onrender.com/api/ratings/course', ratingData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      addNotification('success', 'Rating Submitted', 'Your rating has been submitted successfully!');
      
      // Reset form
      setRating({
        course_id: '',
        rating: 0,
        comment: '',
        anonymous: false,
        template: 'default'
      });
      
      // Refresh data to show the new rating
      fetchPrivateData();
    } catch (err) {
      console.error('Rating submission error:', err);
      addNotification('error', 'Submission Failed', err.response?.data?.error || 'Submission failed');
    }
  };

  // Star rating component
  const StarRating = ({ value, onChange, size = '2rem' }) => (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`star ${star <= value ? 'filled' : ''}`}
          onClick={() => onChange({ ...rating, rating: star })}
          style={{ 
            cursor: 'pointer', 
            fontSize: size, 
            margin: '0 2px', 
            color: star <= value ? '#ffc107' : '#e4e5e9',
            transition: 'all 0.3s ease'
          }}
        >
          ★
        </span>
      ))}
      <span className="rating-value ms-2" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
        {value}/5
      </span>
    </div>
  );

  // Enhanced Navigation Bar
  const EnhancedNavbar = () => (
    <Navbar expand="lg" className="rating-navbar mb-4">
      <Container fluid>
        <Navbar.Brand className="brand-section">
          <i className="fas fa-star me-2"></i>
          <span className="brand-text">Enhanced Rating System</span>
          <Badge bg="success" className="ms-2">v2.0</Badge>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="enhanced-rating-navbar" />
        
        <Navbar.Collapse id="enhanced-rating-navbar">
          <Nav className="me-auto">
            <Nav.Link 
              active={activeTab === 'submit'} 
              onClick={() => setActiveTab('submit')}
              className="nav-link-custom"
            >
              <i className="fas fa-star me-1"></i>
              Submit Rating
            </Nav.Link>
            
            <Nav.Link 
              active={activeTab === 'analytics'} 
              onClick={() => setActiveTab('analytics')}
              className="nav-link-custom"
            >
              <i className="fas fa-chart-bar me-1"></i>
              Analytics
            </Nav.Link>
            
            {/* New Features Navigation */}
            <Nav.Link 
              active={activeTab === 'insights'} 
              onClick={() => setActiveTab('insights')}
              className="nav-link-custom"
            >
              <i className="fas fa-brain me-1"></i>
              AI Insights
            </Nav.Link>
            
            <Nav.Link 
              active={activeTab === 'reports'} 
              onClick={() => setActiveTab('reports')}
              className="nav-link-custom"
            >
              <i className="fas fa-chart-pie me-1"></i>
              Reports
            </Nav.Link>
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
                {userName}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => setShowSettings(true)}>
                  <i className="fas fa-cog me-2"></i>
                  Settings
                </Dropdown.Item>
                <Dropdown.Item onClick={() => setShowNotesModal(true)}>
                  <i className="fas fa-sticky-note me-2"></i>
                  My Notes
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

  // AI Insights Component
  const AIInsightsComponent = () => (
    <Card className="mb-4">
      <Card.Header className="form-card-header">
        <h5 className="mb-0">
          <i className="fas fa-brain me-2 text-primary"></i>
          AI-Powered Rating Insights
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
                      insight.type === 'suggestion' ? 'info' : 'warning'
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
                      View Details
                    </Button>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
        
        {/* Sentiment Analysis */}
        <Row className="mt-4">
          <Col md={6}>
            <Card>
              <Card.Body>
                <h6>Sentiment Analysis</h6>
                <div className="sentiment-bars">
                  <div className="sentiment-bar positive" style={{width: `${sentimentAnalysis.positive}%`}}>
                    <span>Positive: {sentimentAnalysis.positive}%</span>
                  </div>
                  <div className="sentiment-bar neutral" style={{width: `${sentimentAnalysis.neutral}%`}}>
                    <span>Neutral: {sentimentAnalysis.neutral}%</span>
                  </div>
                  <div className="sentiment-bar negative" style={{width: `${sentimentAnalysis.negative}%`}}>
                    <span>Negative: {sentimentAnalysis.negative}%</span>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <Badge bg="info">Trend: {sentimentAnalysis.trending}</Badge>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card>
              <Card.Body>
                <h6>Rating Distribution</h6>
                <div className="rating-distribution">
                  {[5,4,3,2,1].map(stars => (
                    <div key={stars} className="distribution-row">
                      <span className="stars">{'★'.repeat(stars)}</span>
                      <div className="distribution-bar">
                        <div 
                          className="distribution-fill" 
                          style={{width: `${ratingDistribution[stars]}%`}}
                        ></div>
                      </div>
                      <span className="percentage">{ratingDistribution[stars]}%</span>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  // Reports Component
  const ReportsComponent = () => (
    <Card className="mb-4">
      <Card.Header className="form-card-header">
        <h5 className="mb-0">
          <i className="fas fa-chart-pie me-2 text-warning"></i>
          Rating Reports & Analytics
        </h5>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={4}>
            <Card className="report-card text-center">
              <Card.Body>
                <div className="report-icon">📊</div>
                <h6>Rating Summary</h6>
                <p>Overall rating statistics and trends</p>
                <Button size="sm" variant="outline-primary" onClick={generateQuickReport}>
                  Generate Report
                </Button>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="report-card text-center">
              <Card.Body>
                <div className="report-icon">📈</div>
                <h6>Comparison Report</h6>
                <p>Compare ratings across courses</p>
                <Button size="sm" variant="outline-success">
                  Generate
                </Button>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="report-card text-center">
              <Card.Body>
                <div className="report-icon">📋</div>
                <h6>Detailed Analysis</h6>
                <p>In-depth rating insights</p>
                <Button size="sm" variant="outline-info">
                  Generate
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        {/* Performance Goals */}
        <div className="mt-4">
          <h6>Your Rating Goals</h6>
          <ListGroup variant="flush">
            {performanceGoals.map(goal => (
              <ListGroup.Item key={goal.id} className="goal-item">
                <div className="d-flex justify-content-between align-items-center">
                  <span>{goal.goal}</span>
                  <div className="goal-progress">
                    <div className="progress" style={{width: '100px', height: '8px'}}>
                      <div 
                        className="progress-bar" 
                        style={{width: `${(goal.progress / goal.target) * 100}%`}}
                      ></div>
                    </div>
                    <small className="ms-2">{goal.progress}/{goal.target}</small>
                  </div>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </div>
      </Card.Body>
    </Card>
  );

  // Enhanced Rating Form with Templates
  const EnhancedRatingForm = () => (
    <Card className="form-card">
      <Card.Header className="form-card-header">
        <div className="d-flex justify-content-between align-items-center">
          <h5><i className="fas fa-star me-2"></i>Rate a Course</h5>
          <Dropdown>
            <Dropdown.Toggle variant="outline-secondary" size="sm">
              <i className="fas fa-cog me-1"></i>
              Template: {ratingTemplates.find(t => t.id === activeTemplate)?.name}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {ratingTemplates.map(template => (
                <Dropdown.Item 
                  key={template.id}
                  onClick={() => setActiveTemplate(template.id)}
                >
                  <span className="me-2">{template.icon}</span>
                  {template.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </Card.Header>
      <Card.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label className="form-label">Select Course</Form.Label>
            <InputGroup>
              <Form.Select
                value={rating.course_id}
                onChange={e => setRating({ ...rating, course_id: e.target.value })}
                className="form-select-custom"
              >
                <option value="">Choose a course...</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.code})
                    {favorites.includes(course.id) && ' ⭐'}
                  </option>
                ))}
              </Form.Select>
              <OverlayTrigger
                placement="top"
                overlay={<Tooltip>
                  {favorites.includes(rating.course_id) ? 'Remove from favorites' : 'Add to favorites'}
                </Tooltip>}
              >
                <Button 
                  variant="outline-warning"
                  onClick={() => rating.course_id && toggleFavorite(rating.course_id)}
                  disabled={!rating.course_id}
                >
                  <i className={`fas fa-star ${favorites.includes(rating.course_id) ? 'text-warning' : 'text-muted'}`}></i>
                </Button>
              </OverlayTrigger>
            </InputGroup>
            {courses.length === 0 && (
              <Form.Text className="text-muted">
                No courses available. Make sure you're enrolled in courses.
              </Form.Text>
            )}
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label className="form-label">Rating</Form.Label>
            <StarRating value={rating.rating} onChange={setRating} size="2.5rem" />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label className="form-label">
              Comments {activeTemplate === 'detailed' && '(Required)'}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={activeTemplate === 'detailed' ? 5 : 3}
              value={rating.comment}
              onChange={e => setRating({ ...rating, comment: e.target.value })}
              className="form-textarea"
              placeholder={
                activeTemplate === 'detailed' 
                  ? "Please provide detailed feedback about the course content, teaching methods, and overall experience..." 
                  : "Share your experience with this course..."
              }
              required={activeTemplate === 'detailed'}
            />
            {activeTemplate === 'detailed' && (
              <Form.Text className="text-muted">
                Minimum 50 characters required for detailed reviews
              </Form.Text>
            )}
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              label="Submit anonymously"
              checked={rating.anonymous}
              onChange={e => setRating({ ...rating, anonymous: e.target.checked })}
            />
          </Form.Group>
          
          <div className="d-flex gap-2">
            <Button
              variant="primary"
              onClick={handleSubmitRating}
              disabled={!rating.course_id || !rating.rating || (activeTemplate === 'detailed' && rating.comment.length < 50)}
              className="submit-btn"
            >
              <i className="fas fa-paper-plane me-2"></i>
              {activeTemplate === 'quick' ? 'Quick Submit' : 'Submit Rating'}
            </Button>
            
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>Save as draft</Tooltip>}
            >
              <Button variant="outline-secondary">
                <i className="fas fa-save me-2"></i>Save Draft
              </Button>
            </OverlayTrigger>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );

  // Enhanced Ratings List with Filtering
  const EnhancedRatingsList = () => (
    <div className="ratings-list">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="ratings-title">Your Previous Ratings ({ratings.length})</h5>
        <InputGroup style={{width: 'auto'}}>
          <Form.Control
            type="text"
            placeholder="Search ratings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="sm"
          />
        </InputGroup>
      </div>
      
      {ratings.length > 0 ? (
        ratings
          .filter(ratingItem => 
            ratingItem.comment?.toLowerCase().includes(search.toLowerCase()) ||
            courses.find(c => c.id === ratingItem.course_id)?.name.toLowerCase().includes(search.toLowerCase())
          )
          .map(ratingItem => {
            const course = courses.find(c => c.id === ratingItem.course_id);
            return (
              <Card key={ratingItem.id} className="mb-3 rating-card">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <Card.Title className="rating-course-title">
                      <i className="fas fa-graduation-cap me-2"></i>
                      {course ? course.name : `Course (ID: ${ratingItem.course_id})`}
                      {favorites.includes(ratingItem.course_id) && (
                        <i className="fas fa-star text-warning ms-2" title="Favorite"></i>
                      )}
                    </Card.Title>
                    <Dropdown>
                      <Dropdown.Toggle variant="outline-secondary" size="sm">
                        <i className="fas fa-ellipsis-v"></i>
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item>
                          <i className="fas fa-edit me-2"></i>Edit
                        </Dropdown.Item>
                        <Dropdown.Item>
                          <i className="fas fa-chart-bar me-2"></i>Analyze
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item className="text-danger">
                          <i className="fas fa-trash me-2"></i>Delete
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>
                  <div className="d-flex align-items-center mb-2">
                    <div className="rating-stars-static">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span 
                          key={star} 
                          className={`star ${ratingItem.rating >= star ? 'filled' : ''}`}
                          style={{ color: ratingItem.rating >= star ? '#ffc107' : '#e4e5e9' }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <Badge 
                      bg={
                        ratingItem.rating >= 4 ? 'success' :
                        ratingItem.rating >= 3 ? 'warning' : 'danger'
                      } 
                      className="ms-2 rating-badge"
                    >
                      {ratingItem.rating}/5
                    </Badge>
                  </div>
                  {ratingItem.comment && (
                    <Card.Text className="rating-comment">
                      <i className="fas fa-comment me-2"></i>{ratingItem.comment}
                    </Card.Text>
                  )}
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-muted rating-date">
                      <i className="fas fa-calendar me-2"></i>
                      Submitted: {new Date(ratingItem.created_at).toLocaleDateString()}
                    </small>
                    {ratingItem.anonymous && (
                      <Badge bg="secondary" className="anonymous-badge">
                        <i className="fas fa-user-secret me-1"></i>Anonymous
                      </Badge>
                    )}
                  </div>
                </Card.Body>
              </Card>
            );
          })
      ) : (
        <div className="no-data text-center">
          <i className="fas fa-star fa-3x mb-3" style={{color: '#e4e5e9'}}></i>
          <p className="text-muted">No ratings submitted yet.</p>
          <Button variant="outline-primary" onClick={handleQuickRating}>
            <i className="fas fa-bolt me-2"></i>Quick Rate a Course
          </Button>
        </div>
      )}
    </div>
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
                      notification.type === 'rating' ? 'fa-star' :
                      notification.type === 'success' ? 'fa-check-circle' :
                      notification.type === 'error' ? 'fa-exclamation-triangle' : 'fa-sticky-note'
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
          Rating System Settings
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
                <Form.Label>Default Rating Template</Form.Label>
                <Form.Select value={activeTemplate} onChange={(e) => setActiveTemplate(e.target.value)}>
                  {ratingTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Enable AI Insights"
                  defaultChecked
                />
              </Form.Group>
            </Form>
          </Tab>
          <Tab eventKey="notifications" title="Notifications">
            <Form>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Rating Submission Alerts"
                  defaultChecked
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Weekly Rating Summary"
                  defaultChecked
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Course Rating Updates"
                />
              </Form.Group>
            </Form>
          </Tab>
          <Tab eventKey="privacy" title="Privacy">
            <Form>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Default to Anonymous Ratings"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Show My Ratings to Others"
                  defaultChecked
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Allow Rating Analytics"
                  defaultChecked
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

  // Notes Modal
  const NotesModal = () => (
    <Modal show={showNotesModal} onHide={() => setShowNotesModal(false)} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-sticky-note me-2"></i>
          My Rating Notes
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {collaborationNotes.length === 0 ? (
          <div className="text-center py-4">
            <i className="fas fa-sticky-note fa-3x text-muted mb-3"></i>
            <p>No notes yet</p>
            <Button variant="outline-primary" onClick={handleAddNote}>
              <i className="fas fa-plus me-2"></i>Add First Note
            </Button>
          </div>
        ) : (
          <ListGroup variant="flush">
            {collaborationNotes.map(note => (
              <ListGroup.Item key={note.id} className="note-item">
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <p className="mb-1">{note.content}</p>
                    <small className="text-muted">
                      {new Date(note.timestamp).toLocaleString()}
                      {note.courseId && ` • Course: ${courses.find(c => c.id === note.courseId)?.name || 'Unknown'}`}
                    </small>
                  </div>
                  <Button variant="outline-danger" size="sm">
                    <i className="fas fa-trash"></i>
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-primary" onClick={handleAddNote}>
          <i className="fas fa-plus me-2"></i>Add New Note
        </Button>
        <Button variant="secondary" onClick={() => setShowNotesModal(false)}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );

  // Student View Component - Enhanced
  const StudentView = () => (
    <div>
      <Row>
        <Col md={6}>
          <EnhancedRatingForm />
        </Col>
        
        <Col md={6}>
          <EnhancedRatingsList />
        </Col>
      </Row>
    </div>
  );

  // Lecturer View Component (Enhanced)
  const LecturerView = () => (
    <div>
      <h4 className="section-title">Course Ratings & Feedback Analytics</h4>
      
      {/* Enhanced Analytics Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="stats-card">
            <Card.Body className="text-center">
              <Card.Title className="stats-number">4.2</Card.Title>
              <Card.Text className="stats-label">Average Rating</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stats-card">
            <Card.Body className="text-center">
              <Card.Title className="stats-number">156</Card.Title>
              <Card.Text className="stats-label">Total Ratings</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stats-card">
            <Card.Body className="text-center">
              <Card.Title className="stats-number">87%</Card.Title>
              <Card.Text className="stats-label">Positive Feedback</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stats-card">
            <Card.Body className="text-center">
              <Card.Title className="stats-number">+12%</Card.Title>
              <Card.Text className="stats-label">Improvement</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <AIInsightsComponent />
    </div>
  );

  // PRL View Component (Enhanced)
  const PRLView = () => (
    <div>
      <h4 className="section-title">Department Ratings Overview & Analytics</h4>
      
      <Row className="mb-4">
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <h3>4.1</h3>
              <p>Department Average</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <h3>24</h3>
              <p>Courses Rated</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <h3>92%</h3>
              <p>Satisfaction Rate</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <ReportsComponent />
    </div>
  );

  // Public Dashboard Component
  const PublicDashboard = () => (
    <div className="public-dashboard">
      <div className="university-hero">
        <Container>
          <div className="hero-content text-center">
            <h1 className="university-title">University Course Rating System</h1>
            <p className="university-subtitle">Share Your Experience and Discover Course Insights</p>
          </div>
        </Container>
      </div>
     
      <Container className="py-5">
        <div className="login-section text-center mb-5">
          <Card className="login-feature-card">
            <Card.Body className="p-5">
              <h2 className="portal-title">Enhanced Rating Portal</h2>
              <p className="portal-subtitle mb-4">
                insights, smart templates, and advanced analytics
              </p>
              <Button variant="primary" size="lg" onClick={() => setShowLoginModal(true)} className="login-btn-main">
                <i className="fas fa-sign-in-alt me-2"></i>Login / Register
              </Button>
            </Card.Body>
          </Card>
        </div>
       
        {/* Statistics Section */}
        <div className="portal-statistics mt-5">
          <Row className="g-4">
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.totalRatings}</div>
                <div className="stat-label">Total Ratings</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.averageRating}</div>
                <div className="stat-label">Average Rating</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.topCourses.length}</div>
                <div className="stat-label">Top Rated Courses</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item text-center">
                <div className="stat-number">{publicStats.recentReviews.length}</div>
                <div className="stat-label">Recent Reviews</div>
              </div>
            </Col>
          </Row>
        </div>

        {/* Feature Showcase */}
        <div className="feature-showcase mt-5">
          <h3 className="feature-title mb-4">Enhanced Rating Features</h3>
          
          <Row className="g-4">
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Powered Insights</Card.Title>
                  <Card.Text className="feature-card-text">
                    Get intelligent feedback analysis and rating pattern recognition with advanced AI algorithms.
                  </Card.Text>
                  <Badge bg="info" className="feature-badge">Smart Analytics</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Rating Templates</Card.Title>
                  <Card.Text className="feature-card-text">
                    Choose from multiple rating templates - quick, detailed, or anonymous - to match your preference.
                  </Card.Text>
                  <Badge bg="success" className="feature-badge">Flexible</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Sentiment Analysis</Card.Title>
                  <Card.Text className="feature-card-text">
                    Advanced sentiment analysis of ratings and comments to understand overall course satisfaction.
                  </Card.Text>
                  <Badge bg="warning" className="feature-badge">Deep Insights</Badge>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </div>
      </Container>
    </div>
  );

  // Authentication Modal
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
          <Modal.Title>{isRegister ? 'Create Account' : 'Login to Rating System'}</Modal.Title>
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

  return (
    <Container className={`rating-module py-4 ${darkMode ? 'dark-mode' : ''}`}>
      <AuthModal
        show={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
      
      {isAuthenticated && <EnhancedNavbar />}
      
      {isAuthenticated && (
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="dashboard-title">Enhanced Course Rating System</h2>
          <div className="d-flex align-items-center">
            <Badge bg="secondary" className="me-2">
              {userName} ({userRole})
            </Badge>
            <Button variant="outline-danger" onClick={handleLogout} className="logout-btn">
              <i className="fas fa-sign-out-alt me-2"></i>Logout
            </Button>
          </div>
        </div>
      )}
      
      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading ratings data...</p>
        </div>
      )}
      
      {!isAuthenticated ? (
        <PublicDashboard />
      ) : (
        <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4 custom-tabs">
          <Tab eventKey="submit" title={<span><i className="fas fa-star me-2"></i>Submit Rating</span>}>
            {userRole === 'Student' && <StudentView />}
            {userRole !== 'Student' && (
              <Alert variant="info">
                Only students can submit ratings. You are logged in as {userRole}.
              </Alert>
            )}
          </Tab>
          
          <Tab eventKey="analytics" title={<span><i className="fas fa-chart-bar me-2"></i>Analytics</span>}>
            {userRole === 'Lecturer' && <LecturerView />}
            {(userRole === 'PRL' || userRole === 'Program Leader') && <PRLView />}
            {userRole === 'Student' && (
              <Alert variant="info">
                Analytics view is available for Lecturers, Principal Lecturers, and Program Leaders.
              </Alert>
            )}
          </Tab>

          {/* New Tabs */}
          <Tab eventKey="insights" title={<span><i className="fas fa-brain me-2"></i>AI Insights</span>}>
            <AIInsightsComponent />
            {userRole === 'Student' && <EnhancedRatingsList />}
          </Tab>

          <Tab eventKey="reports" title={<span><i className="fas fa-chart-pie me-2"></i>Reports</span>}>
            <ReportsComponent />
          </Tab>
        </Tabs>
      )}

      {/* Enhanced Components */}
      <NotificationsPanel />
      <SettingsModal />
      <NotesModal />
    </Container>
  );
};

export default Rating;