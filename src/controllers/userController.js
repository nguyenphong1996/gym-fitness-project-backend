// controllers/userController.js

/**
 * Get current user profile
 * Protected route - requires JWT token
 */
exports.getProfile = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: 'not_found', message: 'User not found' });

    // Return only safe fields
    const profile = {
      id: user._id,
      phone: user.phone,
      name: user.name || null,
      email: user.email || null,
      avatarUrl: user.avatarUrl || null,
      gender: user.gender || null,
      dob: user.dob || null,
      weight: user.weight || null,
      height: user.height || null,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    };

    return res.json({ ok: true, user: profile });
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
 * Can update any field independently - no field is required
 */
exports.updateProfile = async (req, res) => {
  try {
    const User = require('../models/User');
    const allowed = ['name', 'email', 'avatarUrl', 'gender', 'dob', 'weight', 'height'];
    const updates = {};

    // Basic validation and whitelist - only add fields that are actually provided
    for (const key of allowed) {
      if (req.body.hasOwnProperty(key)) {
        updates[key] = req.body[key];
      }
    }

    // Check if at least one field is being updated
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        error: 'no_updates', 
        message: 'No valid fields provided for update' 
      });
    }

    // Validate name (if provided)
    if (updates.hasOwnProperty('name')) {
      if (updates.name !== null && updates.name !== undefined && updates.name !== '') {
        if (typeof updates.name !== 'string' || updates.name.trim().length === 0) {
          return res.status(400).json({ error: 'invalid_name', message: 'Name must be a non-empty string' });
        }
        if (updates.name.length > 20) {
          return res.status(400).json({ error: 'invalid_name', message: 'Name must not exceed 20 characters' });
        }
      }
    }

    // Validate email format (if provided and not null/empty)
    if (updates.hasOwnProperty('email')) {
      if (updates.email !== null && updates.email !== undefined && updates.email !== '') {
        if (typeof updates.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
          return res.status(400).json({ error: 'invalid_email', message: 'Email format is invalid' });
        }
        if (updates.email.length > 30) {
          return res.status(400).json({ error: 'invalid_email', message: 'Email must not exceed 30 characters' });
        }
      }
    }

    // Validate avatarUrl (if provided and not null/empty)
    if (updates.hasOwnProperty('avatarUrl')) {
      if (updates.avatarUrl !== null && updates.avatarUrl !== undefined && updates.avatarUrl !== '') {
        if (typeof updates.avatarUrl !== 'string') {
          return res.status(400).json({ error: 'invalid_avatar', message: 'Avatar URL must be a string' });
        }
        // Basic URL validation
        try {
          new URL(updates.avatarUrl);
        } catch (e) {
          return res.status(400).json({ error: 'invalid_avatar', message: 'Avatar URL must be a valid URL' });
        }
      }
    }

    // Validate gender (if provided and not null/empty)
    if (updates.hasOwnProperty('gender')) {
      if (updates.gender !== null && updates.gender !== undefined && updates.gender !== '') {
        const validGenders = ['male', 'female', 'other'];
        if (!validGenders.includes(updates.gender)) {
          return res.status(400).json({ 
            error: 'invalid_gender', 
            message: 'Gender must be one of: male, female, other' 
          });
        }
      }
    }

    // Validate weight (if provided and not null)
    if (updates.hasOwnProperty('weight')) {
      if (updates.weight !== null && updates.weight !== undefined && updates.weight !== '') {
        const weight = Number(updates.weight);
        if (isNaN(weight) || weight <= 0 || weight > 300) {
          return res.status(400).json({ 
            error: 'invalid_weight', 
            message: 'Weight must be a positive number between 0 and 300 kg' 
          });
        }
        updates.weight = weight;
      }
    }

    // Validate height (if provided and not null)
    if (updates.hasOwnProperty('height')) {
      if (updates.height !== null && updates.height !== undefined && updates.height !== '') {
        const height = Number(updates.height);
        if (isNaN(height) || height <= 0 || height > 200) {
          return res.status(400).json({ 
            error: 'invalid_height', 
            message: 'Height must be a positive number between 0 and 200 cm' 
          });
        }
        updates.height = height;
      }
    }

    // Parse and validate dob (if provided and not null)
    if (updates.hasOwnProperty('dob')) {
      if (updates.dob !== null && updates.dob !== undefined && updates.dob !== '') {
        if (typeof updates.dob === 'string') {
          const parsed = new Date(updates.dob);
          if (isNaN(parsed.getTime())) {
            // Try dd/mm/yyyy format
            const parts = updates.dob.split('/');
            if (parts.length === 3) {
              const [d, m, y] = parts;
              const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
              const parsed2 = new Date(iso);
              if (!isNaN(parsed2.getTime())) {
                updates.dob = parsed2;
              } else {
                return res.status(400).json({ 
                  error: 'invalid_dob', 
                  message: 'Date of birth invalid. Use YYYY-MM-DD or dd/mm/yyyy format' 
                });
              }
            } else {
              return res.status(400).json({ 
                error: 'invalid_dob', 
                message: 'Date of birth invalid. Use YYYY-MM-DD or dd/mm/yyyy format' 
              });
            }
          } else {
            updates.dob = parsed;
          }
        }
        
        // Validate date is not in the future
        if (updates.dob && updates.dob > new Date()) {
          return res.status(400).json({ 
            error: 'invalid_dob', 
            message: 'Date of birth cannot be in the future' 
          });
        }
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'not_found', message: 'User not found' });

    return res.json({ 
      ok: true, 
      message: 'Profile updated successfully', 
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        gender: user.gender,
        dob: user.dob,
        weight: user.weight,
        height: user.height,
        updatedAt: user.updatedAt
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
