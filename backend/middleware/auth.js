// middleware/auth.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();
const SECRET = process.env.JWT_SECRET || 'secret';

// Role normalization map
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

// Verify token middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      console.error('JWT verification error:', err);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Normalize the role from token
    if (decoded.user && decoded.user.role) {
      decoded.user.role = normalizeRole(decoded.user.role);
    }
    
    req.user = decoded.user;
    next();
  });
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

module.exports = { authenticateToken, checkRole, normalizeRole };