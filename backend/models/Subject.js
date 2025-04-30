const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  emotion: {
    type: String,
    required: true,
    enum: ['happy', 'surprise', 'neutral', 'sad', 'angry']
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const subtopicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    default: ''
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'intermediate'
  },
  generated: {
    type: Boolean,
    default: false
  },
  quizResults: [quizResultSchema]
});

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  subtopics: [subtopicSchema]
}, { 
  timestamps: true
});

module.exports = mongoose.model('Subject', subjectSchema); 