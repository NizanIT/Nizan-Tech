const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  icon: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  time: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['timeblock', 'sprint', 'user', 'system'],
    default: 'system'
  }
});

module.exports = mongoose.model('Activity', ActivitySchema);
