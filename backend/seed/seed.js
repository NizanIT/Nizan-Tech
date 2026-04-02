require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Sprint = require('../models/Sprint');
const Day = require('../models/Day');
const TimeBlock = require('../models/TimeBlock');

const seed = async () => {
  await connectDB();

  // Wipe existing
  await User.deleteMany({});
  await Sprint.deleteMany({});
  await Day.deleteMany({});
  await TimeBlock.deleteMany({});

  console.log('🧹 Cleared existing data');

  // Create admin
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@company.com',
    password: 'admin123',
    role: 'admin',
    avatarColor: '#6C63FF'
  });

  // Create employees
  const alice = await User.create({
    name: 'Alice Johnson',
    email: 'alice@company.com',
    password: 'emp123',
    role: 'employee',
    avatarColor: '#00D4AA'
  });
  const bob = await User.create({
    name: 'Bob Williams',
    email: 'bob@company.com',
    password: 'emp123',
    role: 'employee',
    avatarColor: '#FFB347'
  });

  console.log('👥 Users created');

  // Create sprint (current month, start from today)
  const start = new Date();
  start.setDate(1); // First of current month
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0); // Last day of current month

  const sprint = await Sprint.create({
    name: 'April Sprint 2026',
    description: 'Main development sprint for Q2',
    startDate: start,
    endDate: end,
    assignedTo: [alice._id, bob._id],
    createdBy: admin._id
  });

  // Generate days (weekdays only)
  const days = [];
  let current = new Date(start);
  let dayNum = 1;
  while (current <= end) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push({ sprintId: sprint._id, dayNumber: dayNum++, date: new Date(current) });
    }
    current.setDate(current.getDate() + 1);
  }
  const savedDays = await Day.insertMany(days);

  console.log(`📅 Sprint created with ${savedDays.length} days`);

  // Add some sample time blocks for Alice on first 2 days
  if (savedDays.length >= 2) {
    await TimeBlock.create([
      {
        userId: alice._id, sprintId: sprint._id, dayId: savedDays[0]._id,
        startTime: '09:00', endTime: '12:00', description: 'Project Setup & Planning'
      },
      {
        userId: alice._id, sprintId: sprint._id, dayId: savedDays[0]._id,
        startTime: '13:00', endTime: '17:00', description: 'UI/UX Design Review'
      },
      {
        userId: alice._id, sprintId: sprint._id, dayId: savedDays[1]._id,
        startTime: '09:30', endTime: '11:30', description: 'Frontend Development - Login Page'
      },
      {
        userId: bob._id, sprintId: sprint._id, dayId: savedDays[0]._id,
        startTime: '10:00', endTime: '13:00', description: 'Database Schema Design'
      }
    ]);
  }

  console.log('⏱️  Sample time blocks created');
  console.log('\n✅ Seed complete!\n');
  console.log('📋 Login Credentials:');
  console.log('   Admin:    admin@company.com  / admin123');
  console.log('   Employee: alice@company.com  / emp123');
  console.log('   Employee: bob@company.com    / emp123\n');

  mongoose.connection.close();
};

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
