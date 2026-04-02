const mongoose = require('mongoose');

const SprintSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Sprint name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed'],
    default: 'upcoming'
  },
  planType: {
    type: String,
    enum: ['quick', 'detailed'],
    default: 'quick'
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Auto-compute status based on dates
SprintSchema.pre('save', function (next) {
  const now = new Date();
  if (now < this.startDate) this.status = 'upcoming';
  else if (now > this.endDate) this.status = 'completed';
  else this.status = 'active';
  next();
});

module.exports = mongoose.model('Sprint', SprintSchema);
