// middlewares/staffMiddleware.js
const { logWarning } = require('../utils/logger');

const staffMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
  }

  if (req.user.role !== 'staff') {
    logWarning('staffMiddleware', 'Non-staff tried to access staff route', {
      userId: req.user.id,
      role: req.user.role
    });
    return res.status(403).json({
      error: 'forbidden',
      message: 'Staff access required'
    });
  }

  next();
};

module.exports = staffMiddleware;
