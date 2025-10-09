// backend/routes/classes.js

const express = require('express');
const pool = require('../db');
const { authenticateToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// ------------------ GET all classes with enhanced filtering and search ------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        c.*, 
        co.name AS course_name, 
        co.code AS course_code,
        co.credits AS course_credits,
        u.username AS lecturer_name,
        u.email AS lecturer_email,
        co.faculty_name,
        co.department,
        COUNT(DISTINCT ca.id) AS attendance_count,
        COUNT(DISTINCT cm.id) AS materials_count
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON c.lecturer_id = u.id
      LEFT JOIN class_attendance ca ON c.id = ca.class_id
      LEFT JOIN class_materials cm ON c.id = cm.class_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'Lecturer') {
      paramCount++;
      query += ` AND c.lecturer_id = $${paramCount}`;
      params.push(req.user.id);
    } else if (['PRL', 'Program Leader'].includes(req.user.role) && req.user.faculty_name) {
      paramCount++;
      query += ` AND co.faculty_name = $${paramCount}`;
      params.push(req.user.faculty_name);
    }

    // Student view - only show classes for enrolled courses
    if (req.user.role === 'Student') {
      paramCount++;
      query += ` AND co.id IN (
        SELECT course_id FROM student_courses 
        WHERE student_id = $${paramCount} AND status = 'Enrolled'
      )`;
      params.push(req.user.id);
    }

    // Date filtering
    if (req.query.start_date && req.query.end_date) {
      paramCount++;
      query += ` AND c.date BETWEEN $${paramCount}`;
      params.push(req.query.start_date);
      
      paramCount++;
      query += ` AND $${paramCount}`;
      params.push(req.query.end_date);
    } else if (req.query.date) {
      paramCount++;
      query += ` AND c.date = $${paramCount}`;
      params.push(req.query.date);
    }

    // Course filtering
    if (req.query.course_id) {
      paramCount++;
      query += ` AND c.course_id = $${paramCount}`;
      params.push(req.query.course_id);
    }

    // Lecturer filtering
    if (req.query.lecturer_id) {
      paramCount++;
      query += ` AND c.lecturer_id = $${paramCount}`;
      params.push(req.query.lecturer_id);
    }

    // Search functionality
    if (req.query.search) {
      paramCount++;
      query += ` AND (
        co.name ILIKE $${paramCount} OR 
        co.code ILIKE $${paramCount} OR 
        c.topic ILIKE $${paramCount} OR
        c.room ILIKE $${paramCount} OR
        u.username ILIKE $${paramCount}
      )`;
      params.push(`%${req.query.search}%`);
    }

    // Status filtering
    if (req.query.status) {
      paramCount++;
      query += ` AND c.status = $${paramCount}`;
      params.push(req.query.status);
    }

    query += ' GROUP BY c.id, co.name, co.code, co.credits, u.username, u.email, co.faculty_name, co.department';
    query += ' ORDER BY c.date DESC, c.time ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Classes fetch error:', err);
    res.status(500).json({ error: 'Server error fetching classes' });
  }
});

// ------------------ GET single class by ID with detailed information ------------------
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const classQuery = `
      SELECT 
        c.*, 
        co.name AS course_name, 
        co.code AS course_code,
        co.description AS course_description,
        co.credits AS course_credits,
        u.username AS lecturer_name,
        u.email AS lecturer_email,
        u.phone AS lecturer_phone,
        co.faculty_name,
        co.department,
        COUNT(DISTINCT ca.id) AS attendance_count,
        COUNT(DISTINCT cm.id) AS materials_count
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON c.lecturer_id = u.id
      LEFT JOIN class_attendance ca ON c.id = ca.class_id
      LEFT JOIN class_materials cm ON c.id = cm.class_id
      WHERE c.id = $1
      GROUP BY c.id, co.name, co.code, co.description, co.credits, u.username, u.email, u.phone, co.faculty_name, co.department
    `;

    const result = await pool.query(classQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const classData = result.rows[0];

    // Get attendance records if user has permission
    let attendanceRecords = [];
    if (['Program Leader', 'PRL', 'Lecturer'].includes(req.user.role) || 
        (req.user.role === 'Student' && classData.lecturer_id === req.user.id)) {
      
      const attendanceQuery = `
        SELECT 
          ca.*,
          u.username AS student_name,
          u.email AS student_email,
          u.student_id AS student_number
        FROM class_attendance ca
        JOIN users u ON ca.student_id = u.id
        WHERE ca.class_id = $1
        ORDER BY u.username ASC
      `;
      const attendanceResult = await pool.query(attendanceQuery, [id]);
      attendanceRecords = attendanceResult.rows;
    }

    // Get class materials
    const materialsQuery = `
      SELECT 
        cm.*,
        u.username AS uploaded_by_name
      FROM class_materials cm
      LEFT JOIN users u ON cm.uploaded_by = u.id
      WHERE cm.class_id = $1
      ORDER BY cm.uploaded_at DESC
    `;
    const materialsResult = await pool.query(materialsQuery, [id]);

    // Check if current student is enrolled and get their attendance status
    let studentAttendance = null;
    if (req.user.role === 'Student') {
      const studentAttendanceQuery = `
        SELECT status, notes 
        FROM class_attendance 
        WHERE class_id = $1 AND student_id = $2
      `;
      const studentAttendanceResult = await pool.query(studentAttendanceQuery, [id, req.user.id]);
      studentAttendance = studentAttendanceResult.rows[0] || null;
    }

    const detailedClassData = {
      ...classData,
      attendance_records: attendanceRecords,
      materials: materialsResult.rows,
      student_attendance: studentAttendance
    };

    res.json(detailedClassData);
  } catch (err) {
    console.error('Class fetch error:', err);
    res.status(500).json({ error: 'Server error fetching class' });
  }
});

