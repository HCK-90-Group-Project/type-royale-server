const { User } = require('../models/index.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

class AuthController {
  
  // Register user for Type Royale
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { username, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ username }, { email }]
        }
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: existingUser.username === username 
            ? 'Username already taken' 
            : 'Email already registered'
        });
      }

      // Create new spellcaster
      const newUser = await User.create({
        username,
        email,
        password,
        level: 1,
        experience: 0,
        total_matches: 0,
        total_wins: 0,
        total_losses: 0
      });

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: newUser.id, 
          username: newUser.username,
          level: newUser.level
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      console.log(`✅ New spellcaster registered: ${username}`);

      res.status(201).json({
        success: true,
        message: 'Spellcaster registered successfully',
        data: {
          user: newUser.toJSON(),
          token
        }
      });

    } catch (error) {
      console.error('❌ Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }

  // Login spellcaster
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { username, password } = req.body;

      // Find user by username or email
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { username: username },
            { email: username }
          ]
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Verify password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last login
      user.last_login_at = new Date();
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username,
          level: user.level
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      console.log(`🔮 Spellcaster logged in: ${username}`);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          token
        }
      });

    } catch (error) {
      console.error('❌ Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login'
      });
    }
  }

  // Get spellcaster profile
  async getProfile(req, res) {
    try {
      const userId = req.user.userId;
      
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Spellcaster not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      console.error('❌ Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving profile'
      });
    }
  }

  // Update spellcaster profile
  async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { username, email } = req.body;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Spellcaster not found'
        });
      }

      // Check for username/email conflicts
      if (username && username !== user.username) {
        const existingUsername = await User.findOne({ where: { username } });
        if (existingUsername) {
          return res.status(409).json({
            success: false,
            message: 'Username already taken'
          });
        }
        user.username = username;
      }

      if (email && email !== user.email) {
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
          return res.status(409).json({
            success: false,
            message: 'Email already in use'
          });
        }
        user.email = email;
      }

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      console.error('❌ Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating profile'
      });
    }
  }

  // Get spellcaster leaderboard
  async getLeaderboard(req, res) {
    try {
      const { limit = 10, offset = 0 } = req.query;

      const topSpellcasters = await User.findAll({
        attributes: [
          'id', 'username', 'level', 'experience', 
          'total_matches', 'total_wins', 'win_rate',
          'highest_wpm', 'total_spells_cast', 'total_hp_dealt'
        ],
        where: { is_active: true },
        order: [
          ['level', 'DESC'],
          ['experience', 'DESC'],
          ['win_rate', 'DESC']
        ],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          leaderboard: topSpellcasters,
          total: topSpellcasters.length
        }
      });

    } catch (error) {
      console.error('❌ Leaderboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving leaderboard'
      });
    }
  }
}

// Validation middlewares
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be 3-50 characters long')
    .isAlphanumeric()
    .withMessage('Username must contain only letters and numbers'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username/email is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updateProfileValidation = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be 3-50 characters long')
    .isAlphanumeric()
    .withMessage('Username must contain only letters and numbers'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
];

module.exports = {
  AuthController: new AuthController(),
  registerValidation,
  loginValidation,
  updateProfileValidation
};