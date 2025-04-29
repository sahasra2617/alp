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

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    // Generate content based on subject and subtopic
    let content = '';
    switch(subtopic.name.toLowerCase()) {
      case 'introduction to python':
        content = `Python is a high-level, interpreted programming language known for its simplicity and readability. Created by Guido van Rossum in 1991, Python has become one of the most popular programming languages worldwide.\n\nKey Features of Python:\n1. Easy to Learn and Read\n2. Large Standard Library\n3. Cross-platform Compatibility\n4. Dynamic Typing\n5. Object-Oriented Programming Support\n\nPython is widely used in:\n- Web Development\n- Data Science\n- Artificial Intelligence\n- Scientific Computing\n- Automation and Scripting`;
        break;
      case 'variables and data types':
        content = `Variables in Python are containers for storing data values. Python has several built-in data types:\n\n1. Numeric Types:\n- int (integers)\n- float (decimal numbers)\n- complex (complex numbers)\n\n2. Text Type:\n- str (strings)\n\n3. Sequence Types:\n- list (ordered, mutable)\n- tuple (ordered, immutable)\n\n4. Mapping Type:\n- dict (key-value pairs)\n\n5. Set Types:\n- set (unordered, unique elements)\n- frozenset (immutable set)\n\nExample:\nx = 5 # integer\nname = "Python" # string\nnumbers = [1, 2, 3] # list`;
        break;
      case 'control structures':
        content = `Control structures in Python help control the flow of program execution:\n\n1. Conditional Statements:\nif condition:\n    # code block\nelif condition:\n    # code block\nelse:\n    # code block\n\n2. Loops:\n- for loop (iteration over sequences)\n- while loop (condition-based iteration)\n\n3. Loop Control:\n- break (exit loop)\n- continue (skip iteration)\n- pass (null operation)\n\nExample:\nfor i in range(5):\n    if i == 2:\n        continue\n    print(i)`;
        break;
      case 'functions and modules':
        content = `Functions in Python are blocks of reusable code:\n\n1. Function Definition:\ndef function_name(parameters):\n    # code block\n    return value\n\n2. Function Types:\n- Built-in functions\n- User-defined functions\n- Lambda functions\n\n3. Modules:\n- Collections of functions\n- Import using 'import' keyword\n- Create custom modules\n\nExample:\ndef greet(name):\n    return f"Hello, {name}!"\n\nimport math\nprint(math.pi)`;
        break;
      case 'object-oriented programming':
        content = `Object-Oriented Programming (OOP) in Python:\n\n1. Classes and Objects:\nclass ClassName:\n    def __init__(self):\n        # constructor\n    def method(self):\n        # method code\n\n2. OOP Concepts:\n- Inheritance\n- Encapsulation\n- Polymorphism\n- Abstraction\n\n3. Special Methods:\n- __init__ (constructor)\n- __str__ (string representation)\n- __len__ (length)\n\nExample:\nclass Dog:\n    def __init__(self, name):\n        self.name = name\n    def bark(self):\n        return "Woof!"`;
        break;
      default:
        content = `Content for ${subtopic.name}:\n\nThis section covers the fundamentals and key concepts of ${subtopic.name}. The content includes detailed explanations, examples, and practical applications.\n\nKey Points:\n1. Basic Concepts\n2. Advanced Topics\n3. Practical Examples\n4. Best Practices\n5. Common Use Cases`;
    }

    subtopic.content = content;
    subtopic.generated = true;
    await subject.save();

    res.json({ content });
  } catch (error) {
    console.error('Error in content generation:', error);
    res.status(500).json({ message: 'Error generating content' });
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