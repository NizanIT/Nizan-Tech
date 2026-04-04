const express = require('express');
const router = express.Router();
const { 
  getStats, getActivities, getMonitor, getAnalytics,
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getSprints, createSprint, getSprintDays, updateSprint, deleteSprint, assignSprint,
  updateDayPlan, bulkUpdateDays, toggleLeave,
  grantEditPermission, grantEditAll, getExtensions, resolveExtension,
  getPlanRequests, resolvePlanChange
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');

// All admin routes need auth + admin role
router.use(protect, requireAdmin);

// ─── MONITORING ──────────────────────────────────────────
router.get('/stats', getStats);
router.get('/activities', getActivities);
router.get('/monitor', getMonitor);
router.get('/analytics', getAnalytics);

// ─── EMPLOYEES ───────────────────────────────────────────
router.get('/employees', getEmployees);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);
router.delete('/employees/:id', deleteEmployee);

// ─── SPRINTS ─────────────────────────────────────────────
router.get('/sprints', getSprints);
router.post('/sprints', createSprint);
router.get('/sprints/:id/days', getSprintDays);
router.put('/sprints/:id', updateSprint);
router.delete('/sprints/:id', deleteSprint);
router.post('/sprints/:id/assign', assignSprint);

// ─── DAY PLANS ───────────────────────────────────────────
router.put('/sprints/:id/days/:dayId', updateDayPlan);
router.put('/sprints/:id/days-bulk', bulkUpdateDays);
router.post('/timeblock/leave', toggleLeave);

// ─── PERMISSIONS & REQUESTS ──────────────────────────────
router.post('/sprints/:id/days/:dayId/grant-edit', grantEditPermission);
router.post('/sprints/:id/grant-edit-all', grantEditAll);
router.get('/extensions', getExtensions);
router.post('/extensions/:id/resolve', resolveExtension);
router.get('/plan-requests', getPlanRequests);
router.post('/plan-requests/:id/resolve', resolvePlanChange);

module.exports = router;
