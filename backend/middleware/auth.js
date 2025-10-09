// middleware/auth.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const pool = require('../db');

dotenv.config();
const SECRET = process.env.JWT_SECRET || 'secret';

// Enhanced Role normalization map
const roleMap = {
  'student': 'Student',
  'st': 'Student',
  'lecturer': 'Lecturer', 
  'teacher': 'Lecturer',
  'principal lecturer': 'PRL',
  'principal': 'PRL',
  'prl': 'PRL',
  'program leader': 'Program Leader',
  'programleader': 'Program Leader',
  'pl': 'Program Leader',
  'leader': 'Program Leader'
};

function normalizeRole(role) {
  if (!role) return null;
  return roleMap[role.toLowerCase().trim()] || role;
}

// Verify token middleware with enhanced user validation
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    
    // Normalize the role from token
    if (decoded.user && decoded.user.role) {
      decoded.user.role = normalizeRole(decoded.user.role);
    }

    // Verify user still exists and is active in database
    const userResult = await pool.query(
      `SELECT id, username, email, role, faculty_name, department, status 
       FROM users WHERE id = $1`,
      [decoded.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'User account no longer exists' });
    }

    const user = userResult.rows[0];

    // Check if user account is active
    if (user.status !== 'Active') {
      return res.status(403).json({ 
        error: `Account is ${user.status.toLowerCase()}. Please contact administrator.` 
      });
    }

    // Update user object with fresh data from database
    req.user = {
      ...decoded.user,
      username: user.username,
      email: user.email,
      faculty_name: user.faculty_name,
      department: user.department,
      status: user.status
    };

    // Update last activity timestamp (non-blocking)
    pool.query(
      'UPDATE users SET last_activity = NOW() WHERE id = $1',
      [decoded.user.id]
    ).catch(err => console.error('Activity update error:', err));

    next();
  } catch (err) {
    console.error('JWT verification error:', err);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    } else {
      return res.status(500).json({ error: 'Token verification failed' });
    }
  }
};

// Role-based access control middleware
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = normalizeRole(req.user.role);
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${userRole}` 
      });
    }
    
    next();
  };
};

// Faculty-based access control middleware
const checkFacultyAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Program Leaders have access to all data within their faculty
  if (req.user.role === 'Program Leader') {
    return next();
  }

  // PRLs have access to their faculty data
  if (req.user.role === 'PRL') {
    return next();
  }

  // For Lecturers and Students, check if they're accessing their own faculty data
  const requestedFaculty = req.params.faculty_name || req.body.faculty_name || req.query.faculty_name;
  
  if (requestedFaculty && requestedFaculty !== req.user.faculty_name) {
    return res.status(403).json({ 
      error: 'Access denied. You can only access data from your faculty.' 
    });
  }

  next();
};

// Ownership-based access control middleware
const checkOwnership = (resourceType) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const resourceId = req.params.id;
      let ownershipCheckQuery;
      let queryParams = [resourceId];

      switch (resourceType) {
        case 'course':
          ownershipCheckQuery = 'SELECT lecturer_id, faculty_name FROM courses WHERE id = $1';
          break;
        case 'class':
          ownershipCheckQuery = 'SELECT lecturer_id, course_id FROM classes WHERE id = $1';
          break;
        case 'assignment':
          ownershipCheckQuery = 'SELECT created_by, course_id FROM assignments WHERE id = $1';
          break;
        case 'submission':
          ownershipCheckQuery = 'SELECT student_id, assignment_id FROM student_submissions WHERE id = $1';
          break;
        case 'user':
          ownershipCheckQuery = 'SELECT id, faculty_name FROM users WHERE id = $1';
          break;
        default:
          return res.status(500).json({ error: 'Invalid resource type' });
      }

      const result = await pool.query(ownershipCheckQuery, queryParams);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${resourceType} not found` });
      }

      const resource = result.rows[0];
      const userRole = normalizeRole(req.user.role);

      // Check ownership based on resource type and user role
      let hasAccess = false;

      switch (resourceType) {
        case 'course':
          if (userRole === 'Lecturer' && resource.lecturer_id === req.user.id) {
            hasAccess = true;
          } else if (['PRL', 'Program Leader'].includes(userRole) && resource.faculty_name === req.user.faculty_name) {
            hasAccess = true;
          }
          break;

        case 'class':
          if (userRole === 'Lecturer' && resource.lecturer_id === req.user.id) {
            hasAccess = true;
          } else if (['PRL', 'Program Leader'].includes(userRole)) {
            // Check if class belongs to user's faculty
            const courseCheck = await pool.query(
              'SELECT faculty_name FROM courses WHERE id = $1',
              [resource.course_id]
            );
            if (courseCheck.rows.length > 0 && courseCheck.rows[0].faculty_name === req.user.faculty_name) {
              hasAccess = true;
            }
          } else if (userRole === 'Student') {
            // Check if student is enrolled in the course
            const enrollmentCheck = await pool.query(
              'SELECT 1 FROM student_courses WHERE student_id = $1 AND course_id = $2 AND status = $3',
              [req.user.id, resource.course_id, 'Enrolled']
            );
            hasAccess = enrollmentCheck.rows.length > 0;
          }
          break;

        case 'assignment':
          if (userRole === 'Lecturer' && resource.created_by === req.user.id) {
            hasAccess = true;
          } else if (['PRL', 'Program Leader'].includes(userRole)) {
            // Check if assignment belongs to user's faculty
            const courseCheck = await pool.query(
              'SELECT faculty_name FROM courses WHERE id = $1',
              [resource.course_id]
            );
            if (courseCheck.rows.length > 0 && courseCheck.rows[0].faculty_name === req.user.faculty_name) {
              hasAccess = true;
            }
          } else if (userRole === 'Student') {
            // Check if student is enrolled in the course
            const enrollmentCheck = await pool.query(
              'SELECT 1 FROM student_courses WHERE student_id = $1 AND course_id = $2 AND status = $3',
              [req.user.id, resource.course_id, 'Enrolled']
            );
            hasAccess = enrollmentCheck.rows.length > 0;
          }
          break;

        case 'submission':
          if (userRole === 'Student' && resource.student_id === req.user.id) {
            hasAccess = true;
          } else if (userRole === 'Lecturer') {
            // Check if lecturer teaches the course for this assignment
            const assignmentCheck = await pool.query(
              `SELECT a.created_by, c.lecturer_id 
               FROM assignments a 
               JOIN courses c ON a.course_id = c.id 
               WHERE a.id = $1`,
              [resource.assignment_id]
            );
            if (assignmentCheck.rows.length > 0 && 
                (assignmentCheck.rows[0].created_by === req.user.id || 
                 assignmentCheck.rows[0].lecturer_id === req.user.id)) {
              hasAccess = true;
            }
          } else if (['PRL', 'Program Leader'].includes(userRole)) {
            // Check if submission belongs to user's faculty
            const assignmentCheck = await pool.query(
              `SELECT c.faculty_name 
               FROM assignments a 
               JOIN courses c ON a.course_id = c.id 
               WHERE a.id = $1`,
              [resource.assignment_id]
            );
            if (assignmentCheck.rows.length > 0 && assignmentCheck.rows[0].faculty_name === req.user.faculty_name) {
              hasAccess = true;
            }
          }
          break;

        case 'user':
          // Users can access their own profile, admins can access users in their faculty
          if (req.user.id === parseInt(resourceId)) {
            hasAccess = true;
          } else if (['PRL', 'Program Leader'].includes(userRole) && resource.faculty_name === req.user.faculty_name) {
            hasAccess = true;
          }
          break;
      }

      if (!hasAccess) {
        return res.status(403).json({ 
          error: `Access denied. You don't have permission to access this ${resourceType}.` 
        });
      }

      req.resource = resource;
      next();
    } catch (err) {
      console.error('Ownership check error:', err);
      return res.status(500).json({ error: 'Server error during access validation' });
    }
  };
};

