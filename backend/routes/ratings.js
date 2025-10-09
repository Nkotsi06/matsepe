const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ Helper Functions ------------------
const buildRatingQuery = (userRole, userId, facultyName) => {
  let query = `
    SELECT r.*, c.name as course_name, c.code as course_code, 
           u.username as student_name, l.username as lecturer_name,
           c.faculty_name, r.is_anonymous,
           (SELECT COUNT(*) FROM rating_likes rl WHERE rl.rating_id = r.id) as like_count,
           (SELECT COUNT(*) FROM rating_comments rc WHERE rc.rating_id = r.id) as comment_count
    FROM ratings r
    JOIN courses c ON r.course_id = c.id
    JOIN users u ON r.user_id = u.id
    JOIN users l ON c.lecturer_id = l.id
    WHERE 1=1
  `;
  const params = [];

  if (userRole === 'student') {
    query += ` AND r.user_id = $1`;
    params.push(userId);
  } else if (userRole === 'lecturer') {
    query += ` AND c.lecturer_id = $1`;
    params.push(userId);
  } else if (['prl', 'program leader'].includes(userRole) && facultyName) {
    query += ` AND c.faculty_name = $1`;
    params.push(facultyName);
  }

  query += ' ORDER BY r.created_at DESC';
  return { query, params };
};

const checkEnrollment = async (studentId, courseId) => {
  const result = await pool.query(
    'SELECT 1 FROM enrollment WHERE student_id = $1 AND course_id = $2',
    [studentId, courseId]
  );
  return result.rows.length > 0;
};

// ------------------ GET all ratings (with role-based filtering) ------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { query, params } = buildRatingQuery(
      (req.user.role || '').toLowerCase(), 
      req.user.id, 
      req.user.faculty_name
    );
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Ratings fetch error:', err);
    res.status(500).json({ error: 'Server error fetching ratings' });
  }
});

// ------------------ GET single rating by ID ------------------
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let query = `
      SELECT r.*, c.name as course_name, c.code as course_code, 
             u.username as student_name, l.username as lecturer_name,
             c.faculty_name, r.is_anonymous,
             (SELECT COUNT(*) FROM rating_likes rl WHERE rl.rating_id = r.id) as like_count,
             (SELECT COUNT(*) FROM rating_comments rc WHERE rc.rating_id = r.id) as comment_count
      FROM ratings r
      JOIN courses c ON r.course_id = c.id
      JOIN users u ON r.user_id = u.id
      JOIN users l ON c.lecturer_id = l.id
      WHERE r.id = $1
    `;
    const params = [id];

    const role = (req.user.role || '').toLowerCase();
    if (role === 'student') {
      query += ` AND r.user_id = $2`;
      params.push(req.user.id);
    } else if (role === 'lecturer') {
      query += ` AND c.lecturer_id = $2`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $2`;
      params.push(req.user.faculty_name);
    }

    const result = await pool.query(query, params);
    result.rows.length === 0 
      ? res.status(404).json({ error: 'Rating not found or access denied' })
      : res.json(result.rows[0]);
  } catch (err) {
    console.error('Rating fetch error:', err);
    res.status(500).json({ error: 'Server error fetching rating' });
  }
});

// ------------------ POST submit rating (Student only) ------------------
router.post('/', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { course_id, rating, comment = '', is_anonymous = false, rating_type = 'course' } = req.body;

    if (!course_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid course ID and rating (1-5) required' });
    }

    const isEnrolled = await checkEnrollment(req.user.id, course_id);
    if (!isEnrolled) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Check for existing rating (allow updates)
    const existing = await pool.query(
      'SELECT id FROM ratings WHERE user_id = $1 AND course_id = $2 AND rating_type = $3',
      [req.user.id, course_id, rating_type]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing rating
      result = await pool.query(
        `UPDATE ratings SET rating = $1, comment = $2, is_anonymous = $3, updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [rating, comment, is_anonymous, existing.rows[0].id]
      );
    } else {
      // Create new rating
      result = await pool.query(
        `INSERT INTO ratings (course_id, user_id, rating, comment, rating_type, is_anonymous, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
        [course_id, req.user.id, rating, comment, rating_type, is_anonymous]
      );
    }

    res.status(existing.rows.length > 0 ? 200 : 201).json(result.rows[0]);
  } catch (err) {
    console.error('Rating submission error:', err);
    res.status(500).json({ error: 'Server error submitting rating' });
  }
});

// ------------------ NEW: POST like/unlike rating ------------------
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if rating exists and user has access
    const ratingCheck = await pool.query(
      'SELECT id FROM ratings WHERE id = $1',
      [id]
    );

    if (ratingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    // Check if already liked
    const existingLike = await pool.query(
      'SELECT id FROM rating_likes WHERE rating_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    let result;
    if (existingLike.rows.length > 0) {
      // Unlike
      await pool.query(
        'DELETE FROM rating_likes WHERE rating_id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      result = { liked: false };
    } else {
      // Like
      await pool.query(
        'INSERT INTO rating_likes (rating_id, user_id, created_at) VALUES ($1, $2, NOW())',
        [id, req.user.id]
      );
      result = { liked: true };
    }

    // Get updated like count
    const likeCount = await pool.query(
      'SELECT COUNT(*) as count FROM rating_likes WHERE rating_id = $1',
      [id]
    );

    res.json({ ...result, like_count: parseInt(likeCount.rows[0].count) });
  } catch (err) {
    console.error('Rating like error:', err);
    res.status(500).json({ error: 'Server error processing like' });
  }
});

// ------------------ NEW: POST comment on rating ------------------
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    // Check if rating exists
    const ratingCheck = await pool.query(
      'SELECT id FROM ratings WHERE id = $1',
      [id]
    );

    if (ratingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    const result = await pool.query(
      `INSERT INTO rating_comments (rating_id, user_id, comment, created_at)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [id, req.user.id, comment]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Rating comment error:', err);
    res.status(500).json({ error: 'Server error adding comment' });
  }
});

