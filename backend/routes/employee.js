const express = require('express');
const router = express.Router();
const Sprint = require('../models/Sprint');
const Day = require('../models/Day');
const TimeBlock = require('../models/TimeBlock');
const ExtensionRequest = require('../models/ExtensionRequest');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');
const { requireEmployee } = require('../middleware/roleCheck');

router.use(protect, requireEmployee);

// GET /api/employee/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user._id;

    const sprints = await Sprint.find({ assignedTo: userId });
    const sprintIds = sprints.map(s => s._id);

    const currentSprint = sprints.find(s => s.status === 'active') || sprints[0] || null;

    const allBlocks = await TimeBlock.find({ userId, sprintId: { $in: sprintIds } });

    const totalMinutes = allBlocks.reduce((acc, b) => {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      return acc + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayDays = await Day.find({ sprintId: { $in: sprintIds }, date: { $gte: today, $lt: tomorrow } });
    const todayDayIds = todayDays.map(d => d._id);
    const todayBlocks = allBlocks.filter(b => todayDayIds.some(id => id.equals(b.dayId)));
    const todayMinutes = todayBlocks.reduce((acc, b) => {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      return acc + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);

    const totalDays = await Day.countDocuments({ sprintId: { $in: sprintIds } });

    res.json({
      success: true,
      data: {
        totalTasks: totalDays,
        totalHours: (totalMinutes / 60).toFixed(1),
        todayHours: (todayMinutes / 60).toFixed(1),
        currentSprint: currentSprint ? { id: currentSprint._id, name: currentSprint.name, status: currentSprint.status } : null,
        totalSprints: sprints.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/employee/sprint — returns all assigned sprints with days + plan details
router.get('/sprint', async (req, res) => {
  try {
    const userId = req.user._id;
    const sprints = await Sprint.find({ assignedTo: userId }).populate('createdBy', 'name');

    const result = await Promise.all(sprints.map(async (sprint) => {
      const days = await Day.find({ sprintId: sprint._id }).sort({ dayNumber: 1 });
      const blocks = await TimeBlock.find({ userId, sprintId: sprint._id });

      const daysWithHours = days.map(day => {
        const dayBlocks = blocks.filter(b => b.dayId.equals(day._id));
        const minutes = dayBlocks.reduce((acc, b) => {
          const [sh, sm] = b.startTime.split(':').map(Number);
          const [eh, em] = b.endTime.split(':').map(Number);
          return acc + (eh * 60 + em) - (sh * 60 + sm);
        }, 0);
        const dayDate = new Date(day.date);
        dayDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = dayDate.getTime() === today.getTime();
        const isAdminGranted = day.editableBy && day.editableBy.some(id => id.equals(userId));
        const canEdit = isToday || isAdminGranted;

        return {
          ...day.toJSON(),
          totalHours: (minutes / 60).toFixed(1),
          blockCount: dayBlocks.length,
          canEdit,
          isToday
        };
      });

      const totalMinutes = blocks.reduce((acc, b) => {
        const [sh, sm] = b.startTime.split(':').map(Number);
        const [eh, em] = b.endTime.split(':').map(Number);
        return acc + (eh * 60 + em) - (sh * 60 + sm);
      }, 0);

      const totalDays = days.length;
      let completedDays = 0;

      days.forEach(day => {
        const dayBlocks = blocks.filter(b => b.dayId.equals(day._id));
        if (dayBlocks.length > 0 && dayBlocks.every(b => b.completed === true)) {
          completedDays += 1;
        }
      });

      return {
        ...sprint.toJSON(),
        days: daysWithHours,
        totalHours: (totalMinutes / 60).toFixed(1),
        totalDays,
        completedDays
      };
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/employee/days/:dayId — Employee edits a day's plan (only if permitted)
router.put('/days/:dayId', async (req, res) => {
  try {
    const userId = req.user._id;
    const day = await Day.findById(req.params.dayId);
    if (!day) return res.status(404).json({ success: false, message: 'Day not found.' });

    // Check permission: Today OR Admin Granted
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = dayDate.getTime() === today.getTime();
    const isAdminGranted = day.editableBy && day.editableBy.some(id => id.equals(userId));

    if (!isToday && !isAdminGranted) {
      return res.status(403).json({ success: false, message: 'Editing is locked for this day.' });
    }

    const { module, tasks, plannedStatus, notes } = req.body;
    let planChanged = false;

    // 1. Immediate updates (No approval needed)
    if (plannedStatus !== undefined) day.plannedStatus = plannedStatus;
    if (notes !== undefined) day.notes = notes;

    // 2. Pending updates (Approval needed for roadmap changes)
    if (module !== undefined && module !== day.module) {
      day.pendingModule = module;
      planChanged = true;
    }
    if (tasks !== undefined && tasks !== day.tasks) {
      day.pendingTasks = tasks;
      planChanged = true;
    }

    if (planChanged) {
      day.hasPendingChanges = true;

      // Notify Admin
      const io = req.app.get('io');
      io.to('admin').emit('plan:change-requested', {
        userName: req.user.name,
        dayId: day._id,
        dayNumber: day.dayNumber
      });

      await Activity.create({
        icon: '📝',
        text: `${req.user.name} requested a plan change for Day ${day.dayNumber}`,
        type: 'sprint'
      });
    }

    await day.save();
    res.json({ success: true, data: day });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/employee/sprint/:id/extension — Employee submits a deadline extension request
router.post('/sprint/:id/extension', async (req, res) => {
  try {
    const userId = req.user._id;
    const sprintId = req.params.id;
    const { requestedDays, delayedDayNumber, reason } = req.body;

    if (!requestedDays || !delayedDayNumber || !reason) {
      return res.status(400).json({ success: false, message: 'Days, Delayed Day, and Reason are structurally required.' });
    }

    const sprint = await Sprint.findById(sprintId);
    if (!sprint || !sprint.assignedTo.some(id => id.equals(userId))) {
      return res.status(404).json({ success: false, message: 'Sprint not found or unauthorized.' });
    }

    // Check for an already pending request to avoid spam
    const existing = await ExtensionRequest.findOne({ sprintId, userId, status: 'pending' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have a pending extension request for this sprint.' });
    }

    const request = await ExtensionRequest.create({ sprintId, userId, requestedDays, delayedDayNumber, reason, status: 'pending' });

    // Notify Admin
    const io = req.app.get('io');
    io.to('admin').emit('extension:requested', { userName: req.user.name, sprintName: sprint.name });

    await Activity.create({
      icon: '⏳',
      text: `${req.user.name} requested a +${requestedDays} day extension on: ${sprint.name}`,
      type: 'sprint'
    });

    res.status(201).json({ success: true, message: 'Extension requested securely.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
