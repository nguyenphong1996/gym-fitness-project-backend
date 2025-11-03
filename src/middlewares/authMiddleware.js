// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const { JWT_SECRET } = process.env;

/**
 * Middleware to verify JWT token and attach user to request
 * Usage: Add this middleware to protected routes
 * Example: router.get('/profile', authMiddleware, profileController)
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'No token provided. Please login first.' 
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'No token provided. Please login first.' 
      });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ 
        error: 'server_error',
        message: 'JWT configuration missing' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || typeof decoded !== 'object' || !decoded.userId) {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'Invalid token payload' 
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'User not found' 
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        error: 'forbidden',
        message: 'User account is not verified' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'account_deactivated',
        message: 'User account is deactivated'
      });
    }

    // Attach user to request object
    req.user = {
      id: user._id,
      phone: user.phone,
      isVerified: user.isVerified,
      isActive: user.isActive
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'Invalid token' 
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'Token expired. Please login again.' 
      });
    }

    console.error('Auth middleware error:', err);
    return res.status(500).json({ 
      error: 'server_error',
      message: 'Authentication failed' 
    });
  }
};

module.exports = authMiddleware;
