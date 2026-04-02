const mongoose = require('mongoose');
const readline = require('readline');
const User = require('./models/User');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function run() {
  try {
    console.log('\n🔐 Setting up MongoDB connection...');
    
    // Connect to your local database exactly how your app does
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/timesheetDB', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected successfully!\n');

    // Find the master admin account
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.log('❌ Error: No admin user found in the database! Are you sure you created one?');
      process.exit(1);
    }

    console.log(`👤 Found Admin Account: ${adminUser.email}`);
    
    rl.question('\n🔑 Enter your new desired admin password: ', async (newPassword) => {
      
      if (newPassword.length < 6) {
        console.log('\n❌ Error: Password must be at least 6 characters long!');
        process.exit(1);
      }
      
      // Update password (Mongoose 'pre-save' hook automatically deeply encrypts it using bcrypt!)
      adminUser.password = newPassword;
      await adminUser.save();
      
      console.log(`\n✅ SUCCESS! The password for ${adminUser.email} has been securely changed!`);
      console.log(`You can now log into your Admin Panel with this new password.`);
      
      process.exit(0);
    });

  } catch (err) {
    console.error(`\n❌ Fatal Error: ${err.message}`);
    process.exit(1);
  }
}

run();
