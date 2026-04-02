const mongoose = require('mongoose');
const readline = require('readline');
const User = require('./models/User');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function run() {
  try {
    console.log('\n=======================================');
    console.log('🛡️  ADMIN SECURITY CONTROL PANEL  🛡️');
    console.log('=======================================\n');
    
    console.log('Connecting to MongoDB Database...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/timesheetDB', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected successfully!\n');

    // Find the master admin account
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.log('❌ Error: No admin user found in the database!');
      process.exit(1);
    }

    console.log(`Current Admin Email: ${adminUser.email}`);
    
    // Prompt for new Email (Optional)
    const newEmail = await askQuestion('\n📧 Enter your NEW Email (or just press Enter to keep current email): ');
    if (newEmail.trim() !== '') {
      // Basic email validation
      if (!newEmail.includes('@') || !newEmail.includes('.')) {
         console.log('❌ Error: Invalid email format.');
         process.exit(1);
      }
      adminUser.email = newEmail.trim().toLowerCase();
    }

    // Prompt for new Password
    const newPassword = await askQuestion('🔑 Enter your NEW Password (must be at least 6 characters): ');
    if (newPassword.length < 6) {
      console.log('❌ Error: Password must be at least 6 characters long!');
      process.exit(1);
    }
    
    // Update password (Mongoose 'pre-save' hook automatically deeply encrypts it using bcrypt!)
    adminUser.password = newPassword;
    await adminUser.save();
    
    console.log(`\n✅ SUCCESS! Credentials perfectly updated.`);
    console.log(`\n➡️  You can now log into your Admin Panel using:`);
    console.log(`   Email:    ${adminUser.email}`);
    console.log(`   Password: (Hidden for your security)`);
    console.log('\n=======================================');
    
    process.exit(0);

  } catch (err) {
    if (err.code === 11000) {
       console.error('\n❌ Fatal Error: That email is already taken by another account in the system!');
    } else {
       console.error(`\n❌ Fatal Error: ${err.message}`);
    }
    process.exit(1);
  }
}

run();
