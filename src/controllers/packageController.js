const MembershipPackage = require('../models/MembershipPackage');
const { logInfo, logError } = require('../utils/logger');

exports.createPackage = async (req, res) => {
  const context = 'packageController.createPackage';
  try {
    const { name, description, type, price, durationDays, sessionCount } = req.body;

    if (!name || !type || price === undefined || !durationDays) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, type, price, durationDays'
      });
    }

    const newPackage = await MembershipPackage.create({
      name,
      description,
      type,
      price,
      durationDays,
      sessionCount: sessionCount || 0
    });

    logInfo(context, 'Created new package', { packageId: newPackage._id, name });

    return res.status(201).json({
      success: true,
      data: newPackage
    });
  } catch (error) {
    logError(context, 'Failed to create package', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

exports.listPackages = async (req, res) => {
  try {
    const { type, isActive, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [packages, total] = await Promise.all([
      MembershipPackage.find(filter).sort({ price: 1 }).skip(skip).limit(parseInt(limit)),
      MembershipPackage.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: packages,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to list packages' });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const pkg = await MembershipPackage.findByIdAndUpdate(id, updates, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    return res.json({ success: true, data: pkg });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update package' });
  }
};

exports.togglePackageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await MembershipPackage.findById(id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    pkg.isActive = !pkg.isActive;
    await pkg.save();

    return res.json({ success: true, data: pkg, message: `Package is now ${pkg.isActive ? 'active' : 'inactive'}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
};