// Department-based access control middleware
const checkDepartmentAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRole = normalizeRole(req.user.role);

  // Program Leaders and PRLs have access to all departments in their faculty
  if (['Program Leader', 'PRL'].includes(userRole)) {
    return next();
  }

  // Lecturers and Students can only access their own department data
  const requestedDepartment = req.params.department || req.body.department || req.query.department;
  
  if (requestedDepartment && requestedDepartment !== req.user.department) {
    return res.status(403).json({ 
      error: 'Access denied. You can only access data from your department.' 
    });
  }

  next();
};

// Combined role and faculty access middleware
const checkRoleAndFaculty = (allowedRoles) => {
  return [checkRole(allowedRoles), checkFacultyAccess];
};

// Activity logging middleware
const logActivity = (activityType, descriptionFn) => {
  return async (req, res, next) => {
    // Store the original send function
    const originalSend = res.send;

    // Override the send function to log after response is sent
    res.send = function(data) {
      // Restore the original send function
      res.send = originalSend;

      // Only log if request was successful (2xx status code)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const description = typeof descriptionFn === 'function' 
            ? descriptionFn(req, JSON.parse(data)) 
            : descriptionFn;

          pool.query(
            `INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              req.user.id,
              activityType,
              description,
              req.ip,
              req.get('User-Agent')
            ]
          ).catch(err => console.error('Activity logging error:', err));
        } catch (err) {
          console.error('Activity logging setup error:', err);
        }
      }

      // Call the original send function
      return originalSend.call(this, data);
    };

    next();
  };
};

// Rate limiting middleware (basic implementation)
const createRateLimiter = (windowMs = 900000, maxRequests = 100) => { // 15 minutes window
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const now = Date.now();
    const userKey = req.user.id;
    const windowStart = now - windowMs;

    // Clean up old entries
    if (requests.has(userKey)) {
      const userRequests = requests.get(userKey).filter(time => time > windowStart);
      if (userRequests.length === 0) {
        requests.delete(userKey);
      } else {
        requests.set(userKey, userRequests);
      }
    }

    // Check rate limit
    const userRequests = requests.get(userKey) || [];
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.' 
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(userKey, userRequests);

    next();
  };
};

// Apply rate limiting to different user roles
const rateLimitByRole = {
  'Student': createRateLimiter(900000, 100), // 100 requests per 15 minutes
  'Lecturer': createRateLimiter(900000, 200), // 200 requests per 15 minutes
  'PRL': createRateLimiter(900000, 300), // 300 requests per 15 minutes
  'Program Leader': createRateLimiter(900000, 500) // 500 requests per 15 minutes
};

const applyRateLimit = (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const userRole = normalizeRole(req.user.role);
  const rateLimiter = rateLimitByRole[userRole] || rateLimitByRole['Student'];
  
  rateLimiter(req, res, next);
};

module.exports = {
  authenticateToken,
  checkRole,
  checkFacultyAccess,
  checkDepartmentAccess,
  checkOwnership,
  checkRoleAndFaculty,
  logActivity,
  applyRateLimit,
  normalizeRole,
  createRateLimiter
};