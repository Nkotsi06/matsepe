
-- Custom enum type for user roles
CREATE TYPE user_role AS ENUM ('Student', 'Lecturer', 'PRL', 'PL');

-- Users table (for all roles: Student, Lecturer, PRL, PL)
CREATE TABLE Users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Hashed password
    role user_role NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    faculty_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Courses table (for Course Name, Course Code, and stream)
CREATE TABLE Courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    lecturer_id INTEGER REFERENCES Users(id) ON DELETE SET NULL,
    stream VARCHAR(255),
    description TEXT,
    credits INTEGER NOT NULL CHECK (credits >= 0),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Classes table (for Class Name, Venue, Scheduled Lecture Time)
CREATE TABLE Classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    course_id INTEGER NOT NULL,
    venue VARCHAR(255),
    scheduled_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
);

-- Students table (for Total Number of Registered Students, linked to Users)
CREATE TABLE Students (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES Users(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL,
    registered BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (class_id) REFERENCES Classes(id) ON DELETE CASCADE
);

-- Reports table (for Lecturer Reporting Form data)
CREATE TABLE Reports (
    id SERIAL PRIMARY KEY,
    lecturer_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    date DATE NOT NULL,
    week INTEGER NOT NULL CHECK (week > 0),
    actual_students INTEGER NOT NULL CHECK (actual_students >= 0),
    total_students INTEGER NOT NULL CHECK (total_students >= 0),
    topic TEXT,
    learning_outcomes TEXT,
    recommendations TEXT,
    feedback TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'missing')),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (lecturer_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
);

-- Ratings table (for Rating module across roles)
CREATE TABLE Ratings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    rating_type VARCHAR(50) CHECK (rating_type IN ('course', 'lecturer', 'self')),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
);

-- Monitoring table (for Monitoring module, using structured columns instead of JSONB for better querying)
CREATE TABLE Monitoring (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL,
    attendance NUMERIC(5,2) CHECK (attendance >= 0 AND attendance <= 100),
    engagement INTEGER CHECK (engagement >= 0 AND engagement <= 100),
    progress TEXT,
    performance TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
);

-- Role-Specific Stats (optional, for detailed monitoring per role)
CREATE TABLE Role_Stats (
    id SERIAL PRIMARY KEY,
    role user_role NOT NULL,
    course_id INTEGER REFERENCES Courses(id) ON DELETE CASCADE,
    total_reports INTEGER DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    avg_attendance NUMERIC(5,2),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
);

-- Indexes for Performance
CREATE INDEX idx_reports_lecturer_id ON Reports(lecturer_id);
CREATE INDEX idx_ratings_user_id ON Ratings(user_id);
CREATE INDEX idx_courses_lecturer_id ON Courses(lecturer_id);
CREATE INDEX idx_classes_course_id ON Classes(course_id);
CREATE INDEX idx_monitoring_course_id ON Monitoring(course_id);
CREATE INDEX idx_role_stats_role ON Role_Stats(role);




-- Insert sample data into Users
INSERT INTO Users (username, password, role, email, faculty_name) VALUES
('student1', 'password123', 'Student', 'student1@limkokwing.ac.ls', 'Faculty of Information Communication Technology'),
('lecturer1', 'password123', 'Lecturer', 'lecturer1@limkokwing.ac.ls', 'Faculty of Information Communication Technology'),
('prl1', 'password123', 'PRL', 'prl1@limkokwing.ac.ls', 'Faculty of Information Communication Technology'),
('pl1', 'password123', 'PL', 'pl1@limkokwing.ac.ls', 'Faculty of Information Communication Technology');

-- Insert sample data into Courses
INSERT INTO Courses (name, code, lecturer_id, stream, description, credits) VALUES
('Web Application Development', 'DIWA2110', (SELECT id FROM Users WHERE username = 'lecturer1'), 'Diploma in Information Technology', 'Learn React and Node.js', 3),
('Business Information Systems', 'BIST2110', (SELECT id FROM Users WHERE username = 'lecturer1'), 'BSc Degree in Business Information Technology', 'Introduction to BIS', 4);

-- Insert sample data into Classes
INSERT INTO Classes (name, course_id, venue, scheduled_time) VALUES
('Class A', (SELECT id FROM Courses WHERE code = 'DIWA2110'), 'Room 101', '2025-10-01 10:00:00'),
('Class B', (SELECT id FROM Courses WHERE code = 'BIST2110'), 'Room 102', '2025-10-01 14:00:00');

-- Insert sample data into Students
INSERT INTO Students (user_id, class_id, registered) VALUES
((SELECT id FROM Users WHERE username = 'student1'), (SELECT id FROM Classes WHERE name = 'Class A'), TRUE);

-- Insert sample data into Reports
INSERT INTO Reports (lecturer_id, course_id, date, week, actual_students, total_students, topic, learning_outcomes, recommendations, status) VALUES
((SELECT id FROM Users WHERE username = 'lecturer1'), (SELECT id FROM Courses WHERE code = 'DIWA2110'), '2025-09-15', 6, 2, 2, 'Introduction to React', 'Understand React components', 'More practice sessions', 'approved'),
((SELECT id FROM Users WHERE username = 'lecturer1'), (SELECT id FROM Courses WHERE code = 'BIST2110'), '2025-09-16', 6, 1, 1, 'Database Basics', 'Learn SQL queries', 'Review SQL concepts', 'pending');

-- Insert sample feedback from PRL into Reports
UPDATE Reports SET feedback = 'Good progress, continue with examples' WHERE id = 1;

-- Insert sample data into Ratings
INSERT INTO Ratings (user_id, course_id, rating, comment, rating_type) VALUES
((SELECT id FROM Users WHERE username = 'student1'), (SELECT id FROM Courses WHERE code = 'DIWA2110'), 4, 'Great introduction!', 'course'),
((SELECT id FROM Users WHERE username = 'student1'), (SELECT id FROM Courses WHERE code = 'BIST2110'), 3, 'Needs more examples', 'course');

-- Insert sample data into Monitoring
INSERT INTO Monitoring (course_id, attendance, engagement, progress, performance) VALUES
((SELECT id FROM Courses WHERE code = 'DIWA2110'), 100.00, 80, 'On track', 'Excellent'),
((SELECT id FROM Courses WHERE code = 'BIST2110'), 50.00, 60, 'Behind', 'Average');

-- Insert sample data into Role_Stats
INSERT INTO Role_Stats (role, course_id, total_reports, total_ratings, avg_attendance) VALUES
('Lecturer', (SELECT id FROM Courses WHERE code = 'DIWA2110'), 1, 1, 100.00),
('Lecturer', (SELECT id FROM Courses WHERE code = 'BIST2110'), 1, 1, 50.00);
