const express = require('express');
const router = express.Router();
const TimeBlock = require('../models/TimeBlock');
const Day = require('../models/Day');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');
const { requireEmployee } = require('../middleware/roleCheck');

router.use(protect, requireEmployee);

// Helper: check for overlapping blocks
const hasOverlap = (blocks, startTime, endTime, excludeId = null) => {
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const newStart = toMin(startTime);
  const newEnd = toMin(endTime);
  return blocks.some(b => {
    if (excludeId && b._id.equals(excludeId)) return false;
    const bStart = toMin(b.startTime);
    const bEnd = toMin(b.endTime);
    return newStart < bEnd && newEnd > bStart;
  });
};

// GET /api/timeblock/:dayId
router.get('/:dayId', async (req, res) => {
  try {
    const blocks = await TimeBlock.find({ userId: req.user._id, dayId: req.params.dayId }).sort({ startTime: 1 });
    res.json({ success: true, data: blocks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/timeblock
router.post('/', async (req, res) => {
  try {
    const { dayId, sprintId, startTime, endTime, description } = req.body;
    if (!dayId || !sprintId || !startTime || !endTime || !description)
      return res.status(400).json({ success: false, message: 'All fields are required.' });

    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    if (toMin(endTime) <= toMin(startTime))
      return res.status(400).json({ success: false, message: 'End time must be after start time.' });

    const existing = await TimeBlock.find({ userId: req.user._id, dayId });
    if (hasOverlap(existing, startTime, endTime))
      return res.status(400).json({ success: false, message: 'This time overlaps with an existing block.' });

    const block = await TimeBlock.create({ userId: req.user._id, sprintId, dayId, startTime, endTime, description, completed: req.body.completed || false });

    // Real-time: notify admin
    const io = req.app.get('io');
    io.to('admin').emit('timeblock:created', {
      block: { ...block.toJSON(), userName: req.user.name }
    });

    await Activity.create({
      icon: '⏱️',
      text: `${req.user.name} added a block: ${startTime}–${endTime}`,
      type: 'timeblock'
    });

    res.status(201).json({ success: true, data: block });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/timeblock/:id
router.put('/:id', async (req, res) => {
  try {
    const block = await TimeBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, message: 'Block not found.' });
    if (!block.userId.equals(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized.' });

    const { startTime, endTime, description } = req.body;
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const newStart = startTime || block.startTime;
    const newEnd = endTime || block.endTime;

    if (toMin(newEnd) <= toMin(newStart))
      return res.status(400).json({ success: false, message: 'End time must be after start time.' });

    const existing = await TimeBlock.find({ userId: req.user._id, dayId: block.dayId });
    if (hasOverlap(existing, newStart, newEnd, block._id))
      return res.status(400).json({ success: false, message: 'This time overlaps with an existing block.' });

    if (startTime) block.startTime = startTime;
    if (endTime) block.endTime = endTime;
    if (description) block.description = description;
    if (req.body.completed !== undefined) block.completed = req.body.completed;
    await block.save();

    const io = req.app.get('io');
    io.to('admin').emit('timeblock:updated', { block: { ...block.toJSON(), userName: req.user.name } });

    await Activity.create({
      icon: '✏️',
      text: `${req.user.name} updated a block: ${description || block.description}`,
      type: 'timeblock'
    });

    res.json({ success: true, data: block });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/timeblock/:id
router.delete('/:id', async (req, res) => {
  try {
    const block = await TimeBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, message: 'Block not found.' });
    if (!block.userId.equals(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized.' });

    await block.deleteOne();

    const io = req.app.get('io');
    io.to('admin').emit('timeblock:deleted', { blockId: req.params.id, userName: req.user.name });

    await Activity.create({
      icon: '🗑️',
      text: `${req.user.name} deleted a block`,
      type: 'timeblock'
    });

    res.json({ success: true, message: 'Block deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
