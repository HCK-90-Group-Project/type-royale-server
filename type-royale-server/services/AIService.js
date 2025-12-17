const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

class AIService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  /**
   * Generate spell words for Type Royale card system
   * Sesuai dengan 4 spell types: Easy Fireball, Medium Fireball, Hard Fireball, Shield
   */
  async generateSpellWords(topic = 'magic') {
    try {
      const prompt = `Generate words for a typing magic duel game with topic "${topic}". Create exactly 50 words total split into 4 spell categories:

🟢 EASY FIREBALL (15 words): 
- 3-4 letters each
- Simple, common words for spam attacks
- Low damage but fast typing

🟡 MEDIUM FIREBALL (15 words):
- 5-7 letters each  
- Moderate difficulty
- Balanced damage and speed

🔴 HARD FIREBALL (15 words):
- 8+ letters each
- Complex words or short phrases
- High damage but slow typing, gives opponent time to shield

🛡️ SHIELD (5 words):
- Defense-themed words
- Any length, focusing on protection/blocking
- Words like "Block", "Protect", "Guard", "Wall", "Defend"

Format as JSON:
{
  "easy_fireball": ["fire", "ice", "bolt", ...],
  "medium_fireball": ["wizard", "potion", "magic", ...],
  "hard_fireball": ["enchantment", "spellcaster", "mystical", ...],
  "shield": ["block", "protect", "guard", "wall", "defend"]
}

Topic context: ${topic}
All words should be appropriate for a fantasy magic dueling game.`;

      console.log('🔮 Generating spell words with Gemini AI for card system...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const spellWords = JSON.parse(jsonMatch[0]);
      
      // Validate structure for card system
      if (!spellWords.easy_fireball || !spellWords.medium_fireball || 
          !spellWords.hard_fireball || !spellWords.shield) {
        throw new Error('Invalid spell word structure from AI');
      }

      console.log('✅ Generated spell words:', {
        easy: spellWords.easy_fireball.length,
        medium: spellWords.medium_fireball.length, 
        hard: spellWords.hard_fireball.length,
        shield: spellWords.shield.length
      });

      return spellWords;
      
    } catch (error) {
      console.error('❌ Error generating spell words:', error);
      // Fallback words for card system
      return this.getFallbackSpellWords();
    }
  }

  /**
   * Generate 50-word ammo pool for game session
   * Each player gets exactly 50 words to use in battle
   */
  async generateAmmoPool(topic = 'magic', difficulty = 'mixed') {
    try {
      const spellWords = await this.generateSpellWords(topic);
      
      // Create balanced 50-word ammo pool
      const ammoPool = {
        words: [
          ...spellWords.easy_fireball,      // 15 easy words
          ...spellWords.medium_fireball,    // 15 medium words  
          ...spellWords.hard_fireball,      // 15 hard words
          ...spellWords.shield              // 5 shield words
        ].slice(0, 50), // Ensure exactly 50 words
        
        categories: {
          easy_fireball: spellWords.easy_fireball,
          medium_fireball: spellWords.medium_fireball,
          hard_fireball: spellWords.hard_fireball,
          shield: spellWords.shield
        },
        
        metadata: {
          topic: topic,
          total_words: 50,
          generated_at: new Date().toISOString(),
          ammo_distribution: {
            easy: 15,
            medium: 15, 
            hard: 15,
            shield: 5
          }
        }
      };

      console.log(`🎯 Generated 50-word ammo pool for topic: ${topic}`);
      return ammoPool;
      
    } catch (error) {
      console.error('❌ Error generating ammo pool:', error);
      return this.getFallbackAmmoPool();
    }
  }

  /**
   * Get word for specific spell card type
   */
  getSpellWord(spellType, difficulty, wordList) {
    const words = wordList.categories[`${difficulty}_${spellType}`] || 
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
      speed: this.getSpellSpeed(spellType, difficulty)
    };
  }

  /**
   * Get spell damage based on card type
   */
  getSpellDamage(spellType, difficulty) {
    const damageMap = {
      'easy_fireball': 10,
      'medium_fireball': 30, 
      'hard_fireball': 80,
      'shield': 0 // Shield blocks damage
    };
    return damageMap[`${difficulty}_${spellType}`] || damageMap[spellType] || 10;
  }

  /**
   * Get spell speed based on card type  
   */
  getSpellSpeed(spellType, difficulty) {
    const speedMap = {
      'easy_fireball': 'fast',
      'medium_fireball': 'normal',
      'hard_fireball': 'slow', 
      'shield': 'instant'
    };
    return speedMap[`${difficulty}_${spellType}`] || speedMap[spellType] || 'normal';
  }

  /**
   * Fallback spell words if AI fails
   */
  getFallbackSpellWords() {
    return {
      easy_fireball: ["fire", "ice", "bolt", "burn", "zap", "hit", "boom", "pop", "bang", "red", "hot", "sun", "orb", "ray", "glow"],
      medium_fireball: ["wizard", "potion", "magic", "flame", "blast", "power", "energy", "strike", "mystic", "arcane", "spell", "force", "ember", "flash", "storm"], 
      hard_fireball: ["enchantment", "spellcaster", "mystical", "thunderbolt", "incinerate", "obliterate", "devastation", "annihilation", "metamorphosis", "supernatural", "extraordinary", "magnificent", "spectacular", "overwhelming", "apocalyptic"],
      shield: ["block", "protect", "guard", "wall", "defend"]
    };
  }

  /**
   * Fallback ammo pool if AI fails
   */
  getFallbackAmmoPool() {
    const fallbackWords = this.getFallbackSpellWords();
    return {
      words: [
        ...fallbackWords.easy_fireball,
        ...fallbackWords.medium_fireball,
        ...fallbackWords.hard_fireball,
        ...fallbackWords.shield
      ].slice(0, 50),
      categories: fallbackWords,
      metadata: {
        topic: 'magic',
        total_words: 50,
        generated_at: new Date().toISOString(),
        source: 'fallback',
        ammo_distribution: { easy: 15, medium: 15, hard: 15, shield: 5 }
      }
    };
  }

  /**
   * Get fallback word for specific spell type
   */
  getFallbackWord(spellType, difficulty) {
    const fallbackWords = this.getFallbackSpellWords();
    const words = fallbackWords[`${difficulty}_${spellType}`] || fallbackWords[spellType];
    
    return {
      word: words[0] || 'magic',
      spell_type: spellType,
      difficulty: difficulty,
      damage: this.getSpellDamage(spellType, difficulty),
      speed: this.getSpellSpeed(spellType, difficulty)
    };
  }
}

// Export singleton instance
const aiService = new AIService();
module.exports = aiService;