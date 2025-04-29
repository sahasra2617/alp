const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function fixDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB successfully');
    
    // Drop the problematic index
    try {
      await mongoose.connection.db.collection('users').dropIndex('username_1');
      console.log('Successfully dropped the username_1 index');
    } catch (indexError) {
      console.log('Error dropping index (might not exist):', indexError.message);
    }
    
    // List all indexes to verify
    const indexes = await mongoose.connection.db.collection('users').indexes();
    console.log('Remaining indexes on users collection:');
    indexes.forEach(index => {
      console.log(`- ${JSON.stringify(index.key)}`);
    });
    
    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    console.log('Database fixed successfully. You can now restart your server.');
  } catch (error) {
    console.error('Error fixing database:', error);
  }
}

fixDatabase(); 