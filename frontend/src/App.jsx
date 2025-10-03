import React, { useState } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Lecturers from './components/Lecturers';
import PrincipalLecturer from './components/PrincipalLecturer';
import ProgramLeader from './components/ProgramLeader';
import Reports from './components/Reports';
import Monitoring from './components/Monitoring';
import Rating from './components/Rating';
import backgroundImage from './assets/school.png';

function App() {
  const [authVisible, setAuthVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const handleProtectedAction = (actionName) => {
    setPendingAction(actionName);
    setAuthVisible(true);
  };
  return (
    <Router>
      <div
        className="min-h-screen flex flex-col app-background"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <Navbar />
        <div className="flex-1 content-container">
          <Routes>
            <Route path="/" element={<Dashboard onProtectedAction={handleProtectedAction} />} />
            <Route path="/students" element={<Students onProtectedAction={handleProtectedAction} />} />
            <Route path="/lecturers" element={<Lecturers onProtectedAction={handleProtectedAction} />} />
            <Route path="/principal-lecturer" element={<PrincipalLecturer onProtectedAction={handleProtectedAction} />} />
            <Route path="/program-leader" element={<ProgramLeader onProtectedAction={handleProtectedAction} />} />
            <Route path="/reports" element={<Reports onProtectedAction={handleProtectedAction} />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/rating" element={<Rating onProtectedAction={handleProtectedAction} />} />
          </Routes>
        </div>
        
        <Auth
          show={authVisible}
          action={pendingAction}
          onClose={() => setAuthVisible(false)}
          onSuccess={(user) => {
            localStorage.setItem('role', user.role);
            alert(` Access granted for ${user.role} - ${pendingAction}`);
            setAuthVisible(false);
          }}
        />
        {/* Footer visible on all pages */}
        <footer className="footer">
          <div className="footer-content">
            <p>&copy; 2025 LUCT Faculty Reporting System. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}
export default App;