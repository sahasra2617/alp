import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './SubjectDetails.css';

function SubjectDetails() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedSubtopic, setSelectedSubtopic] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState(null);

  // Fetch subject data when component mounts
  useEffect(() => {
    fetchSubjectData();
  }, [subjectId]);

  // Use effect to handle subtopic selection from popup
  useEffect(() => {
    if (location.state?.selectedSubtopic !== undefined) {
      setSelectedSubtopic(location.state.selectedSubtopic);
    }
  }, [location.state]);

  const fetchSubjectData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in.');
        return;
      }
      
      const response = await fetch(`/api/subjects/${subjectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Subject not found');
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      }
      
      const data = await response.json();
      setSubject(data);
    } catch (error) {
      setError(`Error loading subject data: ${error.message}`);
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateContent = async (subtopicId) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/subjects/${subjectId}/subtopics/${subtopicId}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to generate content');
      
      const data = await response.json();
      
      setSubject(prevSubject => ({
        ...prevSubject,
        subtopics: prevSubject.subtopics.map((subtopic, index) => 
          index === selectedSubtopic ? { ...subtopic, content: data.content, generated: true } : subtopic
        )
      }));

      setShowContent(true);
    } catch (error) {
      setError('Error generating content');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 150));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleSubtopicClick = (index) => {
    setSelectedSubtopic(index);
    setShowContent(false);
  };

  const handleBack = () => {
    if (showContent) {
      setShowContent(false);
    } else {
      navigate('/dashboard');
    }
  };

  const handleReadContent = () => {
    const currentSubtopic = subject?.subtopics[selectedSubtopic];
    if (currentSubtopic && !currentSubtopic.generated) {
      generateContent(currentSubtopic._id);
    } else {
      setShowContent(true);
    }
  };

  const handleStartQuiz = () => {
    navigate(`/quiz/${subjectId}/${selectedSubtopic}`);
  };

  if (!subject) {
    return <div className="loading">Loading...</div>;
  }

  const currentSubtopic = subject.subtopics[selectedSubtopic] || subject.subtopics[0];

  return (
    <div className="subject-details-container dashboard-fade-in">
      <div className="subject-details-page">
        <div className="subject-header">
          <div className="header-left">
            <button className="nav-btn" onClick={handleBack}>
              <i className="fas fa-arrow-left"></i>
            </button>
          </div>
          <div className="header-right">
            <button className="zoom-btn" onClick={handleZoomOut}>
              <i className="fas fa-search-minus"></i>
            </button>
            <span className="zoom-level">{zoomLevel}%</span>
            <button className="zoom-btn" onClick={handleZoomIn}>
              <i className="fas fa-search-plus"></i>
            </button>
          </div>
        </div>
        <div className="main-container">
          <div className="action-sidebar">
            <h2 className="sidebar-title">{subject.name}</h2>
            <div className="subtopics-list">
              {subject.subtopics.map((subtopic, index) => (
                <button 
                  key={index} 
                  className={`subtopic-btn ${index === selectedSubtopic ? 'active' : ''}`}
                  onClick={() => handleSubtopicClick(index)}
                >
                  {subtopic.name}
                </button>
              ))}
            </div>
            {!showContent && (
              <button className="read-btn" onClick={handleReadContent}>
                Read Content
              </button>
            )}
          </div>
          <div className="content-area">
            <div className="document-content" style={{ fontSize: `${zoomLevel}%` }}>
              <div className="document-header">
                <h1 className="document-title">{subject.name.toUpperCase()}</h1>
                <h4 className="subtopic-title">TOPIC- {currentSubtopic.name.toUpperCase()}</h4>
              </div>
              <div className="document-body">
                {isLoading ? (
                  <div className="loading">Generating content...</div>
                ) : error ? (
                  <div className="error">{error}</div>
                ) : showContent ? (
                  <>
                    {currentSubtopic.content.split('\n\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                    <div className="quiz-button-container">
                      <button className="quiz-button" onClick={handleStartQuiz}>
                        Take Quiz 
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="content-placeholder">
                    <p>Click "Read Content" to generate and view the content for this topic.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubjectDetails; 