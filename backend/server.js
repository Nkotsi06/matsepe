// server.js - FIXED FOR EXPRESS 5
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');

dotenv.config();

const app = express();

// ⚠️ CRITICAL FIX: Add trust proxy for Render
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// More aggressive rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs
  message: {
    error: 'Too many login attempts, please try again later.'
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Compression middleware
app.use(compression());

// Morgan logging configuration
app.use(morgan('dev')); // Console logging only

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://matsepe.onrender.com',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Import routes
const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const ratingsRoutes = require('./routes/ratings');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const classesRoutes = require('./routes/classes');
const monitoringRoutes = require('./routes/monitoring');
const dashboardRoutes = require('./routes/dashboard');
const principalRoutes = require('./routes/principal');
const studentRoutes = require('./routes/student');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/principal', principalRoutes);
app.use('/api/student', studentRoutes);

// API Documentation route
app.get('/api', (req, res) => {
  res.json({
    message: 'Faculty Reporting System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      courses: '/api/courses',
      ratings: '/api/ratings',
      reports: '/api/reports',
      users: '/api/users',
      classes: '/api/classes',
      monitoring: '/api/monitoring',
      dashboard: '/api/dashboard',
      principal: '/api/principal',
      student: '/api/student'
    }
  });
});

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: 'Faculty Reporting System API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.version
  };

  try {
    // Database health check
    const db = require('./db');
    await db.query('SELECT 1');
    healthCheck.database = 'Connected';
  } catch (error) {
    healthCheck.database = 'Disconnected';
    healthCheck.status = 'Degraded';
    healthCheck.message = 'API is running but database connection failed';
  }

  res.status(healthCheck.status === 'OK' ? 200 : 503).json(healthCheck);
});

// Database connection test endpoint
app.get('/api/db-status', async (req, res) => {
  try {
    const db = require('./db');
    const result = await db.query('SELECT version()');
    res.json({
      status: 'Connected',
      database: 'PostgreSQL',
      version: result.rows[0].version
    });
  } catch (error) {
    res.status(503).json({
      status: 'Disconnected',
      error: error.message
    });
  }
});

// 404 handler for API routes - FIXED for Express 5
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      '/api/auth',
      '/api/courses',
      '/api/ratings',
      '/api/reports',
      '/api/users',
      '/api/classes',
      '/api/monitoring',
      '/api/dashboard',
      '/api/principal',
      '/api/student',
      '/api/health'
    ]
  });
});

// Global 404 handler - FIXED for Express 5
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist on this server.`,
    suggestion: 'Please check the API documentation at /api'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Request from this origin is not allowed'
    });
  }

  // Rate limit errors
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests, please try again later.'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Authentication token is invalid'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'Authentication token has expired'
    });
  }

  // Database errors
  if (err.code && err.code.startsWith('23')) {
    return res.status(400).json({
      error: 'Database Error',
      message: 'Data validation failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  // Default error response
  const errorResponse = {
    error: 'Internal Server Error',
    message: 'Something went wrong on our server',
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message
    })
  };

  res.status(err.status || 500).json(errorResponse);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
🚀 Faculty Reporting System API running on port ${PORT}
📊 Environment: ${process.env.NODE_ENV || 'development'}

🔗 Available endpoints:
   - Health: https://matsepe.onrender.com/api/health
   - API Docs: https://matsepe.onrender.com/api
   - Database Status: https://matsepe.onrender.com/api/db-status
   - Auth: https://matsepe.onrender.com/api/auth
   - Dashboard: https://matsepe.onrender.com/api/dashboard
   - Courses: https://matsepe.onrender.com/api/courses
   - Ratings: https://matsepe.onrender.com/api/ratings
   - Reports: https://matsepe.onrender.com/api/reports
   - Users: https://matsepe.onrender.com/api/users
   - Classes: https://matsepe.onrender.com/api/classes
   - Monitoring: https://matsepe.onrender.com/api/monitoring
   - Principal: https://matsepe.onrender.com/api/principal
   - Student: https://matsepe.onrender.com/api/student
  `);
});

module.exports = app;