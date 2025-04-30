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
      username: req.user.username,
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

// Generate quiz questions
app.get('/api/subjects/:subjectId/subtopics/:subtopicId/quiz', auth, async (req, res) => {
  try {
    const { subjectId, subtopicId } = req.params;
    const { previousScore, previousEmotion, previousDifficulty } = req.query;
    console.log('Generating quiz for:', { subjectId, subtopicId, previousScore, previousEmotion, previousDifficulty });
    
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      console.error('Subject not found:', subjectId);
      return res.status(404).json({ message: 'Subject not found' });
    }

    const subtopic = subject.subtopics.id(subtopicId);
    if (!subtopic) {
      console.error('Subtopic not found:', subtopicId);
      return res.status(404).json({ message: 'Subtopic not found' });
    }

    if (!model) {
      console.error('Gemini model not initialized');
      return res.status(500).json({ message: 'Gemini Flash 2.0 model not initialized. Please check your API key configuration.' });
    }

    // Generate difficulty level using Gemini
    const difficultyPrompt = `You are an educational AI assistant. Based on the following information, determine the appropriate difficulty level for the next quiz:

Previous Quiz Data:
- Score: ${previousScore || 'No previous score'}
- Emotion: ${previousEmotion || 'No emotion data'}
- Previous Difficulty: ${previousDifficulty || 'No previous difficulty'}

Please analyze this data and determine the most appropriate difficulty level (easy, medium, or hard) for the next quiz. Consider:
1. If the user scored high (>80%) and was excited/happy, they might be ready for a challenge
2. If the user scored low (<40%) and was confused/sad, they might need an easier level
3. If the user was neutral, maintain the current difficulty unless the score suggests otherwise
4. The goal is to keep the user engaged but not frustrated

Return ONLY a single word: "easy", "medium", or "hard".`;

    console.log('Sending difficulty prompt to Gemini:', difficultyPrompt);
    
    const difficultyResult = await model.generateContent(difficultyPrompt);
    const difficultyResponse = await difficultyResult.response;
    const difficulty = difficultyResponse.text().trim().toLowerCase();
    
    console.log('Gemini determined difficulty:', difficulty);

    // Validate the difficulty level
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      console.error('Invalid difficulty level received:', difficulty);
      throw new Error('Invalid difficulty level generated');
    }

    // Generate quiz questions using Gemini with the determined difficulty
    const quizPrompt = `Generate 5 multiple choice questions about "${subtopic.name}" in the context of "${subject.name}".
    Each question should have 4 options and one correct answer.
    The questions should be of ${difficulty} difficulty level.
    Format the response as a JSON array with the following structure:
    [
      {
        "question": "The question text",
        "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
        "correctAnswer": "The correct option",
        "difficulty": "${difficulty}"
      }
    ]
    
    Requirements:
    1. Questions should test understanding of key concepts
    2. Options should be plausible but only one should be correct
    3. Questions should match the specified difficulty level
    4. Avoid using "All of the above" or "None of the above" as options
    5. Make sure the questions are specific to the topic
    6. Return ONLY the JSON array, no other text`;

    console.log('Sending quiz prompt to Gemini:', quizPrompt);
    
    const result = await model.generateContent(quizPrompt);
    const response = await result.response;
    const generatedText = response.text();
    console.log('Raw Gemini response:', generatedText);

    // Clean up the response to ensure it's valid JSON
    let cleanedText = generatedText.trim();
    // Remove any markdown code block indicators
    cleanedText = cleanedText.replace(/```json\n?|\n?```/g, '');
    // Remove any leading/trailing text that's not part of the JSON
    const jsonMatch = cleanedText.match(/\[.*\]/s);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Gemini');
    }
    cleanedText = jsonMatch[0];

    console.log('Cleaned response:', cleanedText);

    let generatedQuestions;
    try {
      generatedQuestions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      throw new Error('Failed to parse generated questions');
    }

    // Validate the generated questions
    if (!Array.isArray(generatedQuestions) || generatedQuestions.length !== 5) {
      console.error('Invalid question format:', generatedQuestions);
      throw new Error('Invalid question format generated');
    }

    // Validate each question
    generatedQuestions.forEach((q, i) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || !q.correctAnswer) {
        console.error(`Invalid question at index ${i}:`, q);
        throw new Error(`Invalid question format at index ${i}`);
      }
    });

    console.log('Successfully generated questions:', generatedQuestions);
    res.json({ 
      questions: generatedQuestions,
      difficulty: difficulty // Include the determined difficulty in the response
    });
  } catch (error) {
    console.error('Error generating quiz questions:', error);
    res.status(500).json({ 
      message: 'Error generating quiz questions',
      error: error.message,
      details: error.stack
    });
  }
});

