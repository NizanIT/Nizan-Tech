const express = require('express');
const router = express.Router();
const { 
  getTimeBlocksByDay, 
  createTimeBlock, 
  updateTimeBlock, 
  deleteTimeBlock 
} = require('../controllers/timeblockController');
const { protect } = require('../middleware/auth');
const { requireEmployee } = require('../middleware/roleCheck');

// All timeblock routes need auth + employee role
router.use(protect, requireEmployee);

// @route   GET /api/timeblock/:dayId
router.get('/:dayId', getTimeBlocksByDay);

// @route   POST /api/timeblock
router.post('/', createTimeBlock);

// @route   PUT /api/timeblock/:id
router.put('/:id', updateTimeBlock);

// @route   DELETE /api/timeblock/:id
router.delete('/:id', deleteTimeBlock);

module.exports = router;
