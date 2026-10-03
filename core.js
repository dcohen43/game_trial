// Shared, DOM-free game logic used by both the desktop and mobile clients,
// and exercised directly by the test suite (see test/). Keep this module
// free of canvas/audio/DOM access so it runs unmodified in Node and in the
// browser (loaded as a plain classic script before game.js).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GameCore = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const ENEMY_KINDS = {
    grunt: { baseR: 17, speedMul: 1, hpMul: 1, contactDamage: 10, hue: 105, label: 'grunt' },
    brute: { baseR: 29, speedMul: 0.55, hpMul: 2.6, contactDamage: 18, hue: 15, label: 'brute' },
    spitter: { baseR: 14, speedMul: 0.9, hpMul: 0.8, contactDamage: 6, hue: 280, label: 'spitter' }
  };

  // Which enemy kind spawns next, given the current level. Takes an
  // injectable rng (0..1) so tests can pin the roll instead of depending on
  // Math.random.
  function pickEnemyKind(level, rng) {
    rng = rng || Math.random;
    const roll = rng();
    if (level >= 3 && roll < 0.2) return 'spitter';
    if (level >= 2 && roll < 0.45) return 'brute';
    return 'grunt';
  }

  // Deterministic part of an enemy's stats at a given level (excludes the
  // small per-spawn random jitter applied on top in spawnEnemy()).
  function enemyStatsForLevel(kind, level) {
    const def = ENEMY_KINDS[kind];
    if (!def) throw new Error(`Unknown enemy kind: ${kind}`);
    const speed = (1 + Math.min(level * 0.08, 2.0)) * def.speedMul;
    const hp = Math.round((2 + Math.floor(level / 4)) * def.hpMul);
    return { speed, hp, r: def.baseR, contactDamage: def.contactDamage, hue: def.hue };
  }

  // How many enemies spawn in a given level's wave.
  function enemiesPerLevel(level) {
    return 4 + level;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function circlesOverlap(x1, y1, r1, x2, y2, r2) {
    return Math.hypot(x1 - x2, y1 - y2) < r1 + r2;
  }

  // Pushes entity {x, y, r} out of any overlapping obstacle rect. Mutates
  // and returns entity.
  function resolveObstacleCollisions(entity, obstacles) {
    for (const rect of obstacles) {
      const closestX = Math.max(rect.x, Math.min(entity.x, rect.x + rect.w));
      const closestY = Math.max(rect.y, Math.min(entity.y, rect.y + rect.h));
      const dx = entity.x - closestX;
      const dy = entity.y - closestY;
      const dist = Math.hypot(dx, dy);
      if (dist < entity.r) {
        if (dist > 0.001) {
          const overlap = entity.r - dist;
          entity.x += (dx / dist) * overlap;
          entity.y += (dy / dist) * overlap;
        } else {
          entity.y -= entity.r;
        }
      }
    }
    return entity;
  }

  function circleIntersectsAnyObstacle(cx, cy, cr, obstacles) {
    for (const rect of obstacles) {
      const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
      const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
      if (Math.hypot(cx - closestX, cy - closestY) < cr) return true;
    }
    return false;
  }

  // Fire-rate cooldown (frames between shots) for the player's current weapon.
  function fireCooldown(weapon) {
    return weapon === 'rapid' ? 4 : 8;
  }

  // Whether a kill drops a pickup, and which type. Injectable rng for tests.
  // Weighted rather than uniform: 'life' is a rare bonus, not a regular drop.
  const PICKUP_TYPES = ['health', 'spread', 'rapid', 'life'];
  const PICKUP_WEIGHTS = [0.40, 0.25, 0.25, 0.10]; // must sum to 1, aligned by index to PICKUP_TYPES
  const PICKUP_DROP_CHANCE = 0.18;

  function rollPickupDrop(rng) {
    rng = rng || Math.random;
    if (rng() > PICKUP_DROP_CHANCE) return null;
    const typeRoll = rng();
    let cumulative = 0;
    for (let i = 0; i < PICKUP_TYPES.length; i++) {
      cumulative += PICKUP_WEIGHTS[i];
      if (typeRoll < cumulative) return PICKUP_TYPES[i];
    }
    return PICKUP_TYPES[PICKUP_TYPES.length - 1];
  }

  const STARTING_LIVES = 3;
  const MAX_LIVES = 5;
  const HEALTH_PICKUP_AMOUNT = 30;

  // Heals a plain player state object, capped at maxHealth. Pure — no
  // audio/DOM. Used by both health pickups and passive regen, so the cap
  // logic lives in exactly one place. Mutates and returns player.
  function healPlayer(player, amount) {
    player.health = Math.min(player.maxHealth, player.health + amount);
    return player;
  }

  // Applies a pickup's effect to a plain player state object (health,
  // maxHealth, weapon, weaponTimer, lives). Pure — no audio/DOM. Mutates and
  // returns player.
  function applyPickupEffect(player, pickupType) {
    if (pickupType === 'health') {
      healPlayer(player, HEALTH_PICKUP_AMOUNT);
    } else if (pickupType === 'life') {
      player.lives = Math.min(MAX_LIVES, (player.lives || 0) + 1);
    } else {
      player.weapon = pickupType;
      player.weaponTimer = 480;
    }
    return player;
  }

  // Applies damage to a plain entity with a .health field; returns whether
  // this hit was lethal (health <= 0).
  function applyDamage(entity, amount) {
    entity.health -= amount;
    return entity.health <= 0;
  }

  // Resolves a lethal hit against a player with a .lives field: consumes a
  // life and respawns at full health if any remain, otherwise zeroes
  // health/lives and signals game over. Pure — no audio/DOM/UI. Mutates and
  // returns { gameOver }.
  function resolveLethalHit(player) {
    if (player.lives > 1) {
      player.lives -= 1;
      player.health = player.maxHealth;
      return { gameOver: false };
    }
    player.lives = 0;
    player.health = 0;
    return { gameOver: true };
  }

  // ===== Score / combo (kill-streak momentum) =====
  const BASE_KILL_SCORE = 10;
  const COMBO_WINDOW_FRAMES = 150; // ~2.5s at 60fps to chain the next kill before the combo resets
  const COMBO_MAX_STACK = 9; // caps the multiplier at 1 + 9*0.1 = 1.9x so it can't run away

  // Score awarded for a kill at a given combo count (1 = first kill in a
  // streak), scaling up to reward chaining kills quickly. Pure, deterministic.
  function comboScore(comboCount) {
    const stacks = Math.min(Math.max(comboCount, 1) - 1, COMBO_MAX_STACK);
    return Math.round(BASE_KILL_SCORE * (1 + stacks * 0.1));
  }

  // ===== Level transition countdown =====
  const LEVEL_COUNTDOWN_FRAMES = 300; // 5s at 60fps — holds enemy spawning so
  // the player gets a clear beat to see the regenerated arena before the
  // next wave starts, instead of it changing in the same instant combat resumes.

  // Whole seconds remaining to display for a countdown timer in frames.
  function secondsRemaining(frames) {
    return Math.max(0, Math.ceil(frames / 60));
  }

  return {
    ENEMY_KINDS,
    pickEnemyKind,
    enemyStatsForLevel,
    enemiesPerLevel,
    rectsOverlap,
    circlesOverlap,
    resolveObstacleCollisions,
    circleIntersectsAnyObstacle,
    fireCooldown,
    rollPickupDrop,
    healPlayer,
    applyPickupEffect,
    applyDamage,
    resolveLethalHit,
    comboScore,
    secondsRemaining,
    LEVEL_COUNTDOWN_FRAMES,
    PICKUP_TYPES,
    PICKUP_WEIGHTS,
    PICKUP_DROP_CHANCE,
    STARTING_LIVES,
    MAX_LIVES,
    HEALTH_PICKUP_AMOUNT,
    BASE_KILL_SCORE,
    COMBO_WINDOW_FRAMES,
    COMBO_MAX_STACK
  };
});
