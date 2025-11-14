const { logWarning } = require('../utils/logger');

const customerMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'customer') {
    logWarning('customerMiddleware', 'Non-customer tried to access customer route', {
      userId: req.user.id,
      role: req.user.role
    });
    return res.status(403).json({
      error: 'forbidden',
      message: 'Customer access required'
    });
  }

  next();
};

module.exports = customerMiddleware;
