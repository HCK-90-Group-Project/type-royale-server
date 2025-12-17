const express = require('express');
const WordController = require('../controllers/WordController.js');
const { authenticateToken, wordGenerationRateLimit } = require('../middleware/auth.js');

const router = express.Router();

/**
 * PUBLIC ENDPOINTS (untuk Socket Architect)
 */

// Generate 50-word ammo pool untuk game session
router.post('/generate-ammo',
  wordGenerationRateLimit,
  WordController.generateGameAmmo
);

// Get spell word untuk specific card type
router.get('/spell/:spellType/:difficulty',
  WordController.getSpellWord
);

// Get card deck untuk pre-loading UI
router.get('/card-deck',
  WordController.getCardDeck
);

// Get word bank statistics
router.get('/stats',
  WordController.getWordBankStats
);

/**
 * PROTECTED ENDPOINTS (butuh auth)
 */

// Regenerate words (admin function)
router.post('/regenerate',
  authenticateToken,
  wordGenerationRateLimit,
  WordController.regenerateWords
);

module.exports = router;