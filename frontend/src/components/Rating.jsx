import React, { useState, useEffect } from 'react';
import { Container, Button, Form, ListGroup, Card, Row, Col, Badge, Tabs, Tab, Modal, Alert, InputGroup, Table, Spinner, Dropdown } from 'react-bootstrap';
import axios from 'axios';

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
    anonymous: false
  });

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
      const res = await axios.get('http://localhost:5000/api/ratings/public');
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
      const coursesRes = await axios.get('http://localhost:5000/api/ratings/courses/list', { headers });
      setCourses(coursesRes.data || []);
      
      // Fetch user's course ratings
      const ratingsRes = await axios.get('http://localhost:5000/api/ratings/course', { headers });
      setRatings(ratingsRes.data || []);

      // Note: The following endpoints might not exist in your backend yet
      // You can remove them or implement them in your backend
      try {
        const [lecturersRes, aggregatedRes, trendsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/lecturers', { headers }).catch(() => ({ data: [] })),
          axios.get('http://localhost:5000/api/ratings/aggregated', { headers }).catch(() => ({ data: {} })),
          axios.get('http://localhost:5000/api/ratings/trends', { headers }).catch(() => ({ data: [] }))
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

      await axios.post('http://localhost:5000/api/ratings/course', ratingData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Rating submitted successfully!');
      
      // Reset form
      setRating({
        course_id: '',
        rating: 0,
        comment: '',
        anonymous: false
      });
      
      // Refresh data to show the new rating
      fetchPrivateData();
    } catch (err) {
      console.error('Rating submission error:', err);
      alert('Error: ' + (err.response?.data?.error || 'Submission failed'));
    }
  };

  // Star rating component
  const StarRating = ({ value, onChange }) => (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`star ${star <= value ? 'filled' : ''}`}
          onClick={() => onChange({ ...rating, rating: star })}
          style={{ cursor: 'pointer', fontSize: '2rem', margin: '0 2px', color: star <= value ? '#ffc107' : '#e4e5e9' }}
        >
          ★
        </span>
      ))}
      <span className="rating-value ms-2" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
        {value}/5
      </span>
    </div>
  );

  // Student View Component
  const StudentView = () => (
    <div>
      <h4 className="section-title">Submit Course Rating</h4>
      <Row>
        <Col md={6}>
          <Card className="form-card">
            <Card.Header className="form-card-header">
              <h5><i className="fas fa-star me-2"></i>Rate a Course</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Select Course</Form.Label>
                  <Form.Select
                    value={rating.course_id}
                    onChange={e => setRating({ ...rating, course_id: e.target.value })}
                    className="form-select-custom"
                  >
                    <option value="">Choose a course...</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name} ({course.code})
                      </option>
                    ))}
                  </Form.Select>
                  {courses.length === 0 && (
                    <Form.Text className="text-muted">
                      No courses available. Make sure you're enrolled in courses.
                    </Form.Text>
                  )}
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Rating</Form.Label>
                  <StarRating value={rating.rating} onChange={setRating} />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label className="form-label">Comments (Optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={rating.comment}
                    onChange={e => setRating({ ...rating, comment: e.target.value })}
                    className="form-textarea"
                    placeholder="Share your experience with this course..."
                  />
                </Form.Group>
                
                <Button
                  variant="primary"
                  onClick={handleSubmitRating}
                  disabled={!rating.course_id || !rating.rating}
                  className="submit-btn"
                >
                  <i className="fas fa-paper-plane me-2"></i>Submit Rating
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <div className="ratings-list">
            <h5 className="ratings-title">Your Previous Ratings ({ratings.length})</h5>
            {ratings.length > 0 ? (
              ratings.map(ratingItem => {
                const course = courses.find(c => c.id === ratingItem.course_id);
                return (
                  <Card key={ratingItem.id} className="mb-3 rating-card">
                    <Card.Body>
                      <Card.Title className="rating-course-title">
                        <i className="fas fa-graduation-cap me-2"></i>
                        {course ? course.name : `Course (ID: ${ratingItem.course_id})`}
                      </Card.Title>
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
                        <Badge bg="info" className="ms-2 rating-badge">{ratingItem.rating}/5</Badge>
                      </div>
                      {ratingItem.comment && (
                        <Card.Text className="rating-comment">
                          <i className="fas fa-comment me-2"></i>{ratingItem.comment}
                        </Card.Text>
                      )}
                      <small className="text-muted rating-date">
                        <i className="fas fa-calendar me-2"></i>
                        Submitted: {new Date(ratingItem.created_at).toLocaleDateString()}
                      </small>
                    </Card.Body>
                  </Card>
                );
              })
            ) : (
              <div className="no-data text-center">
                <i className="fas fa-star fa-3x mb-3" style={{color: '#e4e5e9'}}></i>
                <p className="text-muted">No ratings submitted yet.</p>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );

  // Lecturer View Component (Simplified)
  const LecturerView = () => (
    <div>
      <h4 className="section-title">Course Ratings & Feedback</h4>
      <Alert variant="info">
        <i className="fas fa-info-circle me-2"></i>
        Lecturer analytics view - data loading depends on backend implementation
      </Alert>
    </div>
  );

  // PRL View Component (Simplified)
  const PRLView = () => (
    <div>
      <h4 className="section-title">Department Ratings Overview</h4>
      <Alert variant="info">
        <i className="fas fa-info-circle me-2"></i>
        PRL analytics view - data loading depends on backend implementation
      </Alert>
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
              <h2 className="portal-title">Rating Portal</h2>
              <p className="portal-subtitle mb-4">Rate courses, provide feedback, and help improve teaching quality</p>
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
    <Container className="rating-module py-4">
      <AuthModal
        show={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
      
      {isAuthenticated && (
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="dashboard-title">Course Rating System</h2>
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
        </Tabs>
      )}
    </Container>
  );
};

export default Rating;