// controllers/userController.js

/**
 * Get current user profile
 * Protected route - requires JWT token
 */
exports.getProfile = async (req, res) => {
  try {
    // req.user is attached by authMiddleware
    return res.json({
      ok: true,
      user: req.user
    });
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to get profile' 
    });
  }
};

/**
 * Update user profile
 * Protected route - requires JWT token
 */
exports.updateProfile = async (req, res) => {
  try {
    const User = require('../models/User');
    const { name, email } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        error: 'not_found',
        message: 'User not found' 
      });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    
    await user.save();

    return res.json({
      ok: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to update profile' 
    });
  }
};
