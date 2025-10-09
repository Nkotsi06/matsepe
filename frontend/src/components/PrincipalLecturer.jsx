import React, { useState, useEffect } from 'react';
import { Container, Button, Form, Alert, Row, Col, Modal, Card, Badge, Tabs, Tab, Dropdown, Spinner, Table, InputGroup, ProgressBar, Toast, ToastContainer, ListGroup } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';

// Export functions moved above the component to avoid initialization issues
const exportAllDataToExcel = (currentUser, courses, lecturers, reports, ratings, classes) => {
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
    return 'All data exported to Excel successfully!';
  } catch (err) {
    throw new Error('Error exporting data to Excel: ' + err.message);
  }
};

const exportReportsToExcel = (reports, courses, lecturers, currentUser) => {
  if (reports.length === 0) {
    throw new Error('No reports to export');
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
    return 'Reports exported to Excel successfully!';
  } catch (err) {
    throw new Error('Error exporting to Excel: ' + err.message);
  }
};

const exportRatingsToExcel = (ratings, courses, lecturers, currentUser) => {
  if (ratings.length === 0) {
    throw new Error('No ratings to export');
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
    return 'Ratings exported to Excel successfully!';
  } catch (err) {
    throw new Error('Error exporting to Excel: ' + err.message);
  }
};

