const { cardConfig, getRandomWords } = require('../data/wordPool');

// Store active game rooms
const rooms = new Map();

// Game constants
const INITIAL_HP = 100;
const INITIAL_AMMO = 50;

class GameRoom {
  constructor(roomId, host) {
    this.roomId = roomId;
    this.players = {
      player1: {
        socketId: host.socketId,
        username: host.username,
        hp: INITIAL_HP,
        words: getRandomWords(INITIAL_AMMO),
        ammoCount: INITIAL_AMMO,
        shield: {
          active: false,
          activatedAt: null,
          blockCount: 0
        },
        ready: false
      },
      player2: null
    };
    this.gameStarted = false;
    this.createdAt = Date.now();
    this.pendingAttacks = []; // Queue of attacks in flight
  }

  addPlayer(player) {
    if (this.players.player2) {
      return { success: false, message: 'Room is full' };
    }

    this.players.player2 = {
      socketId: player.socketId,
      username: player.username,
      hp: INITIAL_HP,
      words: getRandomWords(INITIAL_AMMO),
      ammoCount: INITIAL_AMMO,
      shield: {
        active: false,
        activatedAt: null,
        blockCount: 0
      },
      ready: false
    };

    return { success: true };
  }

  getPlayerBySocketId(socketId) {
    if (this.players.player1?.socketId === socketId) return 'player1';
    if (this.players.player2?.socketId === socketId) return 'player2';
    return null;
  }

  getOpponent(playerId) {
    return playerId === 'player1' ? 'player2' : 'player1';
  }

  setReady(playerId) {
    if (this.players[playerId]) {
      this.players[playerId].ready = true;
    }
    
    // Check if both players are ready
    if (this.players.player1?.ready && this.players.player2?.ready) {
      this.gameStarted = true;
      return true;
    }
    return false;
  }

  activateShield(playerId) {
    const player = this.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    // Check if player has shield words available
    const shieldWord = player.words.find(w => w.type === 'shield' && !w.used);
    if (!shieldWord) {
      return { success: false, message: 'No shield available' };
    }

    // Mark word as used
    shieldWord.used = true;
    player.ammoCount--;

    // Activate shield
    player.shield.active = true;
    player.shield.activatedAt = Date.now();
    player.shield.blockCount = cardConfig.shield.blockCount;

    // Auto-deactivate after duration
    setTimeout(() => {
      if (player.shield.active && player.shield.blockCount > 0) {
        player.shield.active = false;
        player.shield.blockCount = 0;
      }
    }, cardConfig.shield.duration);

    return { 
      success: true, 
      shield: player.shield,
      ammoCount: player.ammoCount
    };
  }

  launchAttack(playerId, attackType) {
    const player = this.players[playerId];
    const opponent = this.players[this.getOpponent(playerId)];
    
    if (!player || !opponent) {
      return { success: false, message: 'Invalid players' };
    }

    // Check if player has this type of word available
    const attackWord = player.words.find(w => w.type === attackType && !w.used);
    if (!attackWord) {
      return { success: false, message: 'No word of this type available' };
    }

    // Mark word as used
    attackWord.used = true;
    player.ammoCount--;

    const config = cardConfig[attackType];
    const attackId = `${this.roomId}_${Date.now()}_${Math.random()}`;

    const attack = {
      id: attackId,
      from: playerId,
      to: this.getOpponent(playerId),
      type: attackType,
      damage: config.damage,
      speed: config.speed,
      launchedAt: Date.now(),
      word: attackWord.word
    };

    // Add to pending attacks
    this.pendingAttacks.push(attack);

    return { 
      success: true, 
      attack,
      ammoCount: player.ammoCount
    };
  }

  resolveAttack(attackId) {
    const attackIndex = this.pendingAttacks.findIndex(a => a.id === attackId);
    if (attackIndex === -1) return null;

    const attack = this.pendingAttacks[attackIndex];
    const target = this.players[attack.to];

    let result = {
      attackId,
      blocked: false,
      damage: attack.damage,
      targetHp: target.hp
    };

    // Check if shield is active
    if (target.shield.active && target.shield.blockCount > 0) {
      // Shield blocks the attack
      result.blocked = true;
      result.damage = 0;
      target.shield.blockCount--;
      
      // Deactivate shield if no more blocks
      if (target.shield.blockCount <= 0) {
        target.shield.active = false;
      }
    } else {
      // Apply damage
      target.hp = Math.max(0, target.hp - attack.damage);
      result.targetHp = target.hp;
    }

    // Remove attack from pending
    this.pendingAttacks.splice(attackIndex, 1);

    return result;
  }

  checkWinCondition() {
    const p1 = this.players.player1;
    const p2 = this.players.player2;

    // Check HP
    if (p1.hp <= 0) {
      return { gameOver: true, winner: 'player2', reason: 'knockout' };
    }
    if (p2.hp <= 0) {
      return { gameOver: true, winner: 'player1', reason: 'knockout' };
    }

    // Check ammo
    if (p1.ammoCount <= 0 && p2.ammoCount <= 0) {
      // Both out of ammo, compare HP
      if (p1.hp > p2.hp) {
        return { gameOver: true, winner: 'player1', reason: 'out_of_ammo' };
      } else if (p2.hp > p1.hp) {
        return { gameOver: true, winner: 'player2', reason: 'out_of_ammo' };
      } else {
        return { gameOver: true, winner: 'draw', reason: 'tie' };
      }
    }

    return { gameOver: false };
  }

  getGameState() {
    return {
      roomId: this.roomId,
      gameStarted: this.gameStarted,
      player1: {
        username: this.players.player1?.username,
        hp: this.players.player1?.hp,
        ammoCount: this.players.player1?.ammoCount,
        shield: this.players.player1?.shield,
        ready: this.players.player1?.ready
      },
      player2: this.players.player2 ? {
        username: this.players.player2.username,
        hp: this.players.player2.hp,
        ammoCount: this.players.player2.ammoCount,
        shield: this.players.player2.shield,
        ready: this.players.player2.ready
      } : null
    };
  }
}

module.exports = {
  rooms,
  GameRoom
};
