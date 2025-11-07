const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  listFavorites,
  markFavorite,
  removeFavorite
} = require('../controllers/favoriteVideoController');

router.use(authMiddleware);

router.get('/favorites', listFavorites);
router.post('/:videoId/favorites', markFavorite);
router.delete('/:videoId/favorites', removeFavorite);

module.exports = router;