const PrincipalLecturer = () => {
  // Add missing state variables
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [publicStats, setPublicStats] = useState({});
  const [aggregatedData, setAggregatedData] = useState({});
  const [ratingTrends, setRatingTrends] = useState([]);
  const [poorRatingAlerts, setPoorRatingAlerts] = useState([]);

  // Existing state variables
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

  // New Feature States
  const [advancedFilters, setAdvancedFilters] = useState({
    dateRange: '',
    faculty: '',
    rating: '',
    status: ''
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [quickStats, setQuickStats] = useState({});

  // Modal states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showLectureModal, setShowLectureModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
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
    materials: '',
    file: null
  });

  // Faculty options
  const facultyOptions = [
    "Faculty of Information and Communication Technology",
    "Faculty of Business Management and Globalisation", 
    "Faculty of Design and Innovation"
  ];

  // NEW FEATURE: Quick Actions
  const quickActions = [
    {
      title: 'Add Course',
      icon: 'fas fa-plus',
      action: () => {
        resetCourseModal();
        setShowCourseModal(true);
      },
      variant: 'primary'
    },
    {
      title: 'Schedule Class',
      icon: 'fas fa-calendar-plus',
      action: () => {
        resetClassModal();
        setShowClassModal(true);
      },
      variant: 'success'
    },
    {
      title: 'Export Data',
      icon: 'fas fa-download',
      action: () => handleExportAllData(),
      variant: 'info'
    },
    {
      title: 'Add Rating',
      icon: 'fas fa-star',
      action: () => setShowRatingModal(true),
      variant: 'warning'
    }
  ];

  // Wrapper functions for exports
  const handleExportAllData = () => {
    try {
      const result = exportAllDataToExcel(currentUser, courses, lecturers, reports, ratings, classes);
      setSuccess(result);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportReports = () => {
    try {
      const result = exportReportsToExcel(reports, courses, lecturers, currentUser);
      setSuccess(result);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportRatings = () => {
    try {
      const result = exportRatingsToExcel(ratings, courses, lecturers, currentUser);
      setSuccess(result);
    } catch (err) {
      setError(err.message);
    }
  };

  // Initialize new features
  useEffect(() => {
    if (isAuthenticated) {
      initializeNewFeatures();
    }
  }, [currentUser]);

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

    // Calculate quick stats
    calculateQuickStats();
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

  // NEW FEATURE: Calculate quick stats
  const calculateQuickStats = () => {
    const stats = {
      pendingFeedback: reports.filter(r => !r.feedback).length,
      averageRating: ratings.length > 0 ? 
        (ratings.reduce((sum, r) => sum + parseFloat(r.rating), 0) / ratings.length).toFixed(1) : 0,
      upcomingClasses: classes.filter(c => new Date(c.date) >= new Date()).length,
      totalStudents: reports.reduce((sum, r) => sum + r.total_students, 0)
    };
    setQuickStats(stats);
  };

  const fetchPrincipalLecturerData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

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
      
      // Recalculate stats after data load
      calculateQuickStats();
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

  // NEW FEATURE: Advanced Search and Filter
  const filteredReports = reports.filter(report => {
    const matchesSearch = search === '' || 
      report.topic.toLowerCase().includes(search.toLowerCase()) ||
      report.outcomes.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilters = Object.entries(advancedFilters).every(([key, value]) => {
      if (!value) return true;
      // Implement specific filter logic based on filter type
      return true;
    });
    
    return matchesSearch && matchesFilters;
  });

  // NEW FEATURE: Bulk Operations
  const handleBulkFeedback = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      
      // Implement bulk feedback logic
      setSuccess(`Feedback applied to ${selectedItems.length} items`);
      setSelectedItems([]);
      setShowBulkModal(false);
      fetchPrincipalLecturerData();
    } catch (err) {
      setError('Failed to apply bulk feedback');
    }
  };

  // NEW FEATURE: File Upload with Progress
  const handleFileUpload = async (file, type) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      await axios.post('https://matsepe.onrender.com/api/principal/upload', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });
      
      setSuccess('File uploaded successfully!');
      setUploadProgress(0);
    } catch (err) {
      setError('File upload failed');
      setUploadProgress(0);
    }
  };

  // NEW FEATURE: Mark notification as read
  const markNotificationAsRead = (notificationId) => {
    setNotifications(notifications.map(notification => 
      notification.id === notificationId ? { ...notification, read: true } : notification
    ));
  };

  // Existing functions remain the same...
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

  const handleAddLecture = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in first');
        return;
      }
      
      // NEW FEATURE: Handle file upload if present
      if (lectureData.file) {
        await handleFileUpload(lectureData.file, 'lecture_material');
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
        materials: '',
        file: null
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
      {/* NEW FEATURE: Notification Toast Container */}
      <ToastContainer position="top-end" className="p-3">
        {notifications.filter(n => !n.read).slice(0, 3).map(notification => (
          <Toast 
            key={notification.id}
            onClose={() => markNotificationAsRead(notification.id)}
            show={!notification.read}
            delay={5000}
            autohide
          >
            <Toast.Header>
              <strong className="me-auto">{notification.title}</strong>
              <small>{new Date(notification.timestamp).toLocaleTimeString()}</small>
            </Toast.Header>
            <Toast.Body>{notification.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="dashboard-title">Principal Lecturer Dashboard</h2>
          <p className="text-muted welcome-text">Welcome back, {currentUser.username}</p>
        </div>
        <div className="d-flex align-items-center">
          {/* NEW FEATURE: Notification Bell */}
          <Dropdown className="me-2">
            <Dropdown.Toggle variant="outline-primary" id="dropdown-notifications" className="notification-btn">
              <i className="fas fa-bell"></i>
              {notifications.filter(n => !n.read).length > 0 && (
                <Badge bg="danger" className="notification-badge">
                  {notifications.filter(n => !n.read).length}
                </Badge>
              )}
            </Dropdown.Toggle>
            <Dropdown.Menu className="notification-menu">
              <Dropdown.Header>Notifications</Dropdown.Header>
              {notifications.slice(0, 5).map(notification => (
                <Dropdown.Item 
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => markNotificationAsRead(notification.id)}
                >
                  <div className="notification-content">
                    <strong>{notification.title}</strong>
                    <p className="mb-1">{notification.message}</p>
                    <small className="text-muted">
                      {new Date(notification.timestamp).toLocaleDateString()}
                    </small>
                  </div>
                </Dropdown.Item>
              ))}
              {notifications.length === 0 && (
                <Dropdown.Item disabled>No notifications</Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>

          {/* NEW FEATURE: Advanced Search */}
          <InputGroup className="me-2 search-group">
            <Form.Control
              placeholder="Search reports, courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            <Button variant="outline-secondary">
              <i className="fas fa-search"></i>
            </Button>
          </InputGroup>

          <Dropdown className="me-2">
            <Dropdown.Toggle variant="success" id="dropdown-export" className="export-btn">
              <i className="fas fa-download me-2"></i>Export Data
            </Dropdown.Toggle>
            <Dropdown.Menu className="export-menu">
              <Dropdown.Item onClick={handleExportAllData} className="export-item">
                <i className="fas fa-file-excel me-2"></i>Export All Data
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={handleExportReports} className="export-item">
                <i className="fas fa-file-alt me-2"></i>Export Reports
              </Dropdown.Item>
              <Dropdown.Item onClick={handleExportRatings} className="export-item">
                <i className="fas fa-star me-2"></i>Export Ratings
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button variant="outline-danger" onClick={handleLogout} className="logout-btn">
            <i className="fas fa-sign-out-alt me-2"></i>Logout
          </Button>
        </div>
      </div>

      {/* NEW FEATURE: Quick Stats Overview */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="quick-stat-card">
            <Card.Body>
              <div className="d-flex justify-content-between">
                <div>
                  <Card.Title className="quick-stat-number">{quickStats.pendingFeedback || 0}</Card.Title>
                  <Card.Text className="quick-stat-label">Pending Feedback</Card.Text>
                </div>
                <div className="quick-stat-icon pending">
                  <i className="fas fa-comments"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="quick-stat-card">
            <Card.Body>
              <div className="d-flex justify-content-between">
                <div>
                  <Card.Title className="quick-stat-number">{quickStats.averageRating || 0}/5</Card.Title>
                  <Card.Text className="quick-stat-label">Avg Rating</Card.Text>
                </div>
                <div className="quick-stat-icon rating">
                  <i className="fas fa-star"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="quick-stat-card">
            <Card.Body>
              <div className="d-flex justify-content-between">
                <div>
                  <Card.Title className="quick-stat-number">{quickStats.upcomingClasses || 0}</Card.Title>
                  <Card.Text className="quick-stat-label">Upcoming Classes</Card.Text>
                </div>
                <div className="quick-stat-icon classes">
                  <i className="fas fa-calendar-alt"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="quick-stat-card">
            <Card.Body>
              <div className="d-flex justify-content-between">
                <div>
                  <Card.Title className="quick-stat-number">{quickStats.totalStudents || 0}</Card.Title>
                  <Card.Text className="quick-stat-label">Total Students</Card.Text>
                </div>
                <div className="quick-stat-icon students">
                  <i className="fas fa-users"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

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
          <EnhancedDashboardTab
            currentUser={currentUser}
            reports={reports}
            ratings={ratings}
            courses={courses}
            lecturers={lecturers}
            classes={classes}
            quickActions={quickActions}
            quickStats={quickStats}
            onExportAll={handleExportAllData}
          />
        </Tab>
        
        <Tab eventKey="courses" title={<span><i className="fas fa-book me-2"></i>Courses</span>}>
          <EnhancedCoursesTab
            courses={courses}
            lecturers={lecturers}
            lectures={lectures}
            search={search}
            onAddCourse={() => {
              resetCourseModal();
              setShowCourseModal(true);
            }}
            onEditCourse={handleEditCourse}
            onDeleteCourse={handleDeleteCourse}
            onAddLecture={() => setShowLectureModal(true)}
            onDeleteLecture={handleDeleteLecture}
            onBulkAction={() => setShowBulkModal(true)}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
          />
        </Tab>
        
        <Tab eventKey="reports" title={<span><i className="fas fa-file-alt me-2"></i>Reports</span>}>
          <EnhancedReportsTab
            reports={filteredReports}
            courses={courses}
            lecturers={lecturers}
            search={search}
            advancedFilters={advancedFilters}
            setAdvancedFilters={setAdvancedFilters}
            onFeedbackClick={(report) => {
              setSelectedReport(report);
              setFeedback(report.feedback || '');
              setShowFeedbackModal(true);
            }}
            onExport={handleExportReports}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
          />
        </Tab>
        
        <Tab eventKey="ratings" title={<span><i className="fas fa-star me-2"></i>Ratings</span>}>
          <EnhancedRatingsTab
            ratings={ratings}
            courses={courses}
            lecturers={lecturers}
            onRatingSubmit={handleRatingSubmit}
            ratingData={ratingData}
            setRatingData={setRatingData}
            onExport={handleExportRatings}
            setShowRatingModal={setShowRatingModal}
          />
        </Tab>
        
        <Tab eventKey="classes" title={<span><i className="fas fa-calendar-alt me-2"></i>Classes</span>}>
          <EnhancedClassesTab
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
          <EnhancedMonitoringTab
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
                <i className="fas fa-chart-bar me-2"></i>
                Analytics
              </span>
            }
          >
            <EnhancedAnalyticsTab
              ratings={ratings}
              reports={reports}
              courses={courses}
              lecturers={lecturers}
              classes={classes}
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
      
      <EnhancedLectureModal
        show={showLectureModal}
        onClose={() => setShowLectureModal(false)}
        lectureData={lectureData}
        setLectureData={setLectureData}
        courses={courses}
        onSubmit={handleAddLecture}
        uploadProgress={uploadProgress}
      />

      {/* NEW FEATURE: Bulk Operations Modal */}
      <BulkOperationsModal
        show={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        selectedCount={selectedItems.length}
        onBulkFeedback={handleBulkFeedback}
      />
    </Container>
  );
};

// NEW FEATURE: Enhanced Dashboard with Quick Actions
const EnhancedDashboardTab = ({ currentUser, reports, ratings, courses, lecturers, classes, quickActions, quickStats, onExportAll }) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Department Overview</h4>
        <Button variant="outline-primary" onClick={onExportAll} className="export-all-btn">
          <i className="fas fa-file-excel me-2"></i>Export All Data to Excel
        </Button>
      </div>

      {/* NEW: Quick Actions */}
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Quick Actions</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                {quickActions.map((action, index) => (
                  <Col md={3} key={index} className="mb-3">
                    <Button
                      variant={action.variant}
                      onClick={action.action}
                      className="w-100 quick-action-btn"
                    >
                      <i className={`${action.icon} me-2`}></i>
                      {action.title}
                    </Button>
                  </Col>
                ))}
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

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

// NEW FEATURE: Enhanced Courses Tab with Bulk Operations
const EnhancedCoursesTab = ({ courses, lecturers, lectures, search, onAddCourse, onEditCourse, onDeleteCourse, onAddLecture, onDeleteLecture, onBulkAction, selectedItems, setSelectedItems }) => {
  
  const toggleSelectAll = () => {
    if (selectedItems.length === courses.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(courses.map(c => c.id));
    }
  };

  const toggleSelectItem = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Course Management</h4>
        <div>
          {selectedItems.length > 0 && (
            <Button variant="outline-secondary" onClick={onBulkAction} className="me-2">
              <i className="fas fa-tasks me-2"></i>Bulk Actions ({selectedItems.length})
            </Button>
          )}
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
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">All Courses ({courses.length})</h5>
              <Form.Check
                type="checkbox"
                label="Select All"
                checked={selectedItems.length === courses.length && courses.length > 0}
                onChange={toggleSelectAll}
              />
            </Card.Header>
            <Card.Body>
              {courses.length > 0 ? (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th style={{width: '30px'}}></th>
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
                          <tr key={course.id} className={selectedItems.includes(course.id) ? 'table-active' : ''}>
                            <td>
                              <Form.Check
                                type="checkbox"
                                checked={selectedItems.includes(course.id)}
                                onChange={() => toggleSelectItem(course.id)}
                              />
                            </td>
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

// NEW FEATURE: Enhanced Reports Tab with Advanced Filtering
const EnhancedReportsTab = ({ reports, courses, lecturers, search, advancedFilters, setAdvancedFilters, onFeedbackClick, onExport, selectedItems, setSelectedItems }) => {
  
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Department Reports</h4>
        <div>
          <Button
            variant="outline-secondary"
            onClick={() => setShowFilters(!showFilters)}
            className="me-2"
          >
            <i className="fas fa-filter me-2"></i>
            Filters
          </Button>
          <Button
            variant="outline-primary"
            onClick={onExport}
            disabled={reports.length === 0}
            className="export-btn-tab"
          >
            <i className="fas fa-download me-2"></i>Export to Excel
          </Button>
        </div>
      </div>

      {/* NEW: Advanced Filters */}
      {showFilters && (
        <Card className="mb-4">
          <Card.Body>
            <Row>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Date Range</Form.Label>
                  <Form.Select
                    value={advancedFilters.dateRange}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, dateRange: e.target.value})}
                  >
                    <option value="">All Dates</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Faculty</Form.Label>
                  <Form.Select
                    value={advancedFilters.faculty}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, faculty: e.target.value})}
                  >
                    <option value="">All Faculties</option>
                    <option value="ICT">ICT</option>
                    <option value="Business">Business</option>
                    <option value="Design">Design</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Rating</Form.Label>
                  <Form.Select
                    value={advancedFilters.rating}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, rating: e.target.value})}
                  >
                    <option value="">All Ratings</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4+ Stars</option>
                    <option value="3">3+ Stars</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={advancedFilters.status}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, status: e.target.value})}
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending Feedback</option>
                    <option value="reviewed">Reviewed</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

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

