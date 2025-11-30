const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const staffMiddleware = require('../middlewares/staffMiddleware');
const {
  getMyAvailability,
  setMyAvailability
} = require('../controllers/staffAvailabilityController');

router.get('/availability', authMiddleware, staffMiddleware, getMyAvailability);
router.put('/availability', authMiddleware, staffMiddleware, setMyAvailability);

module.exports = router;
