const AIService = require("../services/AIService.js");
const { WordBank } = require("../models/index.js");
const { Op } = require("sequelize");

class WordController {
  /**
   * Generate 50-word ammo pool for Type Royale game session
   * Endpoint utama untuk Socket Architect
   */
  async generateGameAmmo(req, res) {
    try {
      const { topic = "magic", forceGenerate = false } = req.body;

      console.log(`🎮 Generating 50-word ammo pool for topic: ${topic}`);

      // Check if we already have words for this topic
      if (!forceGenerate) {
        const existingWords = await this.getExistingAmmoPool(topic);
        if (existingWords) {
          console.log(`✅ Using existing ammo pool for topic: ${topic}`);
          return res.json({
            success: true,
            data: existingWords,
            cached: true,
          });
        }
      }

      // Generate new ammo pool with AI
      const ammoPool = await AIService.generateAmmoPool(topic);

      // Store words in database for future use
      await this.storeAmmoPool(topic, ammoPool);

      res.json({
        success: true,
        message: "50-word ammo pool generated successfully",
        data: ammoPool,
      });
    } catch (error) {
      console.error("❌ Error generating game ammo:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate ammo pool",
        error: error.message,
      });
    }
  }

  /**
   * Get random spell word for specific card type
   * Dipanggil saat player klik kartu spell
   */
  async getSpellWord(req, res) {
    try {
      const { spellType, difficulty } = req.params;
      const { topic = "magic" } = req.query;

      // Validate spell type
      const validSpellTypes = [
        "easy_fireball",
        "medium_fireball",
        "hard_fireball",
        "shield",
      ];
      if (!validSpellTypes.includes(spellType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid spell type",
        });
      }

      // Find word bank for this spell type
      const wordBank = await WordBank.findOne({
        where: {
          topic: topic,
          spell_type: spellType,
          is_active: true,
        },
      });

      if (!wordBank) {
        // Generate fallback word
        const fallbackWord = AIService.getFallbackWord(spellType, difficulty);
        return res.json({
          success: true,
          data: fallbackWord,
          fallback: true,
        });
      }

      // Get random word from word bank
      const spellWord = wordBank.getRandomWord();

      // Increment usage count
      await wordBank.incrementUsage();

      res.json({
        success: true,
        data: spellWord,
      });
    } catch (error) {
      console.error("❌ Error getting spell word:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get spell word",
      });
    }
  }

  /**
   * Get multiple words for card deck
   * Untuk pre-load kata-kata ke UI player
   */
  async getCardDeck(req, res) {
    try {
      const { topic = "magic", count = 10 } = req.query;

      const deckWords = {
        easy_fireball: [],
        medium_fireball: [],
        hard_fireball: [],
        shield: [],
      };

      // Get words for each spell type
      for (const spellType of Object.keys(deckWords)) {
        const wordBank = await WordBank.findOne({
          where: {
            topic: topic,
            spell_type: spellType,
            is_active: true,
          },
        });

        if (wordBank) {
          deckWords[spellType] = wordBank.getRandomWords(Math.ceil(count / 4));
        }
      }

      res.json({
        success: true,
        data: {
          topic: topic,
          deck: deckWords,
          total_words: Object.values(deckWords).flat().length,
        },
      });
    } catch (error) {
      console.error("❌ Error getting card deck:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get card deck",
      });
    }
  }

  /**
   * Get word bank statistics
   * Untuk monitoring dan analytics
   */
  async getWordBankStats(req, res) {
    try {
      const stats = await WordBank.findAll({
        attributes: [
          "topic",
          "spell_type",
          [
            WordBank.sequelize.fn("COUNT", WordBank.sequelize.col("id")),
            "bank_count",
          ],
          [
            WordBank.sequelize.fn("SUM", WordBank.sequelize.col("word_count")),
            "total_words",
          ],
          [
            WordBank.sequelize.fn("SUM", WordBank.sequelize.col("usage_count")),
            "total_usage",
          ],
        ],
        where: { is_active: true },
        group: ["topic", "spell_type"],
        raw: true,
      });

      const formattedStats = stats.reduce((acc, stat) => {
        if (!acc[stat.topic]) {
          acc[stat.topic] = {};
        }
        acc[stat.topic][stat.spell_type] = {
          bank_count: parseInt(stat.bank_count),
          total_words: parseInt(stat.total_words) || 0,
          total_usage: parseInt(stat.total_usage) || 0,
        };
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          statistics: formattedStats,
          topics_available: Object.keys(formattedStats),
        },
      });
    } catch (error) {
      console.error("❌ Error getting word bank stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get statistics",
      });
    }
  }

  /**
   * Regenerate words for specific topic
   * Admin function untuk refresh word banks
   */
  async regenerateWords(req, res) {
    try {
      const { topic, spellType } = req.body;

      if (!topic) {
        return res.status(400).json({
          success: false,
          message: "Topic is required",
        });
      }

      // Delete existing words if spellType specified
      if (spellType) {
        await WordBank.destroy({
          where: {
            topic: topic,
            spell_type: spellType,
          },
        });
      } else {
        // Delete all words for topic
        await WordBank.destroy({
          where: { topic: topic },
        });
      }

      // Generate new words
      const ammoPool = await AIService.generateAmmoPool(topic);
      await this.storeAmmoPool(topic, ammoPool);

      console.log(`♻️ Regenerated words for topic: ${topic}`);

      res.json({
        success: true,
        message: `Words regenerated for topic: ${topic}`,
        data: ammoPool,
      });
    } catch (error) {
      console.error("❌ Error regenerating words:", error);
      res.status(500).json({
        success: false,
        message: "Failed to regenerate words",
      });
    }
  }

  // Helper methods

  /**
   * Get existing ammo pool from database
   */
  async getExistingAmmoPool(topic) {
    try {
      const wordBanks = await WordBank.findAll({
        where: {
          topic: topic,
          is_active: true,
        },
      });

      if (wordBanks.length === 0) return null;

      const ammoPool = {
        words: [],
        categories: {
          easy_fireball: [],
          medium_fireball: [],
          hard_fireball: [],
          shield: [],
        },
        metadata: {
          topic: topic,
          total_words: 0,
          cached: true,
          generated_at: wordBanks[0].createdAt,
        },
      };

      // Combine words from all spell types
      wordBanks.forEach((bank) => {
        const words = Array.isArray(bank.words) ? bank.words : [];
        ammoPool.categories[bank.spell_type] = words;
        ammoPool.words.push(...words);
      });

      ammoPool.metadata.total_words = ammoPool.words.length;

      return ammoPool.words.length >= 40 ? ammoPool : null; // Ensure sufficient words
    } catch (error) {
      console.error("❌ Error getting existing ammo pool:", error);
      return null;
    }
  }

  /**
   * Store ammo pool in database
   */
  async storeAmmoPool(topic, ammoPool) {
    try {
      const spellTypes = [
        "easy_fireball",
        "medium_fireball",
        "hard_fireball",
        "shield",
      ];

      for (const spellType of spellTypes) {
        const words = ammoPool.categories[spellType] || [];

        if (words.length > 0) {
          await WordBank.create({
            topic: topic,
            spell_type: spellType,
            difficulty_level: spellType.includes("fireball")
              ? spellType.replace("_fireball", "")
              : "shield",
            words: words,
            word_count: words.length,
            ai_model: "gemini-pro",
            generated_by_ai: true,
            damage_value: WordBank.getSpellDamage(spellType),
            spell_speed: WordBank.getSpellSpeed(spellType),
            is_active: true,
          });
        }
      }

      console.log(`💾 Stored ammo pool for topic: ${topic}`);
    } catch (error) {
      console.error("❌ Error storing ammo pool:", error);
      throw error;
    }
  }
}

module.exports = new WordController();
