const ActivityLog = require('../models/ActivityLog');

/**
 * Create a new activity log entry
 * @param {ObjectId} userId - User ID
 * @param {String} type - Log type (enum)
 * @param {Object} data - Log data
 * @param {Object} metadata - Optional metadata (ip, userAgent, device)
 * @returns {Promise<ActivityLog>}
 */
exports.createLog = async (userId, type, data = {}, metadata = {}) => {
  try {
    const log = new ActivityLog({
      userId,
      type,
      timestamp: new Date(),
      data,
      metadata: {
        ipAddress: metadata.ip || metadata.ipAddress || null,
        userAgent: metadata.userAgent || null,
        device: metadata.device || 'mobile',
        platform: metadata.platform || null,
      },
    });
    
    await log.save();
    console.log(`✅ Activity log created: ${type} for user ${userId}`);
    return log;
  } catch (error) {
    console.error('❌ Failed to create activity log:', error.message);
    // Don't throw error to avoid breaking main business logic
    return null;
  }
};

/**
 * Get user activity logs with pagination and filtering
 * @param {ObjectId} userId - User ID
 * @param {Object} options - Query options (limit, skip, type)
 * @returns {Promise<{logs: Array, total: Number}>}
 */
exports.getUserLogs = async (userId, options = {}) => {
  try {
    const { limit = 50, skip = 0, type } = options;
    
    const query = { userId };
    if (type) {
      query.type = type;
    }
    
    const logs = await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('-__v')
      .lean();
    
    const total = await ActivityLog.countDocuments(query);
    
    return { logs, total };
  } catch (error) {
    console.error('❌ Failed to get user logs:', error.message);
    throw new Error('Không thể tải lịch sử hoạt động');
  }
};

/**
 * Delete old logs (for cleanup/maintenance)
 * @param {Number} daysOld - Delete logs older than X days
 * @returns {Promise<Number>} Number of deleted logs
 */
exports.deleteOldLogs = async (daysOld = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await ActivityLog.deleteMany({
      timestamp: { $lt: cutoffDate },
    });
    
    console.log(`🗑️ Deleted ${result.deletedCount} old logs (older than ${daysOld} days)`);
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Failed to delete old logs:', error.message);
    throw error;
  }
};

/**
 * Get activity statistics for a user
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} Statistics by type
 */
exports.getUserStats = async (userId) => {
  try {
    const stats = await ActivityLog.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          lastActivity: { $max: '$timestamp' },
        },
      },
      { $sort: { count: -1 } },
    ]);
    
    return stats;
  } catch (error) {
    console.error('❌ Failed to get user stats:', error.message);
    return [];
  }
};
