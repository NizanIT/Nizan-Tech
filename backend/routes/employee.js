const express = require('express');
const router = express.Router();
const { 
  getDashboard, 
  getSprintDetails, 
  updateDayPlan, 
  requestExtension 
} = require('../controllers/employeeController');
const { protect } = require('../middleware/auth');
const { requireEmployee } = require('../middleware/roleCheck');

// All employee routes need auth + employee role
router.use(protect, requireEmployee);

// @route   GET /api/employee/dashboard
router.get('/dashboard', getDashboard);

// @route   GET /api/employee/sprint
router.get('/sprint', getSprintDetails);

// @route   PUT /api/employee/days/:dayId
router.put('/days/:dayId', updateDayPlan);

// @route   POST /api/employee/sprint/:id/extension
router.post('/sprint/:id/extension', requestExtension);

module.exports = router;
