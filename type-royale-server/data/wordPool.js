// Word pool for different spell types
// Words now include mixed case for stricter typing challenge
const wordPool = {
  easy: [
    "Cat",
    "DOG",
    "Run",
    "JUMP",
    "Fire",
    "ICE",
    "Wind",
    "ROCK",
    "Bolt",
    "GLOW",
    "Mist",
    "LEAF",
    "Star",
    "MOON",
    "Sun",
    "WAVE",
    "Brew",
    "CAST",
    "Dust",
    "ECHO",
    "Fade",
    "GUST",
    "Haze",
    "JINX",
  ],
  medium: [
    "Magic",
    "SPELL",
    "WizarD",
    "ArcanE",
    "MyStic",
    "ENERGY",
    "Phoenix",
    "DRAGON",
    "CrystAL",
    "ThundeR",
    "BlizzarD",
    "InfernO",
    "TempesT",
    "EclipsE",
    "SparklE",
    "ShimmeR",
    "TornadO",
    "VolcanO",
    "NebulA",
    "CosmoS",
    "GravitY",
    "PrisM",
    "MiraclE",
    "EnchanT",
  ],
  hard: [
    "ExtravaganZA",
    "ExtraordinARY",
    "MagnificenT",
    "CatastrophE",
    "AnnihilatioN",
    "CombustioN",
    "IncandescentT",
    "MetamorphosiS",
    "SupernovA",
    "ApocalypsE",
    "DevastatioN",
    "IncantatioN",
    "ConjuratioN",
    "AbracadabrA",
    "MysteriouS",
    "SpectaculaR",
    "PhenomenoN",
    "IlluminatioN",
    "TranscendenT",
    "OverwhelminG",
  ],
  shield: [
    "Block",
    "GUARD",
    "ProtecT",
    "DEFEND",
    "BarrieR",
    "SHIELD",
    "Wall",
    "ARMOR",
    "FortresS",
    "AEGIS",
    "BulwarK",
    "RAMPART",
    "SanctuarY",
    "SAFEGUARD",
    "DeflecT",
    "PARRY",
    "CounteR",
    "RESIST",
  ],
};

// Card configurations
const cardConfig = {
  easy: {
    damage: 10,
    speed: 1000, // ms to reach target (fast)
    color: "#00FF00",
  },
  medium: {
    damage: 15,
    speed: 2000, // ms to reach target (normal)
    color: "#FFFF00",
  },
  hard: {
    damage: 20,
    speed: 3500, // ms to reach target (slow)
    color: "#FF0000",
  },
  shield: {
    duration: 3000, // ms shield stays active
    blockCount: 1, // blocks 1 attack
    color: "#00FFFF",
  },
};

// Function to get random words for a player
function getRandomWords(count = 50) {
  const words = [];
  const categories = ["easy", "medium", "hard", "shield"];

  // Distribution: 40% easy, 30% medium, 20% hard, 10% shield
  const distribution = {
    easy: Math.floor(count * 0.4),
    medium: Math.floor(count * 0.3),
    hard: Math.floor(count * 0.2),
    shield: Math.floor(count * 0.1),
  };

  // Fill remaining to reach exact count
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  distribution.easy += count - total;

  for (const [category, amount] of Object.entries(distribution)) {
    const pool = [...wordPool[category]];
    for (let i = 0; i < amount; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      words.push({
        word: pool[randomIndex],
        type: category,
        used: false,
      });
    }
  }

  // Shuffle the words
  return words.sort(() => Math.random() - 0.5);
}

module.exports = {
  wordPool,
  cardConfig,
  getRandomWords,
};
