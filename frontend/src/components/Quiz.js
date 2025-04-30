import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import './Quiz.css';

const Quiz = () => {
  const { subjectId, subtopicId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [subtopic, setSubtopic] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEmotion, setSelectedEmotion] = useState('neutral');
  const [previousQuizData, setPreviousQuizData] = useState(null);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showBreakSuggestion, setShowBreakSuggestion] = useState(false);
  const [consecutiveQuizzes, setConsecutiveQuizzes] = useState(0);
  const [quizHistory, setQuizHistory] = useState([]);
  const [showContentSuggestion, setShowContentSuggestion] = useState(false);
  const [personalizedContent, setPersonalizedContent] = useState(null);
  const [subtopicAttempts, setSubtopicAttempts] = useState(() => {
    // Initialize from localStorage if available
    const savedAttempts = localStorage.getItem('subtopicAttempts');
    return savedAttempts ? JSON.parse(savedAttempts) : {};
  });
  const [quizProgress, setQuizProgress] = useState(() => {
    // Initialize from localStorage if available
    const savedProgress = localStorage.getItem(`quizProgress_${subtopicId}`);
    return savedProgress ? JSON.parse(savedProgress) : null;
  });
  const [subject, setSubject] = useState(null);

  const emotions = [
    { value: 'happy', label: '😊 Happy' },
    { value: 'sad', label: '😢 Sad' },
    { value: 'angry', label: '😠 Angry' },
    { value: 'neutral', label: '😐 Neutral' },
    { value: 'confused', label: '😕 Confused' },
    { value: 'excited', label: '🤩 Excited' }
  ];

  // Timer effect
  useEffect(() => {
    if (quizStartTime && !score) {
      const timer = setInterval(() => {
        const elapsedTime = Math.floor((Date.now() - quizStartTime) / 1000);
        setTimeSpent(elapsedTime);

        // Check for break suggestions
        if (elapsedTime >= 1800) { // 30 minutes
          setShowBreakSuggestion(true);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quizStartTime, score]);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        console.log('Fetching quiz for:', { subjectId, subtopicId });
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication required. Please log in.');
          setLoading(false);
          return;
        }

        // First fetch the subject to get the subtopic
        const subjectResponse = await axios.get(`${config.apiBaseUrl}/subjects/${subjectId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        // Store the subject data
        const subjectData = subjectResponse.data;
        setSubject(subjectData);

        // Find the specific subtopic from the subject's subtopics array
        const foundSubtopic = subjectData.subtopics.find(st => st._id === subtopicId);
        const subtopicIndex = subjectData.subtopics.findIndex(st => st._id === subtopicId);
        
        if (!foundSubtopic) {
          setError('Subtopic not found');
          setLoading(false);
          return;
        }

        setSubtopic(foundSubtopic);

        // Check if there's saved progress
        if (quizProgress) {
          setQuestions(quizProgress.questions);
          setCurrentQuestion(quizProgress.currentQuestion);
          setSelectedAnswers(quizProgress.selectedAnswers);
          setQuizStartTime(quizProgress.quizStartTime);
          setTimeSpent(quizProgress.timeSpent);
          setConsecutiveQuizzes(quizProgress.consecutiveQuizzes);
          setLoading(false);
          return;
        }

        // Fetch quiz questions with previous quiz data if available
        const quizResponse = await axios.get(`${config.apiBaseUrl}/subjects/${subjectId}/subtopics/${subtopicId}/quiz`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            previousScore: previousQuizData?.score,
            previousEmotion: previousQuizData?.emotion,
            previousDifficulty: previousQuizData?.difficulty
          }
        });
        
        console.log('Quiz response:', quizResponse.data);

        if (quizResponse.data && quizResponse.data.questions) {
          setQuestions(quizResponse.data.questions);
          setQuizStartTime(Date.now());
          setConsecutiveQuizzes(prev => prev + 1);
        } else {
          setError('Invalid quiz data received');
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError(`Failed to load quiz questions: ${err.message}`);
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [subjectId, subtopicId, previousQuizData, quizProgress]);

  // Save quiz progress when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (questions.length > 0 && !score) {
        const progress = {
          questions,
          currentQuestion,
          selectedAnswers,
          quizStartTime,
          timeSpent,
          consecutiveQuizzes
        };
        localStorage.setItem(`quizProgress_${subtopicId}`, JSON.stringify(progress));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [questions, currentQuestion, selectedAnswers, quizStartTime, timeSpent, consecutiveQuizzes, subtopicId, score]);

  const handleAnswerSelect = (questionIndex, answer) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: answer
    });
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correctAnswer) {
        correct++;
      }
    });
    return Math.round((correct / questions.length) * 100);
  };

  const calculateSuccessRate = (history) => {
    if (history.length === 0) return 0;
    const successfulQuizzes = history.filter(quiz => quiz.score >= 60).length;
    return (successfulQuizzes / history.length) * 100;
  };

  const handleSubmit = async () => {
    // Ensure all questions are attempted
    if (Object.keys(selectedAnswers).length !== questions.length) {
      setError('Please attempt all questions before submitting');
      return;
    }

    const finalScore = calculateScore();
    setScore(finalScore);

    // Update quiz history and subtopic attempts
    const newQuizHistory = [...quizHistory, {
      score: finalScore,
      emotion: selectedEmotion,
      difficulty: questions[0]?.difficulty || 'medium',
      timestamp: new Date(),
      subtopicId
    }];
    setQuizHistory(newQuizHistory);

    // Update attempts for this specific subtopic
    const currentSubtopicAttempts = (subtopicAttempts[subtopicId] || 0) + 1;
    setSubtopicAttempts(prev => ({
      ...prev,
      [subtopicId]: currentSubtopicAttempts
    }));

    // Check if user needs content review (3 consecutive quizzes with low success rate)
    if (consecutiveQuizzes >= 3) {
      const recentQuizzes = newQuizHistory.slice(-3);
      const successRate = calculateSuccessRate(recentQuizzes);
      if (successRate < 40) { // Less than 40% success rate in last 3 quizzes
        setShowContentSuggestion(true);
      }
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${config.apiBaseUrl}/subjects/${subjectId}/subtopics/${subtopicId}/quiz-results`, {
        score: finalScore,
        emotion: selectedEmotion,
        difficulty: questions[0]?.difficulty || 'medium',
        timeSpent: timeSpent,
        quizHistory: newQuizHistory,
        subtopicAttempts: currentSubtopicAttempts
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setPreviousQuizData({
        score: finalScore,
        emotion: selectedEmotion,
        difficulty: questions[0]?.difficulty || 'medium'
      });

      // Clear saved progress after successful submission
      localStorage.removeItem(`quizProgress_${subtopicId}`);
      setQuizProgress(null);
    } catch (err) {
      setError('Failed to submit quiz results');
      console.error('Error submitting quiz results:', err);
    }
  };

  const handleReadContent = () => {
    // Reset quiz progress and attempts when reviewing content
    localStorage.removeItem(`quizProgress_${subtopicId}`);
    setQuizProgress(null);
    setConsecutiveQuizzes(0);
    
    // Navigate to the personalized content page with all necessary state
    navigate(`/subjects/${subjectId}/subtopics/${subtopicId}/review`, {
      state: {
        quizHistory: quizHistory.filter(q => q.subtopicId === subtopicId),
        currentEmotion: selectedEmotion,
        subtopicAttempts: subtopicAttempts[subtopicId] || 0,
        subjectId,
        subtopicId,
        subtopicName: subtopic?.name || 'Unknown Topic'
      }
    });
  };

  const handleNextQuiz = async () => {
    try {
      // Reset states for next quiz
      setQuestions([]);
      setCurrentQuestion(0);
      setSelectedAnswers({});
      setScore(null);
      setLoading(true);
      setError(null);
      setShowBreakSuggestion(false);

      // Fetch new quiz with previous quiz data
      const token = localStorage.getItem('token');
      const quizResponse = await axios.get(`${config.apiBaseUrl}/subjects/${subjectId}/subtopics/${subtopicId}/quiz`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          previousScore: score,
          previousEmotion: selectedEmotion,
          previousDifficulty: questions[0]?.difficulty || 'medium'
        }
      });

      if (quizResponse.data && quizResponse.data.questions) {
        setQuestions(quizResponse.data.questions);
        setQuizStartTime(Date.now());
        setConsecutiveQuizzes(prev => prev + 1);
        setLoading(false);
      } else {
        setError('Invalid quiz data received');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching next quiz:', err);
      setError(`Failed to load next quiz: ${err.message}`);
      setLoading(false);
    }
  };

  const handleTakeBreak = () => {
    setConsecutiveQuizzes(0);
    navigate(`/subject/${subjectId}`);
  };

  // Update localStorage when subtopicAttempts changes
  useEffect(() => {
    localStorage.setItem('subtopicAttempts', JSON.stringify(subtopicAttempts));
  }, [subtopicAttempts]);

  if (loading) {
    return (
      <div className="quiz-loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading questions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-error">
        <div className="error-message">{error}</div>
        <button className="error-button" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  if (score !== null) {
    return (
      <div className="quiz-results">
        <h2>Quiz Complete!</h2>
        <div className="results-score"><h1>Score: {score}%</h1></div>
        <div className="emotion-selector">
          <label htmlFor="emotion">How did you feel about this quiz?</label>
          <select 
            id="emotion" 
            value={selectedEmotion} 
            onChange={(e) => setSelectedEmotion(e.target.value)}
          >
            {emotions.map(emotion => (
              <option key={emotion.value} value={emotion.value}>
                {emotion.label}
              </option>
            ))}
          </select>
        </div>
        {showContentSuggestion ? (
          <div className="content-suggestion">
            <p>Need help? Let's review the content with a simpler approach.</p>
            <button onClick={handleReadContent}>Review Content</button>
          </div>
        ) : (
          <div className="results-actions">
            <button className="results-button" onClick={handleNextQuiz}>
              Take Next Quiz
            </button>
            <button 
              className="results-button" 
              onClick={() => navigate(`/subject/${subjectId}`, {
                state: { 
                  selectedSubtopic: subtopic?.name,
                  selectedSubtopicIndex: subject?.subtopics.findIndex(st => st._id === subtopicId)
                }
              })}
            >
              Back to Subject
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="quiz">
      <div className="quiz-header">
        <div className="quiz-info">
          <div className="question-number">
            Question {currentQuestion + 1} of {questions.length}
          </div>
          <div className="difficulty-tag">
            Easy
          </div>
        </div>
        <div className="quiz-timer">
          Time: {Math.floor(timeSpent / 60)}:{String(timeSpent % 60).padStart(2, '0')}
        </div>
      </div>

      {questions.length > 0 ? (
        <div className="question-container">
          <div className="question-text">
            {questions[currentQuestion].question}
          </div>
          <div className="options-container">
            {questions[currentQuestion].options.map((option, index) => (
              <button
                key={index}
                className={`option ${selectedAnswers[currentQuestion] === option ? 'selected' : ''}`}
                onClick={() => handleAnswerSelect(currentQuestion, option)}
              >
                <div className="option-label">
                  <div className="option-circle">
                    {String.fromCharCode(65 + index)}
                  </div>
                  {option}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="quiz-error">
          <p>No questions available for this quiz.</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      )}

      {questions.length > 0 && (
        <div className="navigation">
          <button 
            className="nav-button"
            onClick={() => setCurrentQuestion(currentQuestion - 1)}
            disabled={currentQuestion === 0}
          >
            Previous
          </button>
          {currentQuestion < questions.length - 1 ? (
            <button 
              className="nav-button"
              onClick={() => setCurrentQuestion(currentQuestion + 1)}
            >
              Next
            </button>
          ) : (
            <button 
              className="nav-button"
              onClick={handleSubmit}
            >
              Submit
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Quiz; 