// ------------------ NEW: GET rating comments ------------------
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT rc.*, u.username, u.role
       FROM rating_comments rc
       JOIN users u ON rc.user_id = u.id
       WHERE rc.rating_id = $1
       ORDER BY rc.created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Rating comments fetch error:', err);
    res.status(500).json({ error: 'Server error fetching comments' });
  }
});

// ------------------ NEW: GET rating analytics ------------------
router.get('/analytics/overview', authenticateToken, checkRole(['Lecturer', 'PRL', 'Program Leader']), async (req, res) => {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_ratings,
        COALESCE(ROUND(AVG(rating), 2), 0) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
        COUNT(DISTINCT course_id) as courses_rated,
        COUNT(DISTINCT user_id) as students_rated,
        COUNT(CASE WHEN is_anonymous = true THEN 1 END) as anonymous_ratings
      FROM ratings r
      JOIN courses c ON r.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    const role = (req.user.role || '').toLowerCase();
    if (role === 'lecturer') {
      query += ` AND c.lecturer_id = $1`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $1`;
      params.push(req.user.faculty_name);
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Rating analytics error:', err);
    res.status(500).json({ error: 'Server error fetching rating analytics' });
  }
});

// ------------------ NEW: GET course rating distribution ------------------
router.get('/course/:courseId/distribution', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    const result = await pool.query(
      `SELECT 
        rating,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ratings WHERE course_id = $1)), 1) as percentage
       FROM ratings 
       WHERE course_id = $1 
       GROUP BY rating 
       ORDER BY rating DESC`,
      [courseId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Rating distribution error:', err);
    res.status(500).json({ error: 'Server error fetching rating distribution' });
  }
});

// ------------------ GET aggregated ratings (Lecturer/PRL/Program Leader) ------------------
router.get('/aggregated', authenticateToken, checkRole(['Lecturer', 'PRL', 'Program Leader']), async (req, res) => {
  try {
    let query = `
      SELECT 
        c.id as course_id,
        c.name as course_name,
        c.code as course_code,
        COALESCE(ROUND(AVG(r.rating),2),0) as average_rating,
        COUNT(r.id) as total_ratings,
        u.username as lecturer_name,
        COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_count,
        COUNT(CASE WHEN r.rating >= 4 THEN 1 END) as positive_ratings
      FROM courses c
      LEFT JOIN ratings r ON c.id = r.course_id
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE 1=1
    `;
    const params = [];

    const role = (req.user.role || '').toLowerCase();
    if (role === 'lecturer') {
      query += ` AND c.lecturer_id = $1`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      query += ` AND c.faculty_name = $1`;
      params.push(req.user.faculty_name);
    }

    query += ' GROUP BY c.id, c.name, c.code, u.username ORDER BY average_rating DESC NULLS LAST';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Aggregated ratings error:', err);
    res.status(500).json({ error: 'Server error fetching aggregated ratings' });
  }
});

// ------------------ GET courses list for dropdown ------------------
router.get('/courses/list', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT c.id, c.name, c.code, 
             (SELECT COALESCE(ROUND(AVG(rating), 1), 0) FROM ratings WHERE course_id = c.id) as avg_rating,
             (SELECT COUNT(*) FROM ratings WHERE course_id = c.id) as rating_count
      FROM courses c 
      WHERE 1=1
    `;
    const params = [];

    const role = (req.user.role || '').toLowerCase();
    if (role === 'student') {
      query = `
        SELECT c.id, c.name, c.code,
               (SELECT COALESCE(ROUND(AVG(rating), 1), 0) FROM ratings WHERE course_id = c.id) as avg_rating,
               (SELECT COUNT(*) FROM ratings WHERE course_id = c.id) as rating_count
        FROM courses c
        JOIN enrollment e ON c.id = e.course_id
        WHERE e.student_id = $1
        ORDER BY c.name ASC
      `;
      params.push(req.user.id);
    } else if (role === 'lecturer') {
      query += ` AND lecturer_id = $1 ORDER BY name ASC`;
      params.push(req.user.id);
    } else if (['prl', 'program leader'].includes(role) && req.user.faculty_name) {
      query += ` AND faculty_name = $1 ORDER BY name ASC`;
      params.push(req.user.faculty_name);
    } else {
      query += ' ORDER BY name ASC';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch courses error:', err);
    res.status(500).json({ error: 'Server error fetching courses' });
  }
});

// ------------------ NEW: DELETE rating (Student only) ------------------
router.delete('/:id', authenticateToken, checkRole(['Student']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM ratings WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    result.rowCount === 0 
      ? res.status(404).json({ error: 'Rating not found or access denied' })
      : res.json({ message: 'Rating deleted successfully' });
  } catch (err) {
    console.error('Rating deletion error:', err);
    res.status(500).json({ error: 'Server error deleting rating' });
  }
});

module.exports = router;