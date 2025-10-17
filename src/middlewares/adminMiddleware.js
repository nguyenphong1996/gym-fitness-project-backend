const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logError, logInfo } = require('../utils/logger');

const adminMiddleware = async (req, res, next) => {
  try {
    // 1. Kiểm tra Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 2. Extract token
    const token = authHeader.substring(7);

    // 3. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // 4. Lấy user từ database (support cả id và userId)
    const userId = decoded.id || decoded.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // 5. Kiểm tra role admin
    if (user.role !== 'admin') {
      logInfo(`⛔ Non-admin access attempt: ${user.phone} (role: ${user.role})`);
      return res.status(403).json({ 
        message: 'Forbidden - Admin access required',
        yourRole: user.role 
      });
    }

    // 6. Attach user to request
    req.user = user;
    logInfo(`✅ Admin verified: ${user.phone}`);
    next();
  } catch (error) {
    logError('❌ Admin middleware error', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = adminMiddleware;
