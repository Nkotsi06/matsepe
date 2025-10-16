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
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// More aggressive rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many login attempts, please try again later.'
  },
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(compression());
app.use(morgan('dev'));

// ✅ UPDATED CORS CONFIGURATION
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://matsepe-1.onrender.com', // <-- ✅ added your frontend Render URL
    'https://matsepe.onrender.com',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Health & DB status endpoints
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

// 404 + error handlers remain unchanged
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist.`,
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong on our server',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
