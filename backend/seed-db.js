const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');
const Subject = require('./models/Subject');

// Sample subjects and subtopics
const subjects = [
  {
    name: "Java ",
    description: "Learn Java programming from basics to advanced concepts",
    imageUrl: "https://example.com/java.jpg",
    subtopics: [
      { name: "Variables", content: "", generated: false },
      { name: "Loops", content: "", generated: false },
      { name: "Arrays", content: "", generated: false },
      { name: "Methods", content: "", generated: false },
      { name: "Classes", content: "", generated: false }
    ]
  },
  {
    name: "Python",
    description: "Master Python programming language",
    imageUrl: "https://example.com/python.jpg",
    subtopics: [
      { name: "Introduction to Python", content: "", generated: false },
      { name: "Data Types", content: "", generated: false },
      { name: "Strings", content: "", generated: false },
      { name: "Functions", content: "", generated: false },
      { name: "Inheritance", content: "", generated: false }
    ]
  },

  {
    name: "Science",
    description: "Explore the wonders of SCIENCE",
    imageUrl: "https://example.com/plants.jpg",
    subtopics: [
      { name: "Plants", content: "", generated: false },
      { name: "Animals", content: "", generated: false },
      { name: "Digestive System", content: "", generated: false },
      // { name: "", content: "", generated: false },
      // { name: "Inheritance", content: "", generated: false }
    ]
  },

  {
    name: "Mathematics",
    description: "Fundamental mathematics concepts",
    imageUrl: "https://example.com/math.jpg",
    subtopics: [
      { name: "Addition", content: "", generated: false },
      { name: "Subtraction", content: "", generated: false },
      { name: "Multiplication", content: "", generated: false },
      { name: "Division", content: "", generated: false },
      { name: "Fractions", content: "", generated: false }
    ]
  }
];

// Connect to MongoDB and seed the database
const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Clear existing subjects
    await Subject.deleteMany({});
    console.log('Cleared existing subjects');

    // Insert new subjects
    const insertedSubjects = await Subject.insertMany(subjects);
    console.log(`Inserted ${insertedSubjects.length} subjects`);

    // Log the IDs for reference
    insertedSubjects.forEach(subject => {
      console.log(`${subject.name}: ${subject._id}`);
    });

    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase(); 