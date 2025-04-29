const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function checkDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MONGO_URI:', process.env.MONGO_URI);
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB successfully');
    
    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Check users collection
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({});
    console.log(`Found ${users.length} users in the database`);
    
    if (users.length > 0) {
      console.log('User details:');
      users.forEach(user => {
        console.log(`- Email: ${user.email}, Created: ${user.createdAt}`);
      });
    }
    
    // Check indexes
    const indexes = await mongoose.connection.db.collection('users').indexes();
    console.log('Indexes on users collection:');
    indexes.forEach(index => {
      console.log(`- ${JSON.stringify(index.key)}`);
    });
    
    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

checkDatabase(); 