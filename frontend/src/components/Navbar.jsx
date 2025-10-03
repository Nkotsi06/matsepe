import React from 'react';
import { Navbar as BootstrapNavbar, Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';
const Navbar = () => {
  return (
    <BootstrapNavbar bg="dark" variant="dark" expand="lg" sticky="top" className="w-full px-4">
      <BootstrapNavbar.Brand as={Link} to="/" className="fw-bold">
        LUCT Faculty Reporting System
      </BootstrapNavbar.Brand>
      <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" />
      <BootstrapNavbar.Collapse id="basic-navbar-nav">
        <Nav className="ms-auto">
          <Nav.Link as={Link} to="/">Dashboard</Nav.Link>
          <Nav.Link as={Link} to="/students">Students</Nav.Link>
          <Nav.Link as={Link} to="/lecturers">Lecturers</Nav.Link>
          <Nav.Link as={Link} to="/principal-lecturer">Principal Lecturer</Nav.Link>
          <Nav.Link as={Link} to="/program-leader">Program Leader</Nav.Link>
          <Nav.Link as={Link} to="/reports">Reports</Nav.Link>
          <Nav.Link as={Link} to="/monitoring">Monitoring</Nav.Link>
          <Nav.Link as={Link} to="/rating">Rating</Nav.Link>
        </Nav>
      </BootstrapNavbar.Collapse>
    </BootstrapNavbar>
  );
};
export default Navbar;