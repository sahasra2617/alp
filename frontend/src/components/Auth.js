import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import './Auth.css';

function Auth() {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);
    return () => clearTimeout(timer);
  }, [error, success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (mode === 'signup') {
      if (!username.trim()) {
        setError('Username is required');
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        setIsLoading(false);
        return;
      }
      try {
        const response = await axios.post(`${config.apiBaseUrl}/auth/signup`, { username, email, password });
        setSuccess('Account created successfully!');
        setTimeout(() => {
          setMode('login');
          setSuccess('');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setUsername('');
        }, 1500);
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'An error occurred during signup';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    } else {
      try {
        const response = await axios.post(`${config.apiBaseUrl}/auth/login`, { email, password });
        if (response.data && response.data.token) {
          localStorage.setItem('token', response.data.token);
          setSuccess('Login successful!!!');
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
        } else {
          setError('Invalid response from server');
        }
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'An error occurred during login';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="auth-outer-container">
      <div className="auth-container">
        <h2 className="auth-title">{mode === 'login' ? 'Login Form' : 'Signup Form'}</h2>
        <div className="auth-toggle">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
            type="button"
          >
            Signup
          </button>
        </div>
        <form
          className={`auth-form ${mode === 'login' ? 'slide-in-left' : 'slide-in-right'}`}
          onSubmit={handleSubmit}
        >
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
            />
          )}
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
          {mode === 'signup' && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          )}
          {mode === 'login' && (
            <div className="forgot-link-row">
              <a href="/forgot-password" className="forgot-link">Forgot password?</a>
            </div>
          )}
          <button type="submit" disabled={isLoading}>
            {isLoading ? (mode === 'login' ? 'Logging in...' : 'Creating Account...') : (mode === 'login' ? 'Login' : 'Signup')}
          </button>
        </form>
        <div className="auth-links">
          {mode === 'login' ? (
            <span>Not a member? <button className="link-btn" onClick={() => setMode('signup')}>Signup now</button></span>
          ) : (
            <span>Already have an account? <button className="link-btn" onClick={() => setMode('login')}>Login</button></span>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth; 