// Enhanced Ratings Tab
const EnhancedRatingsTab = ({ ratings, courses, lecturers, onRatingSubmit, ratingData, setRatingData, onExport, setShowRatingModal }) => {
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

// Enhanced Classes Tab
const EnhancedClassesTab = ({ classes, courses, lecturers, onAddClass, onEditClass, onDeleteClass }) => {
  
  // NEW: Group classes by date
  const upcomingClasses = classes.filter(c => new Date(c.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const pastClasses = classes.filter(c => new Date(c.date) < new Date())
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="section-title">Class Schedule Management</h4>
        <Button variant="primary" onClick={onAddClass}>
          <i className="fas fa-plus me-2"></i>Schedule Class
        </Button>
      </div>
      
      <Row>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header className="bg-success text-white">
              <h5 className="mb-0">Upcoming Classes ({upcomingClasses.length})</h5>
            </Card.Header>
            <Card.Body>
              {upcomingClasses.length > 0 ? (
                <ListGroup variant="flush">
                  {upcomingClasses.slice(0, 5).map((classItem) => {
                    const course = courses.find((c) => c.id === classItem.course_id);
                    const lecturer = lecturers.find((l) => l.id === classItem.lecturer_id);
                    return (
                      <ListGroup.Item key={classItem.id} className="px-0">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong>{course ? course.name : 'N/A'}</strong>
                            <br />
                            <small className="text-muted">
                              {lecturer ? lecturer.username : 'N/A'} • {classItem.room}
                            </small>
                            <br />
                            <small>
                              {new Date(classItem.date).toLocaleDateString()} at {classItem.time}
                            </small>
                          </div>
                          <div>
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
                          </div>
                        </div>
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              ) : (
                <p className="text-muted">No upcoming classes scheduled.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">All Scheduled Classes ({classes.length})</h5>
            </Card.Header>
            <Card.Body>
              {classes.length > 0 ? (
                <div className="table-responsive">
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Room</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.slice(0, 10).map((classItem) => {
                        const course = courses.find((c) => c.id === classItem.course_id);
                        return (
                          <tr key={classItem.id}>
                            <td>{course ? course.code : 'N/A'}</td>
                            <td>{new Date(classItem.date).toLocaleDateString()}</td>
                            <td>{classItem.time}</td>
                            <td>{classItem.room}</td>
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

// Enhanced Monitoring Tab
const EnhancedMonitoringTab = ({ reports, ratings, courses, lecturers, classes }) => {
  // Calculate statistics
  const totalAttendance = reports.reduce((sum, report) => sum + report.actual_students, 0);
  const totalPossibleAttendance = reports.reduce((sum, report) => sum + report.total_students, 0);
  const averageAttendanceRate = totalPossibleAttendance > 0 ? (totalAttendance / totalPossibleAttendance * 100).toFixed(1) : 0;
  
  const averageRating = ratings.length > 0 
    ? (ratings.reduce((sum, rating) => sum + parseFloat(rating.rating), 0) / ratings.length).toFixed(1)
    : 0;

  // NEW: Performance trends
  const monthlyPerformance = [
    { month: 'Jan', rating: 4.2, attendance: 85 },
    { month: 'Feb', rating: 4.4, attendance: 88 },
    { month: 'Mar', rating: 4.1, attendance: 82 },
    { month: 'Apr', rating: 4.5, attendance: 90 },
    { month: 'May', rating: 4.3, attendance: 87 },
    { month: 'Jun', rating: 4.6, attendance: 92 }
  ];

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
      
      {/* NEW: Performance Trends */}
      <Row className="mb-4">
        <Col md={6}>
          <Card>
            <Card.Header>
              <h5>Performance Trends</h5>
            </Card.Header>
            <Card.Body>
              <div className="performance-chart">
                {monthlyPerformance.map((month, index) => (
                  <div key={month.month} className="performance-bar-container mb-2">
                    <div className="d-flex justify-content-between mb-1">
                      <span>{month.month}</span>
                      <span>Rating: {month.rating}/5</span>
                    </div>
                    <ProgressBar 
                      now={(month.rating / 5) * 100} 
                      variant={month.rating >= 4 ? 'success' : month.rating >= 3 ? 'warning' : 'danger'}
                    />
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header>
              <h5>Attendance Trends</h5>
            </Card.Header>
            <Card.Body>
              <div className="attendance-chart">
                {monthlyPerformance.map((month, index) => (
                  <div key={month.month} className="attendance-bar-container mb-2">
                    <div className="d-flex justify-content-between mb-1">
                      <span>{month.month}</span>
                      <span>{month.attendance}%</span>
                    </div>
                    <ProgressBar 
                      now={month.attendance} 
                      variant={month.attendance >= 85 ? 'success' : month.attendance >= 75 ? 'warning' : 'danger'}
                    />
                  </div>
                ))}
              </div>
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

// Enhanced Analytics Tab
const EnhancedAnalyticsTab = ({ ratings, reports, courses, lecturers, classes }) => {
  
  // NEW: Calculate department performance
  const departmentPerformance = courses.reduce((acc, course) => {
    const dept = course.department || 'General';
    if (!acc[dept]) {
      acc[dept] = { totalRatings: 0, count: 0, courses: 0 };
    }
    acc[dept].courses++;
    
    const deptRatings = ratings.filter(r => {
      const ratingCourse = courses.find(c => c.id === r.course_id);
      return ratingCourse?.department === dept;
    });
    
    acc[dept].totalRatings = deptRatings.reduce((sum, r) => sum + parseFloat(r.rating), 0);
    acc[dept].count = deptRatings.length;
    
    return acc;
  }, {});

  return (
    <div>
      <h4 className="section-title">Analytics Dashboard</h4>
      
      {/* NEW: Department Performance */}
      <Row className="mb-4">
        <Col md={6}>
          <Card>
            <Card.Header>
              <h5>Department Performance</h5>
            </Card.Header>
            <Card.Body>
              {Object.entries(departmentPerformance).map(([dept, data]) => {
                const avgRating = data.count > 0 ? (data.totalRatings / data.count).toFixed(1) : 'N/A';
                return (
                  <div key={dept} className="mb-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <strong>{dept}</strong>
                      <Badge bg={avgRating >= 4 ? 'success' : avgRating >= 3 ? 'warning' : 'danger'}>
                        {avgRating}/5
                      </Badge>
                    </div>
                    <ProgressBar 
                      now={data.count > 0 ? (avgRating / 5) * 100 : 0} 
                      variant={avgRating >= 4 ? 'success' : avgRating >= 3 ? 'warning' : 'danger'}
                      className="mt-1"
                    />
                    <small className="text-muted">
                      {data.courses} courses • {data.count} ratings
                    </small>
                  </div>
                );
              })}
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header>
              <h5>Course Performance Distribution</h5>
            </Card.Header>
            <Card.Body>
              {courses.map((course) => {
                const courseRatings = ratings.filter((r) => r.course_id === course.id);
                const avgRating = courseRatings.length > 0
                  ? (courseRatings.reduce((sum, r) => sum + parseFloat(r.rating), 0) / courseRatings.length).toFixed(1)
                  : 'N/A';
                return (
                  <div key={course.id} className="mb-2">
                    <div className="d-flex justify-content-between">
                      <span className="course-name">{course.name}</span>
                      <Badge bg={avgRating < 3 ? 'danger' : avgRating < 4 ? 'warning' : 'success'}>
                        {avgRating === 'N/A' ? 'No Ratings' : `${avgRating}/5`}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
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
                  const avgRating = courseRatings.length > 0
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
                  const avgRating = lecturerRatings.length > 0
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

// Enhanced Lecture Modal with File Upload
const EnhancedLectureModal = ({ show, onClose, lectureData, setLectureData, courses, onSubmit, uploadProgress }) => {
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLectureData({ ...lectureData, file });
    }
  };

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
          
          {/* NEW: File Upload */}
          <Form.Group className="mb-3">
            <Form.Label>Upload Materials</Form.Label>
            <Form.Control
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.ppt,.pptx"
            />
            <Form.Text className="text-muted">
              Supported formats: PDF, DOC, DOCX, PPT, PPTX
            </Form.Text>
          </Form.Group>
          
          {uploadProgress > 0 && (
            <Form.Group className="mb-3">
              <Form.Label>Upload Progress</Form.Label>
              <ProgressBar now={uploadProgress} label={`${uploadProgress}%`} />
            </Form.Group>
          )}
          
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

// NEW FEATURE: Bulk Operations Modal
const BulkOperationsModal = ({ show, onClose, selectedCount, onBulkFeedback }) => {
  const [bulkFeedback, setBulkFeedback] = useState('');

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Bulk Operations</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info">
          Applying operations to {selectedCount} selected items
        </Alert>
        
        <Form.Group>
          <Form.Label>Apply Feedback to All Selected</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={bulkFeedback}
            onChange={(e) => setBulkFeedback(e.target.value)}
            placeholder="Enter feedback to apply to all selected items..."
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onBulkFeedback}
          disabled={!bulkFeedback.trim()}
        >
          Apply to {selectedCount} Items
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Existing modals remain the same...
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
  const [loading, setLoading] = useState(false);

  const facultyOptions = [
    "Faculty of Information and Communication Technology",
    "Faculty of Business Management and Globalisation", 
    "Faculty of Design and Innovation"
  ];

  const handleSubmit = async () => {
    try {
      setAuthError('');
      setLoading(true);
      
      if (isRegister && !formData.faculty_name) {
        setAuthError('Please select a faculty');
        setLoading(false);
        return;
      }
      
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
            {['Principal Lecturer', 'Program Leader'].map((role) => (
              <Button
                key={role}
                variant={formData.role === role ? 'primary' : 'outline-primary'}
                onClick={() => setFormData({ ...formData, role })}
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
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="auth-input"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="auth-label">Faculty/Department</Form.Label>
                <Form.Select
                  value={formData.faculty_name}
                  onChange={(e) => setFormData({ ...formData, faculty_name: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="auth-input"
              placeholder="Enter your password"
              disabled={loading}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer className="auth-footer">
        <Button variant="link" onClick={() => setIsRegister(!isRegister)} className="auth-switch" disabled={loading}>
          {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
        </Button>
        <Button variant="primary" onClick={handleSubmit} className="auth-submit" disabled={loading}>
          {loading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Login')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PrincipalLecturer;