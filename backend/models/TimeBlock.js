const mongoose = require('mongoose');

const TimeBlockSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sprintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    required: true
  },
  dayId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Day',
    required: true
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM format']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM format']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  isLeave: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Virtual: total minutes
TimeBlockSchema.virtual('totalMinutes').get(function () {
  const [sh, sm] = this.startTime.split(':').map(Number);
  const [eh, em] = this.endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
});

TimeBlockSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('TimeBlock', TimeBlockSchema);
