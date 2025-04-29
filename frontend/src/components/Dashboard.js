import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogout, setShowLogout] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const unfinishedCourses = [
    {
      id: 1,
      title: "Learning how to create simple Swift applications in 8 lessons",
      instructor: "Dianne Edwards",
      username: "@dianneed",
      duration: "82 min",
      image: "/images/swift-course.jpg"
    },
    {
      id: 2,
      title: "Best tips for drawing some good thematic illustration",
      instructor: "Dianne Edwards",
      username: "@dianneed",
      duration: "90 min",
      image: "/images/illustration-course.jpg"
    }
  ];

  // Fetch subjects from API
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication required. Please log in.');
          return;
        }
        
        const response = await fetch('/api/subjects', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication failed. Please log in again.');
          } else {
            throw new Error(`Server error: ${response.status}`);
          }
        }
        
        const data = await response.json();
        
        // Map the API data to the format expected by the component
        const formattedSubjects = data.map(subject => ({
          id: subject._id,
          name: subject.name,
          icon: getSubjectIcon(subject.name),
          color: getSubjectColor(subject.name),
          background: getSubjectBackground(subject.name),
          subtopics: subject.subtopics.map(subtopic => ({ name: subtopic.name }))
        }));
        
        setSubjects(formattedSubjects);
      } catch (error) {
        setError(`Error loading subjects: ${error.message}`);
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSubjects();
  }, []);
  
  // Helper functions to get subject styling
  const getSubjectIcon = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('java')) {
      return "https://cdn-icons-png.flaticon.com/512/226/226777.png";
    } else if (lowerName.includes('python')) {
      return "https://cdn-icons-png.flaticon.com/512/5968/5968350.png";
    } else if (lowerName.includes('math')) {
      return "https://cdn-icons-png.flaticon.com/512/2103/2103633.png";
    } else {
      return "https://cdn-icons-png.flaticon.com/512/2103/2103633.png";
    }
  };
  
  const getSubjectColor = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('java')) {
      return "#f89820";
    } else if (lowerName.includes('python')) {
      return "#4B8BBE";
    } else if (lowerName.includes('math')) {
      return "#4CAF50";
    } else {
      return "#512888";
    }
  };
  
  const getSubjectBackground = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('java')) {
      return "linear-gradient(135deg,rgb(236, 211, 181) 0%,rgb(195, 124, 124) 100%)";
    } else if (lowerName.includes('python')) {
      return "linear-gradient(135deg,rgb(181, 211, 236) 0%,rgb(124, 195, 195) 100%)";
    } else if (lowerName.includes('math')) {
      return "linear-gradient(135deg,rgb(181, 236, 211) 0%,rgb(124, 195, 124) 100%)";
    } else {
      return "linear-gradient(135deg,rgb(211, 181, 236) 0%,rgb(124, 124, 195) 100%)";
    }
  };

  const subjectData = {
    java: {
      name: "Java Programming",
      subtopics: ["Variables", "Loops", "Arrays", "Methods", "Classes"]
    },
    mathematics: {
      name: "Mathematics",
      subtopics: ["Addition", "Subtraction", "Multiplication", "Division", "Fractions"]
    },
    python:{
      name: "Python",
      subtopics: ["Introduction to Python", "Variables and Data Types", "Control Structures", "Functions and Modules", "Object-Oriented Programming"]
    },
    science: {
      name: "Science",
      subtopics: ["Plants", "Animals", "Matter", "Energy", "Earth"]
    },
    english: {
      name: "English",
      subtopics: ["Nouns", "Verbs", "Sentences", "Punctuation", "Vocabulary"]
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const toggleLogout = () => {
    setShowLogout(!showLogout);
  };

  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    setShowModal(true);
  };

  const handleSubtopicClick = (subtopicIndex) => {
    navigate(`/subject/${selectedSubject.id}`, { 
      state: { selectedSubtopic: subtopicIndex } 
    });
  };

  return (
    <div className="eduera-dashboard">
      <div className="sidebar">
        <div className="logo">
          <div className="logo-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <span>EduEra</span>
        </div>
        <div className="nav-menu">
          <ul>
            <li className="active">
              <i className="fas fa-home"></i>
              <span>Dashboard</span>
            </li>
            <li>
              <i className="fas fa-book"></i>
              <span>My Courses</span>
            </li>
            <li>
              <i className="fas fa-chart-bar"></i>
              <span>Progress</span>
            </li>
            <li>
              <i className="fas fa-cog"></i>
              <span>Settings</span>
            </li>
          </ul>
        </div>
        <button className="start-btn">
          <i className="fas fa-play"></i>
          <span>Start Learning</span>
        </button>
      </div>
      <div className="main-content">
        <div className="header">
          <div className="search-bar">
            <i className="fas fa-search"></i>
            <input 
              type="text" 
              placeholder="Search for courses..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="header-right">
            <div className="user-profile-container">
              <button className="user-profile-btn" onClick={toggleLogout}>
                <i className="fas fa-user"></i>
              </button>
              {showLogout && (
                <div className="logout-dropdown">
                  <button onClick={handleLogout}>
                    <i className="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
            <button className="chat-btn">
              <i className="fas fa-comments"></i>
            </button>
          </div>
        </div>
        
        <div className="section-header">
          <h2>Continue Learning</h2>
          <button className="more-options">
            <i className="fas fa-ellipsis-h"></i>
          </button>
        </div>
        
        <div className="courses-grid">
          {unfinishedCourses.map(course => (
            <div key={course.id} className="course-card">
              <div className="course-image" style={{ backgroundImage: `url(${course.image})` }}>
                <div className="course-overlay">
                  <div className="instructor-info">
                    <img src="/images/instructor.jpg" alt="Instructor" />
                    <div className="instructor-text">
                      <h4>{course.instructor}</h4>
                      <p>{course.username}</p>
                    </div>
                  </div>
                  <div className="duration">{course.duration}</div>
                </div>
                <h3>{course.title}</h3>
              </div>
            </div>
          ))}
        </div>
        
        <div className="section-header">
          <h2>Subjects</h2>
          <button className="more-options">
            <i className="fas fa-ellipsis-h"></i>
          </button>
        </div>
        
        {isLoading ? (
          <div className="loading">Loading subjects...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <div className="subjects-container">
            <div className="subjects-grid">
              {subjects.map(subject => (
                <div 
                  key={subject.id} 
                  className="subject-card" 
                  style={{ background: subject.background }}
                  onClick={() => handleSubjectClick(subject)}
                >
                  <div className="subject-content">
                    <img src={subject.icon} alt={subject.name} />
                    <h3>{subject.name}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {showModal && selectedSubject && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="subtopics-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedSubject.name}</h2>
                <button className="close-btn" onClick={() => setShowModal(false)}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="subtopics-list">
                {selectedSubject.subtopics.map((subtopic, index) => (
                  <div 
                    key={index} 
                    className="subtopic-item"
                    onClick={() => handleSubtopicClick(index)}
                  >
                    <div className="rank">{index + 1}</div>
                    <div className="subtopic-name">{subtopic.name}</div>
                  </div>
                ))}
              </div>
              <button className="records-btn">
                <i className="fas fa-chart-line"></i>
                View Records
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard; 