// Submit quiz results
app.post('/api/subjects/:subjectId/subtopics/:subtopicId/quiz-results', auth, async (req, res) => {
  try {
    const { subjectId, subtopicId } = req.params;
    const { score, emotion } = req.body;

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const subtopic = subject.subtopics.id(subtopicId);
    if (!subtopic) {
      return res.status(404).json({ message: 'Subtopic not found' });
    }

    // Add quiz result to subtopic
    if (!subtopic.quizResults) {
      subtopic.quizResults = [];
    }

    subtopic.quizResults.push({
      userId: req.user._id,
      score,
      emotion,
      timestamp: new Date()
    });

    await subject.save();

    res.json({ message: 'Quiz results saved successfully' });
  } catch (error) {
    console.error('Error saving quiz results:', error);
    res.status(500).json({ message: 'Error saving quiz results' });
  }
});

// Generate personalized content
app.post('/api/subjects/:subjectId/subtopics/:subtopicId/personalized-content', auth, async (req, res) => {
  try {
    const { subjectId, subtopicId } = req.params;
    const { quizHistory, currentEmotion, subtopicAttempts } = req.body;
    
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const subtopic = subject.subtopics.id(subtopicId);
    if (!subtopic) {
      return res.status(404).json({ message: 'Subtopic not found' });
    }

    if (!model) {
      return res.status(500).json({ message: 'Gemini Flash 2.0 model not initialized' });
    }

    // Filter quiz history for this specific subtopic
    const subtopicHistory = quizHistory.filter(q => q.subtopicId === subtopicId);
    const successRate = subtopicHistory.filter(q => q.score >= 60).length / subtopicHistory.length;
    const averageScore = subtopicHistory.reduce((sum, q) => sum + q.score, 0) / subtopicHistory.length;
    const commonEmotions = subtopicHistory.map(q => q.emotion);
    
    // Generate personalized content prompt
    const contentPrompt = `You are an educational AI assistant. Generate simplified learning content for a student who:
- Has attempted this topic ${subtopicAttempts} times
- Success rate: ${(successRate * 100).toFixed(1)}%
- Average score: ${averageScore.toFixed(1)}%
- Current emotional state: ${currentEmotion}
- Common emotions during learning: ${[...new Set(commonEmotions)].join(', ')}

Please generate EASY-TO-UNDERSTAND content about "${subtopic.name}" in the context of "${subject.name}" that:
1. Uses VERY SIMPLE language and LOTS of examples
2. Breaks down EVERY concept into tiny, easy-to-digest parts
3. Uses MANY visual analogies and real-world examples
4. Provides EXTREMELY detailed step-by-step explanations
5. Uses a FRIENDLY, encouraging tone
6. Includes MANY practice questions with detailed solutions
7. Focuses on building confidence through small successes

Format the content using HTML with appropriate tags for:
- Headings (h1, h2, h3)
- Paragraphs
- Lists (ordered and unordered)
- Code blocks (if applicable)
- Examples and analogies
- Practice questions with solutions

Make the content:
- EXTREMELY beginner-friendly
- Focus on ONE concept at a time
- Include MANY examples
- Use SIMPLE language
- Be VERY encouraging
- Include LOTS of practice
- Build confidence through small steps

Remember: This student has struggled with this topic multiple times, so make it as simple and clear as possible.`;

    console.log('Generating simplified content with prompt:', contentPrompt);
    
    const result = await model.generateContent(contentPrompt);
    const response = await result.response;
    const generatedContent = response.text();

    res.json({ content: generatedContent });
  } catch (error) {
    console.error('Error generating personalized content:', error);
    res.status(500).json({ 
      message: 'Error generating personalized content',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('MONGO_URI:', process.env.MONGO_URI);