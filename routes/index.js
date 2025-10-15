var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* Health check endpoint for Docker */
router.get('/health', function(req, res) {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
