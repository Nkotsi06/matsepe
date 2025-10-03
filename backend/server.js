// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Faculty Reporting System API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler (Express 5 compatible)
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(' Server error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(` Faculty Reporting System API running on port ${PORT}`);
  console.log(` Available endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/api/health`);
  console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   - Dashboard: http://localhost:${PORT}/api/dashboard`);
  console.log(`   - Courses: http://localhost:${PORT}/api/courses`);
  console.log(`   - Ratings: http://localhost:${PORT}/api/ratings`);
  console.log(`   - Reports: http://localhost:${PORT}/api/reports`);
});
