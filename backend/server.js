const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');
const Subject = require('./models/Subject');

const app = express();

// Initialize Gemini
let genAI;
let model;

try {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables');
  } else {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log('Gemini Flash 2.0 initialized successfully');
  }
} catch (error) {
  console.error('Error initializing Gemini Flash 2.0:', error);
}

// Connect to MongoDB
connectDB()
  .then(() => {
    console.log('MongoDB connection established in server.js');
    
    // Log environment variables (without sensitive data)
    console.log('Environment check:');
    console.log('- MONGO_URI:', process.env.MONGO_URI ? 'Set' : 'Not set');
    console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
    console.log('- PORT:', process.env.PORT || 5000);
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB in server.js:', err);
  });

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });

    if (!user) {
      throw new Error();
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

// Email configuration (commented out for development)
/*
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
*/

// Signup route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, phoneNumber } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email and password are required' });
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === email.toLowerCase() 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: firstName || '',
      lastName: lastName || '',
      phoneNumber: phoneNumber || ''
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});


// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    user.lastLogin = Date.now();
    await user.save();

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Get authenticated user info
app.get('/api/auth/user', auth, async (req, res) => {
  try {
    res.json({
      email: req.user.email,
      createdAt: req.user.createdAt,
      lastLogin: req.user.lastLogin
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();

    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;

    /*
    await transporter.sendMail({
      to: email,
      subject: 'Password Reset',
      html: `Click <a href="${resetLink}">here</a> to reset your password.`
    });
    */

    res.json({ message: 'Password reset link sent to email' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending reset email' });
  }
});

// Reset password
app.post('/api/auth/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// Generate content route
app.post('/api/subjects/:subjectId/subtopics/:subtopicId/generate', auth, async (req, res) => {
  try {
    const { subjectId, subtopicId } = req.params;
    
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const subtopic = subject.subtopics.id(subtopicId);
    if (!subtopic) {
      return res.status(404).json({ message: 'Subtopic not found' });
    }

    if (!model) {
      return res.status(500).json({ message: 'Gemini Flash 2.0 model not initialized. Please check your API key configuration.' });
    }

    // Enhanced prompt for better content generation
    const prompt = `Generate comprehensive educational content about "${subtopic.name}" in the context of "${subject.name}".
    
    Please structure the content in the following format using proper markdown:

    # ${subtopic.name}

    ## Overview
    [Provide a brief introduction and overview of the topic]

    ## Key Concepts
    [List and explain the main concepts with clear definitions]

    ## Detailed Explanation
    [Provide detailed explanations with examples]

    ## Examples
    [Include practical examples with code snippets if applicable]

    ## Best Practices
    [List important best practices and tips]

    ## Common Mistakes
    [Highlight common mistakes and how to avoid them]

    ## Summary
    [Provide a concise summary of the key points]

    Please ensure:
    1. Use proper markdown formatting for headings, lists, and code blocks
    2. Include relevant examples and code snippets where appropriate
    3. Make the content engaging and easy to understand
    4. Use bullet points and numbered lists for better readability
    5. Include practical applications and real-world examples`;

    console.log('Generating content with enhanced prompt for:', subtopic.name);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let generatedContent = response.text();

    // Replace any occurrences of "Common Pitfalls" with "Common Mistakes"
    generatedContent = generatedContent.replace(/## Common Pitfalls/g, '## Common Mistakes');

    console.log('Content generated successfully for:', subtopic.name);

    subtopic.content = generatedContent;
    subtopic.generated = true;
    await subject.save();

    res.json({ content: generatedContent });
  } catch (error) {
    console.error('Error in content generation:', error);
    res.status(500).json({ 
      message: 'Error generating content',
      error: error.message 
    });
  }
});

// Get subject by ID
app.get('/api/subjects/:subjectId', auth, async (req, res) => {
  try {
    const { subjectId } = req.params;
    
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    res.json(subject);
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ message: 'Error fetching subject data' });
  }
});

// Get all subjects
app.get('/api/subjects', auth, async (req, res) => {
  try {
    const subjects = await Subject.find({});
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: 'Error fetching subjects' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('MONGO_URI:', process.env.MONGO_URI);