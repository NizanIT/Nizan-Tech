const mongoose = require('mongoose');

const ExtensionRequestSchema = new mongoose.Schema({
  sprintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedDays: {
    type: Number,
    required: true,
    min: 1
  },
  delayedDayNumber: {
    type: Number,
    required: true,
    min: 1
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('ExtensionRequest', ExtensionRequestSchema);