// ------------------ POST create class (Program Leader/PRL/Lecturer with ownership) ------------------
router.post('/', authenticateToken, checkRole(['Program Leader', 'PRL', 'Lecturer']), async (req, res) => {
  try {
    const { 
      course_id, 
      lecturer_id, 
      date, 
      time, 
      duration, 
      room, 
      topic, 
      description,
      class_type = 'Regular',
      max_capacity,
      recurring_pattern,
      end_date
    } = req.body;

    if (!course_id || !date || !time || !room) {
      return res.status(400).json({ 
        error: 'Required fields: course_id, date, time, room' 
      });
    }

    // Authorization check for Lecturers
    if (req.user.role === 'Lecturer' && lecturer_id !== req.user.id) {
      return res.status(403).json({ 
        error: 'Lecturers can only create classes for themselves' 
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify course access
      let courseCheckQuery = 'SELECT id, faculty_name, lecturer_id FROM courses WHERE id = $1';
      let courseCheckParams = [course_id];

      if (req.user.role === 'Lecturer') {
        courseCheckQuery += ' AND lecturer_id = $2';
        courseCheckParams.push(req.user.id);
      } else if (['PRL', 'Program Leader'].includes(req.user.role)) {
        courseCheckQuery += ' AND faculty_name = $2';
        courseCheckParams.push(req.user.faculty_name);
      }

      const courseCheck = await client.query(courseCheckQuery, courseCheckParams);

      if (courseCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Course not found or access denied' });
      }

      // Check for scheduling conflicts
      const conflictCheck = await client.query(
        `SELECT id FROM classes 
         WHERE room = $1 AND date = $2 AND time = $3 
         AND (status IS NULL OR status != 'Cancelled')`,
        [room, date, time]
      );

      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Scheduling conflict: Room already booked at this time' 
        });
      }

      const result = await client.query(
        `INSERT INTO classes (
          course_id, lecturer_id, date, time, duration, room, topic, 
          description, class_type, max_capacity, recurring_pattern, 
          end_date, created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Scheduled') 
        RETURNING *`,
        [
          course_id, lecturer_id, date, time, duration, room, topic,
          description, class_type, max_capacity, recurring_pattern,
          end_date, req.user.id
        ]
      );

      // Log activity
      await client.query(
        `INSERT INTO class_activities (
          class_id, activity_type, description, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [
          result.rows[0].id,
          'class_created',
          `Class scheduled for ${date} at ${time} in ${room}`,
          req.user.id
        ]
      );

      await client.query('COMMIT');

      res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Class creation error:', err);
    res.status(500).json({ error: 'Server error creating class' });
  }
});

// ------------------ PUT update class ------------------
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      course_id, lecturer_id, date, time, duration, room, topic, 
      description, class_type, max_capacity, status 
    } = req.body;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if class exists and user has permission
      const classCheck = await client.query(
        `SELECT c.*, co.faculty_name, co.lecturer_id AS course_lecturer_id 
         FROM classes c
         JOIN courses co ON c.course_id = co.id
         WHERE c.id = $1`,
        [id]
      );

      if (classCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Class not found' });
      }

      const classRecord = classCheck.rows[0];

      // Authorization check
      if (req.user.role === 'Lecturer' && classRecord.lecturer_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied. You can only update your own classes.' });
      }

      if (req.user.role === 'PRL' && classRecord.faculty_name !== req.user.faculty_name) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied. You can only update classes in your faculty.' });
      }

      // Check for scheduling conflicts (excluding current class)
      if (room && date && time) {
        const conflictCheck = await client.query(
          `SELECT id FROM classes 
           WHERE room = $1 AND date = $2 AND time = $3 AND id != $4
           AND (status IS NULL OR status != 'Cancelled')`,
          [room, date, time, id]
        );

        if (conflictCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: 'Scheduling conflict: Room already booked at this time' 
          });
        }
      }

      const result = await client.query(
        `UPDATE classes 
         SET course_id = $1, lecturer_id = $2, date = $3, time = $4, 
             duration = $5, room = $6, topic = $7, description = $8,
             class_type = $9, max_capacity = $10, status = $11, updated_at = NOW()
         WHERE id = $12 
         RETURNING *`,
        [
          course_id, lecturer_id, date, time, duration, room, topic,
          description, class_type, max_capacity, status, id
        ]
      );

      // Log activity
      await client.query(
        `INSERT INTO class_activities (
          class_id, activity_type, description, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [
          id,
          'class_updated',
          `Class details updated`,
          req.user.id
        ]
      );

      await client.query('COMMIT');

      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Class update error:', err);
    res.status(500).json({ error: 'Server error updating class' });
  }
});

// ------------------ DELETE class ------------------
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if class exists and user has permission
      const classCheck = await client.query(
        `SELECT c.*, co.faculty_name 
         FROM classes c
         JOIN courses co ON c.course_id = co.id
         WHERE c.id = $1`,
        [id]
      );

      if (classCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Class not found' });
      }

      const classRecord = classCheck.rows[0];

      // Authorization check
      if (req.user.role === 'Lecturer' && classRecord.lecturer_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied. You can only delete your own classes.' });
      }

      if (req.user.role === 'PRL' && classRecord.faculty_name !== req.user.faculty_name) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied. You can only delete classes in your faculty.' });
      }

      // Check for dependencies
      const hasAttendance = await client.query(
        'SELECT 1 FROM class_attendance WHERE class_id = $1 LIMIT 1',
        [id]
      );

      const hasMaterials = await client.query(
        'SELECT 1 FROM class_materials WHERE class_id = $1 LIMIT 1',
        [id]
      );

      if (hasAttendance.rows.length > 0 || hasMaterials.rows.length > 0) {
        // Instead of deleting, mark as cancelled
        const result = await client.query(
          'UPDATE classes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          ['Cancelled', id]
        );

        // Log activity
        await client.query(
          `INSERT INTO class_activities (
            class_id, activity_type, description, created_by
          ) VALUES ($1, $2, $3, $4)`,
          [
            id,
            'class_cancelled',
            `Class cancelled due to dependencies`,
            req.user.id
          ]
        );

        await client.query('COMMIT');
        return res.json({ message: 'Class cancelled successfully', class: result.rows[0] });
      }

      // Log activity before deletion
      await client.query(
        `INSERT INTO class_activities (
          class_id, activity_type, description, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [
          id,
          'class_deleted',
          `Class deleted`,
          req.user.id
        ]
      );

      await client.query('DELETE FROM classes WHERE id = $1', [id]);

      await client.query('COMMIT');

      res.json({ message: 'Class deleted successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Class deletion error:', err);
    res.status(500).json({ error: 'Server error deleting class' });
  }
});

// ------------------ PATCH update class status ------------------
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Scheduled', 'Completed', 'Cancelled', 'Postponed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if class exists and user has permission
      const classCheck = await client.query(
        `SELECT c.*, co.faculty_name 
         FROM classes c
         JOIN courses co ON c.course_id = co.id
         WHERE c.id = $1`,
        [id]
      );

      if (classCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Class not found' });
      }

      const classRecord = classCheck.rows[0];

      // Authorization check
      if (req.user.role === 'Lecturer' && classRecord.lecturer_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied. You can only update your own classes.' });
      }

      if (req.user.role === 'PRL' && classRecord.faculty_name !== req.user.faculty_name) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied. You can only update classes in your faculty.' });
      }

      const result = await client.query(
        'UPDATE classes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, id]
      );

      // Log activity
      await client.query(
        `INSERT INTO class_activities (
          class_id, activity_type, description, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [
          id,
          'status_updated',
          `Class status changed to ${status}`,
          req.user.id
        ]
      );

      await client.query('COMMIT');

      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Class status update error:', err);
    res.status(500).json({ error: 'Server error updating class status' });
  }
});

