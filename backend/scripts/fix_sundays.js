require('dotenv')
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Sprint = require('../models/Sprint');
const Day = require('../models/Day');

async function fixSundays() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/timesheet';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected for Sunday Purge');

    const sprints = await Sprint.find();

    for (const sprint of sprints) {
      console.log(`Processing Sprint: ${sprint.name}`);
      
      const days = await Day.find({ sprintId: sprint._id }).sort({ dayNumber: 1 });
      if (days.length === 0) continue;

      let currentDate = new Date(sprint.startDate);
      let dayNumber = 1;
      let finalDate = new Date(currentDate);

      for (let i = 0; i < days.length; i++) {
        const dayRecord = days[i];

        // Ensure current date is not a Sunday
        while (currentDate.getDay() === 0) {
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Apply new sequential numbers and non-Sunday dates
        dayRecord.dayNumber = dayNumber;
        dayRecord.date = new Date(currentDate);
        await dayRecord.save();
        
        console.log(`  - Day ${dayNumber}: ${currentDate.toDateString()}`);
        
        finalDate = new Date(currentDate);
        dayNumber++;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Finalize sprint end-date based on shifted timeline
      sprint.endDate = finalDate;
      await sprint.save();
      console.log(`✅ Sprint "${sprint.name}" updated. EndDate: ${finalDate.toDateString()}`);
    }

    console.log('\n✨ ALL SPRINTS RESTRUCTURED SUCCESSFULLY - EXCLUDING SUNDAYS ✨');
  } catch (err) {
    console.error(`❌ Migration Error: ${err.message}`);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixSundays();
