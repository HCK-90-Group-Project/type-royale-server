const express = require('express');
const { 
  AuthController,
  registerValidation, 
  loginValidation, 
  updateProfileValidation 
} = require('../controllers/AuthController.js');
const { authenticateToken, authRateLimit } = require('../middleware/auth.js');

const router = express.Router();

// Public routes
router.post('/register', 
  authRateLimit,
  registerValidation,
  AuthController.register
);

router.post('/login', 
  authRateLimit,
  loginValidation,
  AuthController.login
);

// Protected routes
router.get('/profile',
  authenticateToken,
  AuthController.getProfile
);

router.put('/profile',
  authenticateToken,
  updateProfileValidation,
  AuthController.updateProfile
);

router.get('/leaderboard',
  AuthController.getLeaderboard
);

module.exports = router;