const { GoogleGenerativeAI } = require("@google/generative-ai");
const { wordPool } = require("../data/wordPool");
const dotenv = require("dotenv");

dotenv.config();

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    this.isInitialized = false;

    // Initialize Gemini if API key exists
    if (this.apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        this.isInitialized = true;
        console.log("✅ Gemini AI initialized successfully");
      } catch (error) {
        console.error("❌ Failed to initialize Gemini AI:", error.message);
        this.isInitialized = false;
      }
    } else {
      console.warn("⚠️ GEMINI_API_KEY not found, using fallback word pool");
    }
  }

  /**
   * Generate spell words for Type Royale card system
   * Sesuai dengan 4 spell types: Easy Fireball, Medium Fireball, Hard Fireball, Shield
   */
  async generateSpellWords(topic = "magic") {
    // Check if Gemini is available
    if (!this.isInitialized || !this.model) {
      console.log("⚠️ Gemini AI not available, using fallback words");
      return this.getFallbackSpellWords();
    }

    try {
      const prompt = `Generate words for a typing magic duel game with topic "${topic}". Create exactly 50 words total split into 4 spell categories.

IMPORTANT: Words MUST have mixed case (uppercase and lowercase) for typing challenge. Examples: "FirE", "DRAGON", "MagicaL", "ProtecT"

🟢 EASY FIREBALL (15 words): 
- 3-4 letters each
- Simple words with mixed case
- Examples: "Cat", "DOG", "Fire", "ICE"

🟡 MEDIUM FIREBALL (15 words):
- 5-7 letters each  
- Moderate difficulty with mixed case
- Examples: "Magic", "SPELL", "WizarD", "Phoenix"

🔴 HARD FIREBALL (15 words):
- 8+ letters each
- Complex words with mixed case
- Examples: "MetamorphosiS", "ExtraordinARY", "CatastrophE"

🛡️ SHIELD (5 words):
- Defense-themed words with mixed case
- Examples: "Block", "GUARD", "ProtecT", "DEFEND"

Format as JSON:
{
  "easy_fireball": ["Cat", "DOG", "Fire", "ICE", ...],
  "medium_fireball": ["Magic", "SPELL", "WizarD", ...],
  "hard_fireball": ["MetamorphosiS", "ExtraordinARY", ...],
  "shield": ["Block", "GUARD", "ProtecT", "DEFEND", "Wall"]
}

Topic context: ${topic}
All words should be appropriate for a fantasy magic dueling game.
REMEMBER: Use mixed case (combination of uppercase and lowercase) for ALL words!`;

      console.log(
        "🔮 Generating spell words with Gemini AI for card system..."
      );

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("⚠️ No valid JSON found in AI response, using fallback");
        return this.getFallbackSpellWords();
      }

      const spellWords = JSON.parse(jsonMatch[0]);

      // Validate structure for card system
      if (
        !spellWords.easy_fireball ||
        !spellWords.medium_fireball ||
        !spellWords.hard_fireball ||
        !spellWords.shield
      ) {
        console.warn("⚠️ Invalid spell word structure from AI, using fallback");
        return this.getFallbackSpellWords();
      }

      // Validate word counts
      if (
        spellWords.easy_fireball.length < 5 ||
        spellWords.medium_fireball.length < 5 ||
        spellWords.hard_fireball.length < 5 ||
        spellWords.shield.length < 3
      ) {
        console.warn("⚠️ Insufficient words from AI, using fallback");
        return this.getFallbackSpellWords();
      }

      console.log("✅ Generated spell words from Gemini AI:", {
        easy: spellWords.easy_fireball.length,
        medium: spellWords.medium_fireball.length,
        hard: spellWords.hard_fireball.length,
        shield: spellWords.shield.length,
        source: "gemini",
      });

      return spellWords;
    } catch (error) {
      console.error("❌ Error generating spell words:", error.message);

      // Check for specific API errors
      if (
        error.message?.includes("quota") ||
        error.message?.includes("limit")
      ) {
        console.warn("⚠️ Gemini API quota exceeded, using fallback");
      } else if (
        error.message?.includes("API_KEY") ||
        error.message?.includes("authentication")
      ) {
        console.warn("⚠️ Gemini API key invalid, using fallback");
      }

      return this.getFallbackSpellWords();
    }
  }

  /**
   * Generate 50-word ammo pool for game session
   * Each player gets exactly 50 words to use in battle
   */
  async generateAmmoPool(topic = "magic", difficulty = "mixed") {
    try {
      const spellWords = await this.generateSpellWords(topic);

      // Create balanced 50-word ammo pool
      const ammoPool = {
        words: [
          ...spellWords.easy_fireball, // 15 easy words
          ...spellWords.medium_fireball, // 15 medium words
          ...spellWords.hard_fireball, // 15 hard words
          ...spellWords.shield, // 5 shield words
        ].slice(0, 50), // Ensure exactly 50 words

        categories: {
          easy_fireball: spellWords.easy_fireball,
          medium_fireball: spellWords.medium_fireball,
          hard_fireball: spellWords.hard_fireball,
          shield: spellWords.shield,
        },

        metadata: {
          topic: topic,
          total_words: 50,
          generated_at: new Date().toISOString(),
          ammo_distribution: {
            easy: 15,
            medium: 15,
            hard: 15,
            shield: 5,
          },
        },
      };

      console.log(`🎯 Generated 50-word ammo pool for topic: ${topic}`);
      return ammoPool;
    } catch (error) {
      console.error("❌ Error generating ammo pool:", error);
      return this.getFallbackAmmoPool();
    }
  }

  /**
   * Get word for specific spell card type
   */
  getSpellWord(spellType, difficulty, wordList) {
    const words =
      wordList.categories[`${difficulty}_${spellType}`] ||
      wordList.categories[spellType];

    if (!words || words.length === 0) {
      return this.getFallbackWord(spellType, difficulty);
    }

    // Return random word from category
    const randomIndex = Math.floor(Math.random() * words.length);
    return {
      word: words[randomIndex],
      spell_type: spellType,
      difficulty: difficulty,
      damage: this.getSpellDamage(spellType, difficulty),
      speed: this.getSpellSpeed(spellType, difficulty),
    };
  }

  /**
   * Get spell damage based on card type
   */
  getSpellDamage(spellType, difficulty) {
    const damageMap = {
      easy_fireball: 10,
      medium_fireball: 30,
      hard_fireball: 80,
      shield: 0, // Shield blocks damage
    };
    return (
      damageMap[`${difficulty}_${spellType}`] || damageMap[spellType] || 10
    );
  }

  /**
   * Get spell speed based on card type
   */
  getSpellSpeed(spellType, difficulty) {
    const speedMap = {
      easy_fireball: "fast",
      medium_fireball: "normal",
      hard_fireball: "slow",
      shield: "instant",
    };
    return (
      speedMap[`${difficulty}_${spellType}`] || speedMap[spellType] || "normal"
    );
  }

  /**
   * Fallback spell words if AI fails - uses predefined wordPool with mixed case
   */
  getFallbackSpellWords() {
    console.log("📦 Using fallback word pool (mixed case)");

    return {
      easy_fireball: [...wordPool.easy].slice(0, 15),
      medium_fireball: [...wordPool.medium].slice(0, 15),
      hard_fireball: [...wordPool.hard].slice(0, 15),
      shield: [...wordPool.shield].slice(0, 5),
    };
  }

  /**
   * Fallback ammo pool if AI fails - uses predefined wordPool
   */
  getFallbackAmmoPool() {
    const fallbackWords = this.getFallbackSpellWords();
    return {
      words: [
        ...fallbackWords.easy_fireball,
        ...fallbackWords.medium_fireball,
        ...fallbackWords.hard_fireball,
        ...fallbackWords.shield,
      ].slice(0, 50),
      categories: fallbackWords,
      metadata: {
        topic: "Fantasy Battle",
        total_words: 50,
        generated_at: new Date().toISOString(),
        source: "fallback",
        ammo_distribution: { easy: 15, medium: 15, hard: 15, shield: 5 },
      },
    };
  }

  /**
   * Get fallback word for specific spell type
   */
  getFallbackWord(spellType, difficulty) {
    const fallbackWords = this.getFallbackSpellWords();
    const categoryKey = `${difficulty}_${spellType}`;
    const words =
      fallbackWords[categoryKey] ||
      fallbackWords[`${spellType}_fireball`] ||
      fallbackWords.easy_fireball;

    return {
      word: words[Math.floor(Math.random() * words.length)] || "Magic",
      spell_type: spellType,
      difficulty: difficulty,
      damage: this.getSpellDamage(spellType, difficulty),
      speed: this.getSpellSpeed(spellType, difficulty),
    };
  }
}

// Export singleton instance
const aiService = new AIService();
module.exports = aiService;
