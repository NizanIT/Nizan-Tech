const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
};

const requireEmployee = (req, res, next) => {
  if (req.user && (req.user.role === 'employee' || req.user.role === 'admin')) return next();
  return res.status(403).json({ success: false, message: 'Access denied.' });
};

module.exports = { requireAdmin, requireEmployee };
