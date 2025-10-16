// server.js - FULLY FIXED for Render CORS + Express 5
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Needed for Render HTTPS handling

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Rate limiters
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
  skipSuccessfulRequests: true,
});
app.use('/api/auth', authLimiter);

// ✅ FIXED CORS CONFIGURATION
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://matsepe-1.onrender.com',
  'https://matsepe.onrender.com',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use((req, res, next) => {
  console.log(`🌐 [${req.method}] ${req.originalUrl} from ${req.headers.origin}`);
  next();
});

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 Blocked CORS request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Authorization'],
    optionsSuccessStatus: 204,
  })
);

// ✅ Handle OPTIONS requests globally (important for preflight)
app.options('*', cors());

// Other middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(morgan('dev'));

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

// API root info
app.get('/api', (req, res) => {
  res.json({
    message: 'Faculty Reporting System API',
    status: 'Running',
    frontend: process.env.FRONTEND_URL || 'Not defined',
    time: new Date().toISOString(),
  });
});

// Health check route
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };
  try {
    const db = require('./db');
    await db.query('SELECT 1');
    health.database = 'Connected';
  } catch {
    health.database = 'Disconnected';
    health.status = 'Degraded';
  }
  res.status(health.status === 'OK' ? 200 : 503).json(health);
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('✅ Allowed Origins:', allowedOrigins);
});

module.exports = app;
