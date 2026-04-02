const mongoose = require('mongoose');

const DaySchema = new mongoose.Schema({
  sprintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    required: true
  },
  dayNumber: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  label: {
    type: String,
    trim: true,
    default: ''
  },
  // Detailed plan fields
  module: {
    type: String,
    trim: true,
    default: ''
  },
  tasks: {
    type: String,
    trim: true,
    default: ''
  },
  plannedStatus: {
    type: String,
    enum: ['pending', 'in-progress', 'done', ''],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  // Pending Approval System (Employee requests)
  pendingModule: {
    type: String,
    trim: true
  },
  pendingTasks: {
    type: String,
    trim: true
  },
  hasPendingChanges: {
    type: Boolean,
    default: false
  },
  // Which employees can edit this day's plan fields
  editableBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Day', DaySchema);
