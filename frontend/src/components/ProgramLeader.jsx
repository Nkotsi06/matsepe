import React, { useState, useEffect } from 'react';
import { 
  Container, Button, Form, Row, Col, Card, Modal, 
  Alert, Badge, Tab, Tabs, Table, Spinner, Dropdown,
  InputGroup, ListGroup
} from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';

// Authentication Modal with Role Selection
const AuthModal = ({ show, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    faculty_name: '',
    role: 'Program Leader'
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
        <Modal.Title>{isRegister ? 'Create Program Leader Account' : 'Login to Program Leader Portal'}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="auth-body">
        {authError && <Alert variant="danger" className="auth-alert">{authError}</Alert>}
        <div className="role-selection mb-4">
          <h6>Select Your Role:</h6>
          <div className="role-buttons">
            {['Program Leader', 'PRL', 'Lecturer', 'Student'].map(role => (
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

// --- PublicDataPreview component ---
const PublicDataPreview = ({ loading, stats }) => (
  <div className="portal-statistics mt-5">
    <Row className="g-4">
      <Col md={3}>
        <div className="stat-item text-center">
          <div className="stat-number">{loading ? '...' : (stats.totalCourses || 0)}</div>
          <div className="stat-label">Active Courses</div>
        </div>
      </Col>
      <Col md={3}>
        <div className="stat-item text-center">
          <div className="stat-number">{loading ? '...' : (stats.totalLecturers || 0)}</div>
          <div className="stat-label">Teaching Staff</div>
        </div>
      </Col>
      <Col md={3}>
        <div className="stat-item text-center">
          <div className="stat-number">{loading ? '...' : (stats.totalReports || 0)}</div>
          <div className="stat-label">Monthly Reports</div>
        </div>
      </Col>
      <Col md={3}>
        <div className="stat-item text-center">
          <div className="stat-number">{loading ? '...' : (stats.avgRating?.toFixed(1) || 0)}/5</div>
          <div className="stat-label">Average Rating</div>
        </div>
      </Col>
    </Row>
  </div>
);

// --- Ratings Tab Component ---
const RatingsTab = ({ ratings, courses, lecturers, onExport, search, setSearch, currentUser }) => {
  const [filter, setFilter] = useState('all');
  const [selectedRating, setSelectedRating] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Calculate statistics from actual data
  const averageRating = ratings.length > 0
    ? ratings.reduce((acc, rating) => acc + parseFloat(rating.rating), 0) / ratings.length
    : 0;

  const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
    star,
    count: ratings.filter(r => Math.floor(r.rating) === star).length,
    percentage: ratings.length > 0 ? (ratings.filter(r => Math.floor(r.rating) === star).length / ratings.length) * 100 : 0
  }));

  // Filter ratings
  const filteredRatings = ratings.filter(rating => {
    const matchesSearch = search === '' ||
      rating.comment?.toLowerCase().includes(search.toLowerCase()) ||
      courses.find(c => c.id === rating.course_id)?.name.toLowerCase().includes(search.toLowerCase()) ||
      lecturers.find(l => l.id === rating.lecturer_id)?.username.toLowerCase().includes(search.toLowerCase());

    const matchesFilter = filter === 'all' ||
      (filter === 'high' && rating.rating >= 4) ||
      (filter === 'medium' && rating.rating >= 3 && rating.rating < 4) ||
      (filter === 'low' && rating.rating < 3);

    return matchesSearch && matchesFilter;
  });

  const getCourseName = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    return course ? `${course.name} (${course.code})` : 'Course Not Found';
  };

  const getLecturerName = (lecturerId) => {
    const lecturer = lecturers.find(l => l.id === lecturerId);
    return lecturer ? lecturer.username : 'Lecturer Not Found';
  };

  const exportRatingsToExcel = () => {
    if (filteredRatings.length === 0) {
      alert('No ratings to export');
      return;
    }

    try {
      const excelData = filteredRatings.map(rating => {
        const course = courses.find(c => c.id === rating.course_id);
        const lecturer = lecturers.find(l => l.id === rating.lecturer_id);
        return {
          'Course': course ? `${course.name} (${course.code})` : 'N/A',
          'Lecturer': lecturer ? lecturer.username : 'N/A',
          'Rating': `${rating.rating}/5`,
          'Comments': rating.comment || 'No comments',
          'Student': rating.student_name || 'Anonymous',
          'Submitted Date': new Date(rating.created_at).toLocaleDateString(),
          'Rating Type': rating.rating_type || 'Course Rating'
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Program Ratings');
      XLSX.writeFile(wb, `program_ratings_${currentUser?.username}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      if (onExport) onExport();
    } catch (err) {
      console.error('Error exporting ratings:', err);
      alert('Error exporting ratings to Excel');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="section-title">Program Ratings & Feedback</h4>
          <p className="text-muted">
            Average Rating: <strong>{averageRating.toFixed(1)}/5</strong> from {ratings.length} ratings
          </p>
        </div>
        <Button variant="outline-primary" onClick={exportRatingsToExcel} disabled={ratings.length === 0} className="export-btn-tab">
          <i className="fas fa-download me-2"></i>Export to Excel
        </Button>
      </div>

      {/* Rating Statistics */}
      <Row className="mb-4">
        <Col md={8}>
          <Card className="form-card">
            <Card.Header className="form-card-header">
              <h5 className="mb-0"><i className="fas fa-chart-bar me-2"></i>Rating Distribution</h5>
            </Card.Header>
            <Card.Body>
              {ratingDistribution.map((dist, index) => (
                <div key={dist.star} className="d-flex align-items-center mb-3">
                  <div className="me-3" style={{ width: '100px' }}>
                    <div className="rating-stars-static">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className={`star ${dist.star >= star ? 'filled' : ''}`}>★</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="progress" style={{ height: '20px' }}>
                      <div 
                        className="progress-bar" 
                        style={{ 
                          width: `${dist.percentage}%`,
                          backgroundColor: dist.star >= 4 ? '#28a745' : dist.star >= 3 ? '#ffc107' : '#dc3545'
                        }}
                      >
                        {dist.count} ratings ({dist.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center stats-card">
            <Card.Header className="form-card-header">
              <h5 className="mb-0"><i className="fas fa-chart-pie me-2"></i>Quick Stats</h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <h3 className="stats-number">{ratings.length}</h3>
                <p className="stats-label">Total Ratings</p>
              </div>
              <div className="mb-3">
                <h3 className="stats-number text-success">{ratings.filter(r => r.rating >= 4).length}</h3>
                <p className="stats-label">Positive (4+ stars)</p>
              </div>
              <div>
                <h3 className="stats-number text-warning">{ratings.filter(r => r.rating >= 3 && r.rating < 4).length}</h3>
                <p className="stats-label">Neutral (3 stars)</p>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Search and Filters */}
      <Row className="mb-4">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>
              <i className="fas fa-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search ratings by course, lecturer, or comments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
            />
          </InputGroup>
        </Col>
        <Col md={3}>
          <Form.Select value={filter} onChange={(e) => setFilter(e.target.value)} className="form-select-custom">
            <option value="all">All Ratings</option>
            <option value="high">High (4-5 stars)</option>
            <option value="medium">Medium (3 stars)</option>
            <option value="low">Low (1-2 stars)</option>
          </Form.Select>
        </Col>
        <Col md={3}>
          <div className="text-end">
            <Badge bg="primary" className="rating-badge">
              {filteredRatings.length} of {ratings.length} ratings
            </Badge>
          </div>
        </Col>
      </Row>

      {/* Ratings List */}
      {filteredRatings.length > 0 ? (
        <Row>
          {filteredRatings.map(rating => (
            <Col md={6} lg={4} key={rating.id} className="mb-3">
              <Card 
                className={`rating-card h-100 ${rating.rating >= 4 ? 'border-success' : rating.rating >= 3 ? 'border-warning' : 'border-danger'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSelectedRating(rating);
                  setShowDetailModal(true);
                }}
              >
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <Card.Title className="rating-course-title">
                      <i className="fas fa-graduation-cap me-2"></i>
                      {getCourseName(rating.course_id)}
                    </Card.Title>
                    <Badge 
                      bg={rating.rating >= 4 ? 'success' : rating.rating >= 3 ? 'warning' : 'danger'}
                      className="rating-badge"
                    >
                      {rating.rating}/5
                    </Badge>
                  </div>
                  
                  <div className="mb-2">
                    <small className="text-muted">
                      <i className="fas fa-chalkboard-teacher me-1"></i>
                      {getLecturerName(rating.lecturer_id)}
                    </small>
                  </div>

                  <div className="rating-stars-static mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} className={`star ${rating.rating >= star ? 'filled' : ''}`}>★</span>
                    ))}
                  </div>

                  {rating.comment && (
                    <Card.Text className="rating-comment">
                      "{rating.comment.length > 100 ? rating.comment.substring(0, 100) + '...' : rating.comment}"
                    </Card.Text>
                  )}

                  <div className="d-flex justify-content-between align-items-center mt-auto">
                    <small className="text-muted">
                      <i className="fas fa-user me-1"></i>
                      {rating.student_name || 'Anonymous'}
                    </small>
                    <small className="text-muted">
                      <i className="fas fa-calendar me-1"></i>
                      {new Date(rating.created_at).toLocaleDateString()}
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card className="form-card">
          <Card.Body className="text-center py-5 no-data">
            <i className="fas fa-star fa-3x mb-3"></i>
            <h5>No ratings found</h5>
            <p className="text-muted">
              {ratings.length === 0 ? 'No ratings have been submitted yet.' : 'No ratings match your search criteria.'}
            </p>
          </Card.Body>
        </Card>
      )}

      {/* Rating Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg" centered className="auth-modal">
        <Modal.Header closeButton className="auth-header">
          <Modal.Title>Rating Details</Modal.Title>
        </Modal.Header>
        <Modal.Body className="auth-body">
          {selectedRating && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Course:</strong>
                  <p className="mt-1">{getCourseName(selectedRating.course_id)}</p>
                </Col>
                <Col md={6}>
                  <strong>Lecturer:</strong>
                  <p className="mt-1">{getLecturerName(selectedRating.lecturer_id)}</p>
                </Col>
              </Row>
              
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Rating:</strong>
                  <div className="d-flex align-items-center mt-1">
                    <div className="rating-stars-static me-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className={`star ${selectedRating.rating >= star ? 'filled' : ''}`}>★</span>
                      ))}
                    </div>
                    <Badge 
                      bg={selectedRating.rating >= 4 ? 'success' : selectedRating.rating >= 3 ? 'warning' : 'danger'}
                    >
                      {selectedRating.rating}/5
                    </Badge>
                  </div>
                </Col>
                <Col md={6}>
                  <strong>Submitted by:</strong>
                  <p className="mt-1">{selectedRating.student_name || 'Anonymous'}</p>
                </Col>
              </Row>

              {selectedRating.comment && (
                <div className="mb-3">
                  <strong>Comments:</strong>
                  <Card className="mt-2">
                    <Card.Body>
                      <p className="mb-0">{selectedRating.comment}</p>
                    </Card.Body>
                  </Card>
                </div>
              )}

              <div className="mb-3">
                <strong>Submission Date:</strong>
                <p className="mt-1">{new Date(selectedRating.created_at).toLocaleString()}</p>
              </div>

              {selectedRating.rating_type && (
                <div>
                  <strong>Rating Type:</strong>
                  <p className="mt-1">{selectedRating.rating_type}</p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="auth-footer">
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// --- FullDashboard component ---
const FullDashboard = ({
  handleLogout, alert, setAlert, stats, setShowCourseModal, setActiveTab, activeTab,
  loading, courses, lecturers, reports, getLecturerName, showCourseModal, handleAddCourse, newCourse, handleCourseChange,
  ratings, ratingSearch, setRatingSearch, currentUser, handleEditCourse, handleDeleteCourse, editingCourse, setEditingCourse,
  showEditModal, setShowEditModal, handleUpdateCourse
}) => (
  <Container className="program-leader-dashboard py-4">
    <div className="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2 className="dashboard-title">Program Leader Dashboard</h2>
        <p className="welcome-text">Welcome back, {currentUser?.username}</p>
      </div>
      <div className="d-flex align-items-center">
        <Badge bg="secondary" className="me-2">
          {currentUser?.username} ({currentUser?.role})
        </Badge>
        <Button variant="outline-danger" onClick={handleLogout} className="logout-btn">
          <i className="fas fa-sign-out-alt me-2"></i>Logout
        </Button>
      </div>
    </div>

    {alert.show && (
      <Alert variant={alert.type} onClose={() => setAlert({ show: false })} dismissible className="alert-custom">
        {alert.message}
      </Alert>
    )}

    {/* Statistics Cards */}
    <Row className="mb-4">
      <Col md={3}>
        <Card className="stats-card text-center">
          <Card.Body>
            <Card.Title className="stats-number">{stats.totalCourses || 0}</Card.Title>
            <Card.Text className="stats-label">Active Courses</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="stats-card text-center">
          <Card.Body>
            <Card.Title className="stats-number">{stats.totalLecturers || 0}</Card.Title>
            <Card.Text className="stats-label">Teaching Staff</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="stats-card text-center">
          <Card.Body>
            <Card.Title className="stats-number">{stats.totalReports || 0}</Card.Title>
            <Card.Text className="stats-label">Reports</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="stats-card text-center">
          <Card.Body>
            <Card.Title className="stats-number">{stats.avgRating?.toFixed(1) || 0}/5</Card.Title>
            <Card.Text className="stats-label">Avg. Rating</Card.Text>
          </Card.Body>
        </Card>
      </Col>
    </Row>

    <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4 custom-tabs">
      <Tab eventKey="dashboard" title={<span><i className="fas fa-tachometer-alt me-2"></i>Dashboard</span>}>
        <Card className="form-card">
          <Card.Header className="form-card-header">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0"><i className="fas fa-book me-2"></i>Course Management</h5>
              <Button variant="primary" onClick={() => setShowCourseModal(true)} className="submit-btn">
                <i className="fas fa-plus me-2"></i>Add Course
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            {courses.length > 0 ? (
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Course Name</th>
                    <th>Course Code</th>
                    <th>Lecturer</th>
                    <th>Description</th>
                    <th>Credits</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(course => (
                    <tr key={course.id}>
                      <td><strong>{course.name}</strong></td>
                      <td><Badge bg="info">{course.code}</Badge></td>
                      <td>{getLecturerName(course.lecturer_id)}</td>
                      <td>{course.description || 'No description'}</td>
                      <td>{course.credits || 3}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button 
                            variant="outline-warning" 
                            size="sm" 
                            onClick={() => handleEditCourse(course)}
                            title="Edit Course"
                          >
                            <i className="fas fa-edit"></i>
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            onClick={() => handleDeleteCourse(course.id)}
                            title="Delete Course"
                          >
                            <i className="fas fa-trash"></i>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-center py-4 no-data">
                <i className="fas fa-book fa-3x mb-3"></i>
                <h5>No Courses Available</h5>
                <p className="text-muted">Get started by adding your first course.</p>
                <Button variant="primary" onClick={() => setShowCourseModal(true)} className="submit-btn">
                  <i className="fas fa-plus me-2"></i>Add First Course
                </Button>
              </div>
            )}
          </Card.Body>
        </Card>
      </Tab>

      <Tab eventKey="lecturers" title={<span><i className="fas fa-chalkboard-teacher me-2"></i>Lecturers</span>}>
        <Card className="form-card">
          <Card.Header className="form-card-header">
            <h5 className="mb-0"><i className="fas fa-users me-2"></i>Teaching Staff</h5>
          </Card.Header>
          <Card.Body>
            {lecturers.length > 0 ? (
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Faculty/Department</th>
                    <th>Courses Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturers.map(lecturer => {
                    const assignedCourses = courses.filter(c => c.lecturer_id === lecturer.id);
                    return (
                      <tr key={lecturer.id}>
                        <td><strong>{lecturer.username}</strong></td>
                        <td>{lecturer.email}</td>
                        <td>{lecturer.faculty_name || 'Not specified'}</td>
                        <td>
                          <Badge bg={assignedCourses.length > 0 ? 'success' : 'secondary'}>
                            {assignedCourses.length} courses
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <div className="text-center py-4 no-data">
                <i className="fas fa-users fa-3x mb-3"></i>
                <h5>No Lecturers Available</h5>
                <p className="text-muted">No lecturers are currently registered in the system.</p>
              </div>
            )}
          </Card.Body>
        </Card>
      </Tab>

      <Tab eventKey="reports" title={<span><i className="fas fa-file-alt me-2"></i>Reports</span>}>
        <Card className="form-card">
          <Card.Header className="form-card-header">
            <h5 className="mb-0"><i className="fas fa-chart-line me-2"></i>Academic Reports</h5>
          </Card.Header>
          <Card.Body>
            {reports.length > 0 ? (
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Course</th>
                    <th>Lecturer</th>
                    <th>Week</th>
                    <th>Topic</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(report => (
                    <tr key={report.id}>
                      <td>#{report.id}</td>
                      <td>{courses.find(c => c.id === report.course_id)?.name || 'N/A'}</td>
                      <td>{getLecturerName(report.lecturer_id)}</td>
                      <td>Week {report.week}</td>
                      <td>{report.topic_taught || 'No topic specified'}</td>
                      <td>{new Date(report.date_lecture).toLocaleDateString()}</td>
                      <td>
                        <Badge bg={
                          report.status === 'approved' ? 'success' : 
                          report.status === 'pending' ? 'warning' : 'secondary'
                        }>
                          {report.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-center py-4 no-data">
                <i className="fas fa-file-alt fa-3x mb-3"></i>
                <h5>No Reports Available</h5>
                <p className="text-muted">No academic reports have been submitted yet.</p>
              </div>
            )}
          </Card.Body>
        </Card>
      </Tab>

      <Tab eventKey="ratings" title={
        <span>
          <i className="fas fa-star me-2"></i>
          Ratings
          {ratings.length > 0 && (
            <Badge bg="primary" className="ms-2">{ratings.length}</Badge>
          )}
        </span>
      }>
        <RatingsTab
          ratings={ratings}
          courses={courses}
          lecturers={lecturers}
          search={ratingSearch}
          setSearch={setRatingSearch}
          currentUser={currentUser}
        />
      </Tab>
    </Tabs>

    {/* Add Course Modal */}
    <Modal show={showCourseModal} onHide={() => setShowCourseModal(false)} centered className="auth-modal">
      <Modal.Header closeButton className="auth-header">
        <Modal.Title><i className="fas fa-plus-circle me-2"></i>Add New Course</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleAddCourse}>
        <Modal.Body className="auth-body">
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Course Name</Form.Label>
            <Form.Control 
              name="name" 
              value={newCourse.name} 
              onChange={handleCourseChange} 
              className="auth-input"
              placeholder="Enter course name"
              required 
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Course Code</Form.Label>
            <Form.Control 
              name="code" 
              value={newCourse.code} 
              onChange={handleCourseChange} 
              className="auth-input"
              placeholder="Enter course code"
              required 
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Lecturer</Form.Label>
            <Form.Select 
              name="lecturer_id" 
              value={newCourse.lecturer_id} 
              onChange={handleCourseChange} 
              className="auth-input"
              required
            >
              <option value="">Select Lecturer</option>
              {lecturers.map(l => (
                <option key={l.id} value={l.id}>{l.username}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Description</Form.Label>
            <Form.Control 
              as="textarea"
              rows={3}
              name="description" 
              value={newCourse.description} 
              onChange={handleCourseChange} 
              className="auth-input"
              placeholder="Enter course description"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Credits</Form.Label>
            <Form.Control 
              type="number" 
              name="credits" 
              value={newCourse.credits} 
              onChange={handleCourseChange} 
              className="auth-input"
              min={1} 
              max={6}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="auth-footer">
          <Button variant="secondary" onClick={() => setShowCourseModal(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="auth-submit">
            {loading ? <Spinner size="sm" /> : 'Add Course'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>

    {/* Edit Course Modal */}
    <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered className="auth-modal">
      <Modal.Header closeButton className="auth-header">
        <Modal.Title><i className="fas fa-edit me-2"></i>Edit Course</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleUpdateCourse}>
        <Modal.Body className="auth-body">
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Course Name</Form.Label>
            <Form.Control 
              name="name" 
              value={editingCourse?.name || ''} 
              onChange={(e) => setEditingCourse({...editingCourse, name: e.target.value})} 
              className="auth-input"
              placeholder="Enter course name"
              required 
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Course Code</Form.Label>
            <Form.Control 
              name="code" 
              value={editingCourse?.code || ''} 
              onChange={(e) => setEditingCourse({...editingCourse, code: e.target.value})} 
              className="auth-input"
              placeholder="Enter course code"
              required 
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Lecturer</Form.Label>
            <Form.Select 
              name="lecturer_id" 
              value={editingCourse?.lecturer_id || ''} 
              onChange={(e) => setEditingCourse({...editingCourse, lecturer_id: e.target.value})} 
              className="auth-input"
              required
            >
              <option value="">Select Lecturer</option>
              {lecturers.map(l => (
                <option key={l.id} value={l.id}>{l.username}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Description</Form.Label>
            <Form.Control 
              as="textarea"
              rows={3}
              name="description" 
              value={editingCourse?.description || ''} 
              onChange={(e) => setEditingCourse({...editingCourse, description: e.target.value})} 
              className="auth-input"
              placeholder="Enter course description"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="auth-label">Credits</Form.Label>
            <Form.Control 
              type="number" 
              name="credits" 
              value={editingCourse?.credits || 3} 
              onChange={(e) => setEditingCourse({...editingCourse, credits: parseInt(e.target.value)})} 
              className="auth-input"
              min={1} 
              max={6}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="auth-footer">
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="auth-submit">
            {loading ? <Spinner size="sm" /> : 'Update Course'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  </Container>
);

// --- PublicDashboard ---
const PublicDashboard = ({ setShowLoginModal }) => {
  const [publicStats, setPublicStats] = useState({
    totalCourses: 0,
    totalLecturers: 0,
    totalReports: 0,
    avgRating: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicStats();
  }, []);

  const fetchPublicStats = async () => {
    try {
      // Fetch public statistics from the backend
      const response = await axios.get('https://matsepe.onrender.com/api/public/stats');
      setPublicStats(response.data);
    } catch (error) {
      console.error('Error fetching public stats:', error);
      // If API fails, set all to 0
      setPublicStats({
        totalCourses: 0,
        totalLecturers: 0,
        totalReports: 0,
        avgRating: 0
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-dashboard">
      <div className="university-hero">
        <Container>
          <div className="hero-content text-center">
            <h1 className="university-title">University Program Leadership</h1>
            <p className="university-subtitle">Strategic Academic Management and Program Oversight</p>
          </div>
        </Container>
      </div>
      
      <Container className="py-5">
        <div className="login-section text-center mb-5">
          <Card className="login-feature-card">
            <Card.Body className="p-5">
              <h2 className="portal-title">Program Leader Portal</h2>
              <p className="portal-subtitle mb-4">
                Comprehensive academic program management, course oversight, and performance analytics
              </p>
              <Button 
                variant="primary" 
                size="lg" 
                onClick={() => setShowLoginModal(true)} 
                className="login-btn-main"
              >
                <i className="fas fa-sign-in-alt me-2"></i>Login to Program Dashboard
              </Button>
            </Card.Body>
          </Card>
        </div>
        
        {/* Feature Showcase */}
        <div className="feature-showcase mt-5">
          <h3 className="feature-title mb-4">Program Leadership Features</h3>
          
          <Row className="g-4">
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Course Management</Card.Title>
                  <Card.Text className="feature-card-text">
                    Oversee all courses in your program, assign lecturers, monitor curriculum delivery, 
                    and ensure academic standards are maintained across all offerings.
                  </Card.Text>
                  <Badge bg="info" className="feature-badge">Curriculum Oversight</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Faculty Management</Card.Title>
                  <Card.Text className="feature-card-text">
                    Manage teaching staff assignments, monitor lecturer performance, and ensure 
                    appropriate workload distribution across your academic team.
                  </Card.Text>
                  <Badge bg="success" className="feature-badge">Staff Coordination</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Performance Analytics</Card.Title>
                  <Card.Text className="feature-card-text">
                    Access comprehensive analytics on course ratings, student feedback, and academic 
                    performance metrics to drive program improvements.
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
                  <Card.Title className="feature-card-title">Quality Assurance</Card.Title>
                  <Card.Text className="feature-card-text">
                    Monitor report submissions, track attendance trends, and ensure compliance with 
                    academic standards and regulatory requirements for your program.
                  </Card.Text>
                  <Badge bg="primary" className="feature-badge">Quality Control</Badge>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="feature-card h-100">
                <Card.Body className="text-center p-4">
                  <Card.Title className="feature-card-title">Strategic Planning</Card.Title>
                  <Card.Text className="feature-card-text">
                    Utilize comprehensive data and analytics to make informed decisions about program 
                    development, resource allocation, and strategic academic initiatives.
                  </Card.Text>
                  <Badge bg="dark" className="feature-badge">Decision Support</Badge>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </div>
        
        {/* Statistics Section */}
        <PublicDataPreview 
          loading={loading}
          stats={publicStats}
        />
      </Container>
    </div>
  );
};

// --- Main ProgramLeader Component ---
const ProgramLeader = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [courses, setCourses] = useState([]);
  const [reports, setReports] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [stats, setStats] = useState({ 
    totalCourses: 0, 
    totalLecturers: 0, 
    totalReports: 0,
    avgAttendance: 0,
    avgRating: 0
  });
  const [newCourse, setNewCourse] = useState({ 
    name: '', 
    code: '', 
    lecturer_id: '', 
    description: '',
    credits: 3
  });
  const [editingCourse, setEditingCourse] = useState(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [ratingSearch, setRatingSearch] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const API_URL = 'https://matsepe.onrender.com/api';

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  const checkAuthentication = () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');
    const userName = localStorage.getItem('user_name');
    const userId = localStorage.getItem('user_id');

    if (token && userRole === 'Program Leader' && userName && userId) {
      setIsAuthenticated(true);
      setCurrentUser({
        id: userId,
        name: userName,
        role: userRole,
        username: localStorage.getItem('user_username') || '',
      });
    }
    setIsLoading(false);
  };

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
    fetchDashboardData();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_username');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCourses([]);
    setLecturers([]);
    setRatings([]);
    setReports([]);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [coursesRes, usersRes, reportsRes, ratingsRes] = await Promise.all([
        axios.get(`${API_URL}/courses`, config),
        axios.get(`${API_URL}/users`, config),
        axios.get(`${API_URL}/reports`, config),
        axios.get(`${API_URL}/ratings`, config)
      ]);
      
      setCourses(coursesRes.data || []);
      setLecturers((usersRes.data || []).filter(u => u.role === 'Lecturer'));
      setReports(reportsRes.data || []);
      setRatings(ratingsRes.data || []);
      
      // Calculate stats from actual data
      setStats({
        totalCourses: coursesRes.data?.length || 0,
        totalLecturers: (usersRes.data || []).filter(u => u.role === 'Lecturer').length,
        totalReports: reportsRes.data?.length || 0,
        avgRating: ratingsRes.data?.length > 0 
          ? ratingsRes.data.reduce((acc, r) => acc + parseFloat(r.rating), 0) / ratingsRes.data.length 
          : 0
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const handleCourseChange = (e) => {
    const { name, value } = e.target;
    setNewCourse(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/courses`, newCourse, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('Course added successfully!', 'success');
      setNewCourse({ name: '', code: '', lecturer_id: '', description: '', credits: 3 });
      setShowCourseModal(false);
      fetchDashboardData();
      setLoading(false);
    } catch (error) {
      showAlert('Failed to add course', 'danger');
      setLoading(false);
    }
  };

  const handleEditCourse = (course) => {
    setEditingCourse(course);
    setShowEditModal(true);
  };

  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/courses/${editingCourse.id}`, editingCourse, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('Course updated successfully!', 'success');
      setShowEditModal(false);
      setEditingCourse(null);
      fetchDashboardData();
      setLoading(false);
    } catch (error) {
      showAlert('Failed to update course', 'danger');
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showAlert('Course deleted successfully!', 'success');
        fetchDashboardData();
        setLoading(false);
      } catch (error) {
        showAlert('Failed to delete course', 'danger');
        setLoading(false);
      }
    }
  };

  const showAlert = (message, type) => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: '' }), 5000);
  };

  const getLecturerName = (lecturerId) => {
    const lecturer = lecturers.find(l => l.id === lecturerId);
    return lecturer ? lecturer.username : 'Not assigned';
  };

  if (isLoading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <Spinner animation="border" variant="primary" />
        <span className="ms-2">Loading Program Leader Portal...</span>
      </Container>
    );
  }

  return (
    <div className="program-leader-wrapper">
      {!isAuthenticated ? (
        <PublicDashboard setShowLoginModal={setShowLoginModal} />
      ) : (
        <FullDashboard
          handleLogout={handleLogout}
          alert={alert}
          setAlert={setAlert}
          stats={stats}
          setShowCourseModal={setShowCourseModal}
          setActiveTab={setActiveTab}
          activeTab={activeTab}
          loading={loading}
          courses={courses}
          lecturers={lecturers}
          reports={reports}
          getLecturerName={getLecturerName}
          showCourseModal={showCourseModal}
          handleAddCourse={handleAddCourse}
          newCourse={newCourse}
          handleCourseChange={handleCourseChange}
          ratings={ratings}
          ratingSearch={ratingSearch}
          setRatingSearch={setRatingSearch}
          currentUser={currentUser}
          handleEditCourse={handleEditCourse}
          handleDeleteCourse={handleDeleteCourse}
          editingCourse={editingCourse}
          setEditingCourse={setEditingCourse}
          showEditModal={showEditModal}
          setShowEditModal={setShowEditModal}
          handleUpdateCourse={handleUpdateCourse}
        />
      )}
      
      {/* Auth Modal */}
      <AuthModal
        show={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default ProgramLeader;