// ------------------ GET class statistics ------------------
router.get('/:id/statistics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if class exists and user has permission
    const classCheck = await pool.query(
      `SELECT c.*, co.faculty_name 
       FROM classes c
       JOIN courses co ON c.course_id = co.id
       WHERE c.id = $1`,
      [id]
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const classRecord = classCheck.rows[0];

    // Authorization check
    if (req.user.role === 'Lecturer' && classRecord.lecturer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'PRL' && classRecord.faculty_name !== req.user.faculty_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get statistics
    const statisticsQuery = `
      SELECT 
        COUNT(DISTINCT ca.student_id) AS total_attendance,
        COUNT(DISTINCT cm.id) AS total_materials,
        COUNT(DISTINCT CASE WHEN ca.status = 'Present' THEN ca.student_id END) AS present_count,
        COUNT(DISTINCT CASE WHEN ca.status = 'Absent' THEN ca.student_id END) AS absent_count,
        COUNT(DISTINCT CASE WHEN ca.status = 'Late' THEN ca.student_id END) AS late_count,
        AVG(EXTRACT(EPOCH FROM (ca.updated_at - ca.created_at))) AS avg_attendance_time
      FROM classes c
      LEFT JOIN class_attendance ca ON c.id = ca.class_id
      LEFT JOIN class_materials cm ON c.id = cm.class_id
      WHERE c.id = $1
      GROUP BY c.id
    `;

    const statisticsResult = await pool.query(statisticsQuery, [id]);

    res.json(statisticsResult.rows[0] || {});
  } catch (err) {
    console.error('Class statistics error:', err);
    res.status(500).json({ error: 'Server error fetching class statistics' });
  }
});

module.exports = router;