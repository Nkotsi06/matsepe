import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axios from 'axios';

const Auth = ({ show, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [role, setRole] = useState('Student');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isClassRep, setIsClassRep] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setEmail('');
    setFacultyName('');
    setRole('Student');
    setIsClassRep(false);
    setSelectedClass('');
  };

  const toggleFormMode = () => {
    setIsRegister(!isRegister);
    setError('');
    resetForm();
  };

  // ---------------- LOGIN ----------------
  const handleLogin = async () => {
    if (!username || !password || !role) {
      setError('Please enter username, password, and role');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await axios.post('https://matsepe.onrender.com/api/auth/login', {
        username,
        password,
        role
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', res.data.role);
      localStorage.setItem('username', res.data.username);
      alert(`✅ Logged in as ${res.data.username} (${res.data.role})`);
      if (onSuccess) onSuccess({ username: res.data.username, role: res.data.role });
      resetForm();
      setIsRegister(false);
      onClose();
    } catch (err) {
      console.error('Login error:', err.response || err);
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // ---------------- REGISTER ----------------
  const handleRegister = async () => {
    // Only allow class representatives to register as students
    if (role === 'Student' && !isClassRep) {
      setError('Only class representatives can register. Please contact your administrator.');
      return;
    }

    if (!username || !password || !email || !role) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await axios.post('https://matsepe.onrender.com/api/auth/register', {
        username,
        password,
        email,
        role,
        faculty_name: facultyName || null,
        is_class_rep: isClassRep,
        class_name: selectedClass
      });
      alert(`✅ Registered successfully: ${res.data.user.username}. You can now login.`);
      resetForm();
      setIsRegister(false);
    } catch (err) {
      console.error('Registration error:', err.response || err);
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>{isRegister ? 'Register' : 'Login'} Required</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form>
          <Form.Group className="mb-2">
            <Form.Label>Username</Form.Label>
            <Form.Control
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </Form.Group>
          {isRegister && (
            <>
              <Form.Group className="mb-2">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </Form.Group>
              
              {/* Class Representative Check for Students */}
              {role === 'Student' && (
                <>
                  <Form.Group className="mb-2">
                    <Form.Check
                      type="checkbox"
                      label="I am a class representative"
                      checked={isClassRep}
                      onChange={e => setIsClassRep(e.target.checked)}
                    />
                  </Form.Group>
                  
                  {isClassRep && (
                    <Form.Group className="mb-2">
                      <Form.Label>Select Your Class</Form.Label>
                      <Form.Select
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                      >
                        <option value="">-- Select Class --</option>
                        <option value="Year 1 - Computing">Year 1 - Computing</option>
                        <option value="Year 2 - Computing">Year 2 - Computing</option>
                        <option value="Year 3 - Computing">Year 3 - Computing</option>
                        <option value="Year 1 - Business">Year 1 - Business</option>
                        <option value="Year 2 - Business">Year 2 - Business</option>
                        <option value="Year 3 - Business">Year 3 - Business</option>
                        <option value="Year 1 - Design">Year 1 - Design</option>
                        <option value="Year 2 - Design">Year 2 - Design</option>
                        <option value="Year 3 - Design">Year 3 - Design</option>
                      </Form.Select>
                    </Form.Group>
                  )}
                </>
              )}
              
              <Form.Group className="mb-2">
                <Form.Label>Faculty Name (optional)</Form.Label>
                <Form.Control
                  value={facultyName}
                  onChange={e => setFacultyName(e.target.value)}
                />
              </Form.Group>
            </>
          )}
          <Form.Group className="mb-2">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Role</Form.Label>
            <Form.Select value={role} onChange={e => setRole(e.target.value)}>
              <option value="Student">Student</option>
              <option value="Lecturer">Lecturer</option>
              <option value="PRL">Principal Lecturer</option>
              <option value="PL">Program Leader</option>
              <option value="FMG">Faculty Management</option>
            </Form.Select>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        {!isRegister ? (
          <>
            <Button variant="secondary" onClick={toggleFormMode}>
              Register
            </Button>
            <Button variant="primary" onClick={handleLogin} disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={toggleFormMode}>
              Back to Login
            </Button>
            <Button variant="success" onClick={handleRegister} disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};
export default Auth;