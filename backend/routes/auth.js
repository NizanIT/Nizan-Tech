const express = require('express');
const router = express.Router();
const { login, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// @route   POST /api/auth/login
router.post('/login', login);

// @route   POST /api/auth/logout
router.post('/logout', logout);

// @route   GET /api/auth/me
router.get('/me', protect, getMe);

module.exports = router;
