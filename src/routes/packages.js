const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');

// GET /api/packages - Public route to list active packages
router.get('/', packageController.listPublicPackages);

module.exports = router;