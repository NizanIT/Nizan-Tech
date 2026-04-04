const User = require('../models/User');
const Sprint = require('../models/Sprint');
const Day = require('../models/Day');
const TimeBlock = require('../models/TimeBlock');
const Activity = require('../models/Activity');
const ExtensionRequest = require('../models/ExtensionRequest');
const mongoose = require('mongoose');

// ─── STATS & MONITORING ─────────────────────────────────────────

exports.getStats = async (req, res) => {
  try {
    const [totalEmployees, activeSprints, totalSprints] = await Promise.all([
      User.countDocuments({ role: 'employee' }),
      Sprint.countDocuments({ status: 'active' }),
      Sprint.countDocuments()
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayBlocks = await TimeBlock.find({ createdAt: { $gte: today, $lt: tomorrow } });
    const todayMinutes = todayBlocks.reduce((acc, b) => {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      return acc + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);

    res.json({ 
      success: true, 
      data: { 
        totalEmployees, 
        activeSprints, 
        totalSprints, 
        hoursLoggedToday: (todayMinutes / 60).toFixed(1) 
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getActivities = async (req, res) => {
  try {
    const activities = await Activity.find().sort({ time: -1 }).limit(20);
    res.json({ success: true, data: activities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMonitor = async (req, res) => {
  try {
    const { sprintId, employeeId } = req.query;
    const filter = {};
    if (sprintId) filter.sprintId = sprintId;
    if (employeeId) filter.userId = employeeId;

    const blocks = await TimeBlock.find(filter)
      .populate('userId', 'name email avatarColor')
      .populate('dayId', 'date dayNumber')
      .populate('sprintId', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: blocks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const [sprints, employees, days, blocks] = await Promise.all([
      Sprint.find().populate('assignedTo', 'name email avatarColor'),
      User.find({ role: 'employee' }, 'name email avatarColor'),
      Day.find().lean(),
      TimeBlock.find()
        .populate('dayId', 'date')
        .populate('userId', 'name email avatarColor')
        .populate('sprintId', 'name')
    ]);

    res.json({ success: true, data: { sprints, employees, days, blocks } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── EMPLOYEE MANAGEMENT ────────────────────────────────────────

exports.getEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).sort({ createdAt: -1 });
    res.json({ success: true, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password required.' });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ success: false, message: 'Email already in use.' });

    const user = await User.create({ name, email, password, role: 'employee' });
    res.status(201).json({ success: true, data: { id: user._id, name: user.name, email: user.email, avatarColor: user.avatarColor } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { name, email, password, isActive } = req.body;
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'Employee not found.' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.password = password;

    await user.save();
    res.json({ success: true, data: { id: user._id, name: user.name, email: user.email, isActive: user.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Employee deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SPRINT MANAGEMENT ──────────────────────────────────────────

exports.getSprints = async (req, res) => {
  try {
    const sprintsQuery = await Sprint.find()
      .populate('assignedTo', 'name email avatarColor')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    const sprints = await Promise.all(sprintsQuery.map(async (sprint) => {
      const [days, blocks] = await Promise.all([
        Day.find({ sprintId: sprint._id }),
        TimeBlock.find({ sprintId: sprint._id })
      ]);

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
        totalDays,
        completedDays
      };
    }));

    res.json({ success: true, data: sprints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSprint = async (req, res) => {
  try {
    const { name, description, startDate, endDate, planType, dayPlans } = req.body;
    if (!name || !startDate || !endDate)
      return res.status(400).json({ success: false, message: 'Name, startDate, endDate are required.' });

    const type = planType === 'detailed' ? 'detailed' : 'quick';
    const sprint = await Sprint.create({ name, description, startDate, endDate, planType: type, createdBy: req.user._id });

    // Track creation
    await Activity.create({
      icon: '📋',
      text: `Admin created new sprint: ${sprint.name}`,
      type: 'sprint'
    });

    if (type === 'detailed' && Array.isArray(dayPlans) && dayPlans.length > 0) {
      const start = new Date(startDate);
      const days = [];
      let current = new Date(start);
      let dayIndex = 1;

      for (let i = 0; i < dayPlans.length; i++) {
        while (current.getDay() === 0) { // Skip Sunday
          current.setDate(current.getDate() + 1);
        }
        days.push({
          sprintId: sprint._id,
          dayNumber: dayIndex++,
          date: new Date(current),
          module: dayPlans[i].module || '',
          tasks: dayPlans[i].tasks || '',
          plannedStatus: dayPlans[i].plannedStatus || 'pending',
          notes: dayPlans[i].notes || ''
        });
        current.setDate(current.getDate() + 1);
      }

      sprint.endDate = new Date(current.getTime() - 86400000);
      if (sprint.endDate.getDay() === 0) sprint.endDate.setDate(sprint.endDate.getDate() - 1);
      
      await sprint.save();
      await Day.insertMany(days);
    } else {
      const days = [];
      let current = new Date(startDate);
      const end = new Date(endDate);
      let dayNum = 1;
      while (current <= end) {
        if (current.getDay() !== 0) {
          days.push({ sprintId: sprint._id, dayNumber: dayNum++, date: new Date(current) });
        }
        current.setDate(current.getDate() + 1);
      }
      await Day.insertMany(days);
    }

    res.status(201).json({ success: true, data: sprint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSprintDays = async (req, res) => {
  try {
    const days = await Day.find({ sprintId: req.params.id }).sort({ dayNumber: 1 });
    res.json({ success: true, data: days });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSprint = async (req, res) => {
  try {
    const sprint = await Sprint.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!sprint) return res.status(404).json({ success: false, message: 'Sprint not found.' });
    res.json({ success: true, data: sprint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSprint = async (req, res) => {
  try {
    const sprint = await Sprint.findByIdAndDelete(req.params.id);
    if (!sprint) return res.status(404).json({ success: false, message: 'Sprint not found.' });
    
    await Promise.all([
      Day.deleteMany({ sprintId: req.params.id }),
      TimeBlock.deleteMany({ sprintId: req.params.id })
    ]);
    
    res.json({ success: true, message: 'Sprint and all related data deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignSprint = async (req, res) => {
  try {
    const { employeeIds } = req.body;
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) return res.status(404).json({ success: false, message: 'Sprint not found.' });

    sprint.assignedTo = employeeIds;
    await sprint.save();

    const io = req.app.get('io');
    employeeIds.forEach(empId => {
      io.to(empId.toString()).emit('sprint:assigned', { sprintId: sprint._id, sprintName: sprint.name });
    });

    await Activity.create({ icon: '🎯', text: `Assigned Sprint: ${sprint.name}`, type: 'sprint' });

    res.json({ success: true, data: sprint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DAY PLAN MANAGEMENT ────────────────────────────────────────

exports.updateDayPlan = async (req, res) => {
  try {
    const { module, tasks, plannedStatus, notes } = req.body;
    const day = await Day.findOneAndUpdate(
      { _id: req.params.dayId, sprintId: req.params.id },
      { module, tasks, plannedStatus, notes },
      { new: true }
    );
    if (!day) return res.status(404).json({ success: false, message: 'Day not found.' });
    res.json({ success: true, data: day });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkUpdateDays = async (req, res) => {
  try {
    const { dayPlans } = req.body;
    if (!Array.isArray(dayPlans)) return res.status(400).json({ success: false, message: 'dayPlans must be an array.' });

    const days = await Day.find({ sprintId: req.params.id }).sort({ dayNumber: 1 });

    const updates = dayPlans.map((plan, idx) => {
      if (days[idx]) {
        return Day.findByIdAndUpdate(days[idx]._id, {
          module: plan.module || '',
          tasks: plan.tasks || '',
          plannedStatus: plan.plannedStatus || 'pending',
          notes: plan.notes || ''
        }, { new: true });
      }
      return null;
    }).filter(Boolean);

    await Promise.all(updates);
    res.json({ success: true, message: `Updated ${updates.length} days.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── LEAVE MANAGEMENT ───────────────────────────────────────────

exports.toggleLeave = async (req, res) => {
  try {
    const { userId, sprintId, dayId } = req.body;
    if (!userId || !sprintId || !dayId) return res.status(400).json({ success: false, message: 'Missing fields' });

    const existingLeave = await TimeBlock.findOne({ userId, dayId, isLeave: true });

    if (existingLeave) {
      await existingLeave.deleteOne();
      req.app.get('io').to('admin').emit('timeblock:deleted', { blockId: existingLeave._id, userName: 'Admin' });
      await Activity.create({ icon: '🔙', text: 'Admin removed leave status for employee', type: 'timeblock' });
      return res.json({ success: true, message: 'Leave removed', isLeave: false });
    }

    await TimeBlock.deleteMany({ userId, dayId });

    const block = await TimeBlock.create({
      userId, sprintId, dayId,
      startTime: '00:00', endTime: '23:59',
      description: 'ON LEAVE 🌴',
      completed: true,
      isLeave: true
    });

    req.app.get('io').to('admin').emit('timeblock:created', { block: { ...block.toJSON(), userName: 'Admin' } });
    await Activity.create({ icon: '🌴', text: 'Admin marked employee on Leave', type: 'timeblock' });

    res.status(201).json({ success: true, isLeave: true, data: block });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PERMISSIONS & REQUESTS ─────────────────────────────────────

exports.grantEditPermission = async (req, res) => {
  try {
    const { employeeIds } = req.body;
    const day = await Day.findOneAndUpdate(
      { _id: req.params.dayId, sprintId: req.params.id },
      { editableBy: employeeIds },
      { new: true }
    );
    if (!day) return res.status(404).json({ success: false, message: 'Day not found.' });
    res.json({ success: true, data: day });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.grantEditAll = async (req, res) => {
  try {
    const { employeeIds } = req.body;
    await Day.updateMany({ sprintId: req.params.id }, { editableBy: employeeIds });
    res.json({ success: true, message: 'Edit permission updated for all days.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getExtensions = async (req, res) => {
  try {
    const exts = await ExtensionRequest.find({ status: 'pending' })
      .populate('userId', 'name email avatarColor')
      .populate('sprintId', 'name startDate endDate status')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: exts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolveExtension = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    const ext = await ExtensionRequest.findById(req.params.id)
      .populate('userId', 'name')
      .populate('sprintId', 'name');

    if (!ext) return res.status(404).json({ success: false, message: 'Extension not found.' });

    ext.status = status;
    await ext.save();

    const sprint = await Sprint.findById(ext.sprintId._id);
    const io = req.app.get('io');

    if (status === 'approved' && sprint) {
      const daysToAdd = ext.requestedDays;
      let lastDate = new Date(sprint.endDate);

      const highestDay = await Day.findOne({ sprintId: sprint._id }).sort({ dayNumber: -1 });
      let dayNum = highestDay ? highestDay.dayNumber + 1 : 1;

      const newDays = [];
      let added = 0;
      let current = new Date(lastDate);

      while (added < daysToAdd) {
        current.setDate(current.getDate() + 1);
        if (current.getDay() !== 0) {
          newDays.push({ sprintId: sprint._id, dayNumber: dayNum++, date: new Date(current) });
          added++;
        }
      }

      await Day.insertMany(newDays);
      sprint.endDate = current;
      await sprint.save();

      if (ext.delayedDayNumber) {
        const allDays = await Day.find({ sprintId: sprint._id }).sort({ dayNumber: 1 });
        const delayStartIndex = allDays.findIndex(d => d.dayNumber === ext.delayedDayNumber);

        if (delayStartIndex !== -1) {
          for (let i = allDays.length - 1; i >= delayStartIndex + daysToAdd; i--) {
            const sourceDay = allDays[i - daysToAdd];
            const targetDay = allDays[i];
            targetDay.module = sourceDay.module;
            targetDay.tasks = sourceDay.tasks;
            targetDay.plannedStatus = sourceDay.plannedStatus;
            targetDay.notes = sourceDay.notes;
            await targetDay.save();
          }

          for (let i = delayStartIndex; i < delayStartIndex + daysToAdd; i++) {
            if (allDays[i]) {
              allDays[i].module = 'Delayed';
              allDays[i].tasks = '⏳ System Authorized Delay';
              allDays[i].plannedStatus = 'pending';
              allDays[i].notes = '';
              await allDays[i].save();
            }
          }
        }
      }

      io.to(ext.userId._id.toString()).emit('extension:resolved', { sprintId: sprint._id, status, days: daysToAdd });
      await Activity.create({ icon: '✅', text: `Admin approved +${daysToAdd} day extension for ${ext.sprintId.name}`, type: 'sprint' });
    } else {
      io.to(ext.userId._id.toString()).emit('extension:resolved', { sprintId: ext.sprintId._id, status });
      await Activity.create({ icon: '❌', text: `Admin rejected extension request for ${ext.sprintId.name}`, type: 'sprint' });
    }

    res.json({ success: true, data: ext, newEndDate: sprint ? sprint.endDate : null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPlanRequests = async (req, res) => {
  try {
    const plans = await Day.find({ hasPendingChanges: true })
      .populate({
        path: 'sprintId',
        select: 'name assignedTo',
        populate: { path: 'assignedTo', select: 'name' }
      })
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolvePlanChange = async (req, res) => {
  try {
    const { status } = req.body;
    const day = await Day.findById(req.params.id);
    if (!day) return res.status(404).json({ success: false, message: 'Request not found.' });

    if (status === 'approved') {
      if (day.pendingModule !== undefined) day.module = day.pendingModule;
      if (day.pendingTasks !== undefined) day.tasks = day.pendingTasks;
      await Activity.create({ icon: '✅', text: `Admin approved plan change for Day ${day.dayNumber}`, type: 'sprint' });
    } else {
      await Activity.create({ icon: '❌', text: `Admin rejected plan change for Day ${day.dayNumber}`, type: 'sprint' });
    }

    day.pendingModule = undefined;
    day.pendingTasks = undefined;
    day.hasPendingChanges = false;
    await day.save();

    req.app.get('io').emit('plan:change-resolved', { dayId: day._id, status });

    res.json({ success: true, message: `Plan change ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
