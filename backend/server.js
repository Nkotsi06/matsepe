// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }
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

// Logging setup
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'logs', 'access.log'),
  { flags: 'a' }
);

// Morgan logging configuration
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // Console logging

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://yourdomain.com', // Replace with your production domain
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Pre-flight requests
app.options('*', cors(corsOptions));

// Body parsing middleware with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (if needed for file uploads)
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Response time header
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
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
const assignmentsRoutes = require('./routes/assignments');
const submissionsRoutes = require('./routes/submissions');
const attendanceRoutes = require('./routes/attendance');
const analyticsRoutes = require('./routes/analytics');

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
      student: '/api/student',
      assignments: '/api/assignments',
      submissions: '/api/submissions',
      attendance: '/api/attendance',
      analytics: '/api/analytics'
    },
    documentation: 'https://docs.yourdomain.com' // Add your API docs link
  });
});

// Mount routes with versioning
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/courses', coursesRoutes);
app.use('/api/v1/ratings', ratingsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/classes', classesRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/principal', principalRoutes);
app.use('/api/v1/student', studentRoutes);
app.use('/api/v1/assignments', assignmentsRoutes);
app.use('/api/v1/submissions', submissionsRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Backward compatibility - keep old routes
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

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: 'Faculty Reporting System API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
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

// System info endpoint (protected in production)
app.get('/api/system-info', (req, res) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
});

// 404 handler for API routes
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

// Global 404 handler (fixed for Express v5)
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist on this server.`,
    suggestion: 'Please check the API documentation at /api'
  });
});


// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);

  // Log error to file
  const errorLogStream = fs.createWriteStream(
    path.join(__dirname, 'logs', 'error.log'),
    { flags: 'a' }
  );
  errorLogStream.write(`${new Date().toISOString()} - ${err.stack}\n\n`);

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
      details: err.message,
      stack: err.stack
    })
  };

  res.status(err.status || 500).json(errorResponse);
});

// Process event handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log to file
  const errorLogStream = fs.createWriteStream(
    path.join(__dirname, 'logs', 'unhandled-rejections.log'),
    { flags: 'a' }
  );
  errorLogStream.write(`${new Date().toISOString()} - ${reason}\n${promise}\n\n`);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log to file
  const errorLogStream = fs.createWriteStream(
    path.join(__dirname, 'logs', 'uncaught-exceptions.log'),
    { flags: 'a' }
  );
  errorLogStream.write(`${new Date().toISOString()} - ${error.stack}\n\n`);
  
  // In production, you might want to exit and let process manager restart
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
    
    // Close database connections if any
    const db = require('./db');
    if (db.end) {
      db.end(() => {
        console.log('Database connections closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5000;

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const server = app.listen(PORT, () => {
  console.log(`
 Faculty Reporting System API running on port ${PORT}
 Environment: ${process.env.NODE_ENV || 'development'}
 Started at: ${new Date().toISOString()}

 Available endpoints:
   - Health: http://localhost:${PORT}/api/health
   - API Docs: http://localhost:${PORT}/api
   - Database Status: http://localhost:${PORT}/api/db-status
   - Auth: http://localhost:${PORT}/api/auth
   - Dashboard: http://localhost:${PORT}/api/dashboard
   - Courses: http://localhost:${PORT}/api/courses
   - Ratings: http://localhost:${PORT}/api/ratings
   - Reports: http://localhost:${PORT}/api/reports
   - Users: http://localhost:${PORT}/api/users
   - Classes: http://localhost:${PORT}/api/classes
   - Monitoring: http://localhost:${PORT}/api/monitoring
   - Principal: http://localhost:${PORT}/api/principal
   - Student: http://localhost:${PORT}/api/student
   - Assignments: http://localhost:${PORT}/api/assignments
   - Submissions: http://localhost:${PORT}/api/submissions
   - Attendance: http://localhost:${PORT}/api/attendance
   - Analytics: http://localhost:${PORT}/api/analytics

 Logs are being written to: ${logsDir}
  `);
});

module.exports = app; // For testing