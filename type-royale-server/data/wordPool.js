// Word pool for different spell types
const wordPool = {
  easy: [
    'cat', 'dog', 'run', 'jump', 'fire', 'ice', 'wind', 'rock',
    'bolt', 'glow', 'mist', 'leaf', 'star', 'moon', 'sun', 'wave',
    'brew', 'cast', 'dust', 'echo', 'fade', 'gust', 'haze', 'jinx'
  ],
  medium: [
    'magic', 'spell', 'wizard', 'arcane', 'mystic', 'energy',
    'phoenix', 'dragon', 'crystal', 'thunder', 'blizzard', 'inferno',
    'tempest', 'eclipse', 'sparkle', 'shimmer', 'tornado', 'volcano',
    'nebula', 'cosmos', 'gravity', 'prism', 'miracle', 'enchant'
  ],
  hard: [
    'extravaganza', 'extraordinary', 'magnificent', 'catastrophe',
    'annihilation', 'combustion', 'incandescent', 'metamorphosis',
    'supernova', 'apocalypse', 'devastation', 'incantation',
    'conjuration', 'abracadabra', 'mysterious', 'spectacular',
    'phenomenon', 'illumination', 'transcendent', 'overwhelming'
  ],
  shield: [
    'block', 'guard', 'protect', 'defend', 'barrier', 'shield',
    'wall', 'armor', 'fortress', 'aegis', 'bulwark', 'rampart',
    'sanctuary', 'safeguard', 'deflect', 'parry', 'counter', 'resist'
  ]
};

// Card configurations
const cardConfig = {
  easy: {
    damage: 10,
    speed: 1000, // ms to reach target (fast)
    color: '#00FF00'
  },
  medium: {
    damage: 30,
    speed: 2000, // ms to reach target (normal)
    color: '#FFFF00'
  },
  hard: {
    damage: 80,
    speed: 3500, // ms to reach target (slow)
    color: '#FF0000'
  },
  shield: {
    duration: 3000, // ms shield stays active
    blockCount: 1, // blocks 1 attack
    color: '#00FFFF'
  }
};

// Function to get random words for a player
function getRandomWords(count = 50) {
  const words = [];
  const categories = ['easy', 'medium', 'hard', 'shield'];
  
  // Distribution: 40% easy, 30% medium, 20% hard, 10% shield
  const distribution = {
    easy: Math.floor(count * 0.4),
    medium: Math.floor(count * 0.3),
    hard: Math.floor(count * 0.2),
    shield: Math.floor(count * 0.1)
  };
  
  // Fill remaining to reach exact count
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  distribution.easy += (count - total);
  
  for (const [category, amount] of Object.entries(distribution)) {
    const pool = [...wordPool[category]];
    for (let i = 0; i < amount; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      words.push({
        word: pool[randomIndex],
        type: category,
        used: false
      });
    }
  }
  
  // Shuffle the words
  return words.sort(() => Math.random() - 0.5);
}

module.exports = {
  wordPool,
  cardConfig,
  getRandomWords
};
