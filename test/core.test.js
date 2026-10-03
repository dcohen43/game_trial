const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const GameCore = require('../core.js');

// A tiny sequence-based fake rng: returns each value in `values` in order,
// then keeps returning the last one if called more times than provided.
function fakeRng(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('pickEnemyKind', () => {
  test('level 1 is always grunt, regardless of roll', () => {
    assert.equal(GameCore.pickEnemyKind(1, fakeRng(0)), 'grunt');
    assert.equal(GameCore.pickEnemyKind(1, fakeRng(0.1)), 'grunt');
    assert.equal(GameCore.pickEnemyKind(1, fakeRng(0.99)), 'grunt');
  });

  test('level 2 can be brute but never spitter', () => {
    assert.equal(GameCore.pickEnemyKind(2, fakeRng(0)), 'brute');
    assert.equal(GameCore.pickEnemyKind(2, fakeRng(0.44)), 'brute');
    assert.equal(GameCore.pickEnemyKind(2, fakeRng(0.45)), 'grunt');
    assert.equal(GameCore.pickEnemyKind(2, fakeRng(0.9)), 'grunt');
  });

  test('level 3+ can roll all three kinds at the documented thresholds', () => {
    assert.equal(GameCore.pickEnemyKind(3, fakeRng(0)), 'spitter');
    assert.equal(GameCore.pickEnemyKind(3, fakeRng(0.19)), 'spitter');
    assert.equal(GameCore.pickEnemyKind(3, fakeRng(0.2)), 'brute');
    assert.equal(GameCore.pickEnemyKind(3, fakeRng(0.44)), 'brute');
    assert.equal(GameCore.pickEnemyKind(3, fakeRng(0.45)), 'grunt');
  });

  test('defaults to Math.random when no rng is supplied', () => {
    const kind = GameCore.pickEnemyKind(1);
    assert.equal(kind, 'grunt');
  });
});

describe('enemyStatsForLevel', () => {
  test('grunt speed and hp scale with level', () => {
    const l1 = GameCore.enemyStatsForLevel('grunt', 1);
    assert.equal(l1.speed, 1.08);
    assert.equal(l1.hp, 2);

    const l10 = GameCore.enemyStatsForLevel('grunt', 10);
    assert.equal(l10.speed, 1.8);
    assert.equal(l10.hp, 4);
  });

  test('speed growth caps at +2.0 regardless of how high the level goes', () => {
    const atCap = GameCore.enemyStatsForLevel('grunt', 25); // 25*0.08 = 2.0 exactly
    const beyondCap = GameCore.enemyStatsForLevel('grunt', 100);
    assert.equal(atCap.speed, 3.0);
    assert.equal(beyondCap.speed, 3.0);
  });

  test('brute applies its speed/hp multipliers on top of the level curve', () => {
    const brute = GameCore.enemyStatsForLevel('brute', 1);
    assert.equal(brute.speed, 1.08 * 0.55);
    assert.equal(brute.hp, Math.round(2 * 2.6));
    assert.equal(brute.contactDamage, 18);
  });

  test('spitter uses its own multipliers', () => {
    const spitter = GameCore.enemyStatsForLevel('spitter', 1);
    assert.equal(spitter.speed, 1.08 * 0.9);
    assert.equal(spitter.hp, Math.round(2 * 0.8));
  });

  test('throws on an unknown enemy kind', () => {
    assert.throws(() => GameCore.enemyStatsForLevel('dragon', 1));
  });
});

describe('enemiesPerLevel', () => {
  test('grows by exactly 1 per level', () => {
    assert.equal(GameCore.enemiesPerLevel(1), 5);
    assert.equal(GameCore.enemiesPerLevel(2), 6);
    assert.equal(GameCore.enemiesPerLevel(10), 14);
  });
});

describe('rectsOverlap', () => {
  test('detects overlapping rects', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 5, y: 5, w: 10, h: 10 };
    assert.equal(GameCore.rectsOverlap(a, b), true);
  });

  test('returns false for separated rects', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 20, y: 20, w: 10, h: 10 };
    assert.equal(GameCore.rectsOverlap(a, b), false);
  });

  test('edges exactly touching do not count as overlapping', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 10, y: 0, w: 10, h: 10 };
    assert.equal(GameCore.rectsOverlap(a, b), false);
  });
});

describe('circlesOverlap', () => {
  test('detects overlapping circles', () => {
    assert.equal(GameCore.circlesOverlap(0, 0, 5, 6, 0, 5), true);
  });

  test('returns false for circles that are just apart', () => {
    assert.equal(GameCore.circlesOverlap(0, 0, 5, 20, 0, 5), false);
  });

  test('circles exactly touching (dist === r1+r2) do not count as overlapping', () => {
    assert.equal(GameCore.circlesOverlap(0, 0, 5, 10, 0, 5), false);
  });
});

describe('resolveObstacleCollisions', () => {
  test('pushes an overlapping entity out to the obstacle edge', () => {
    const obstacles = [{ x: 0, y: 0, w: 100, h: 100 }];
    // Center sits just outside the rect (x=105), but its radius reaches in.
    const entity = { x: 105, y: 50, r: 10 };
    GameCore.resolveObstacleCollisions(entity, obstacles);
    // Pushed out to the right edge, so it should now sit exactly r away from it.
    assert.ok(entity.x >= 100);
    assert.ok(Math.abs((entity.x - 100) - 10) < 1e-6);
  });

  test('leaves a non-overlapping entity untouched', () => {
    const obstacles = [{ x: 0, y: 0, w: 100, h: 100 }];
    const entity = { x: 500, y: 500, r: 10 };
    GameCore.resolveObstacleCollisions(entity, obstacles);
    assert.equal(entity.x, 500);
    assert.equal(entity.y, 500);
  });

  test('handles an entity exactly centered on the obstacle without dividing by zero', () => {
    const obstacles = [{ x: 0, y: 0, w: 100, h: 100 }];
    const entity = { x: 50, y: 50, r: 10 };
    assert.doesNotThrow(() => GameCore.resolveObstacleCollisions(entity, obstacles));
    assert.ok(Number.isFinite(entity.x));
    assert.ok(Number.isFinite(entity.y));
  });
});

describe('circleIntersectsAnyObstacle', () => {
  test('true when the circle overlaps any obstacle in the list', () => {
    const obstacles = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 100, y: 100, w: 10, h: 10 }
    ];
    assert.equal(GameCore.circleIntersectsAnyObstacle(105, 105, 3, obstacles), true);
  });

  test('false when the circle overlaps none of them', () => {
    const obstacles = [{ x: 0, y: 0, w: 10, h: 10 }];
    assert.equal(GameCore.circleIntersectsAnyObstacle(500, 500, 3, obstacles), false);
  });
});

describe('fireCooldown', () => {
  test('rapid weapon fires twice as fast as normal/spread', () => {
    assert.equal(GameCore.fireCooldown('rapid'), 4);
    assert.equal(GameCore.fireCooldown('normal'), 8);
    assert.equal(GameCore.fireCooldown('spread'), 8);
  });
});

describe('rollPickupDrop', () => {
  test('returns null when the drop roll misses', () => {
    assert.equal(GameCore.rollPickupDrop(fakeRng(0.5)), null);
  });

  test('returns a pickup type when the drop roll hits', () => {
    // first call: drop chance roll (< 0.18 hits); second call: which type
    const type = GameCore.rollPickupDrop(fakeRng(0.0, 0.0));
    assert.equal(GameCore.PICKUP_TYPES.includes(type), true);
  });

  test('type roll maps across the full PICKUP_TYPES range', () => {
    const first = GameCore.rollPickupDrop(fakeRng(0.0, 0.0));
    const last = GameCore.rollPickupDrop(fakeRng(0.0, 0.999));
    assert.equal(first, GameCore.PICKUP_TYPES[0]);
    assert.equal(last, GameCore.PICKUP_TYPES[GameCore.PICKUP_TYPES.length - 1]);
  });

  test('weights are aligned to PICKUP_TYPES and sum to 1', () => {
    assert.equal(GameCore.PICKUP_WEIGHTS.length, GameCore.PICKUP_TYPES.length);
    const sum = GameCore.PICKUP_WEIGHTS.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });

  test('life is the rarest pickup type (smallest weight)', () => {
    const lifeIndex = GameCore.PICKUP_TYPES.indexOf('life');
    const lifeWeight = GameCore.PICKUP_WEIGHTS[lifeIndex];
    assert.ok(lifeWeight < Math.max(...GameCore.PICKUP_WEIGHTS.filter((_, i) => i !== lifeIndex)));
  });

  test('type roll lands on "life" at the top of the weighted range', () => {
    // cumulative weights: health .40, spread .65, rapid .90, life 1.00
    const type = GameCore.rollPickupDrop(fakeRng(0.0, 0.95));
    assert.equal(type, 'life');
  });
});

describe('applyPickupEffect', () => {
  test('health pickup heals but caps at maxHealth', () => {
    const player = { health: 90, maxHealth: 100, weapon: 'normal', weaponTimer: 0 };
    GameCore.applyPickupEffect(player, 'health');
    assert.equal(player.health, 100);
  });

  test('health pickup does not overheal from a low starting point', () => {
    const player = { health: 50, maxHealth: 100, weapon: 'normal', weaponTimer: 0 };
    GameCore.applyPickupEffect(player, 'health');
    assert.equal(player.health, 80);
  });

  test('weapon pickups set the weapon and a timer', () => {
    const player = { health: 100, maxHealth: 100, weapon: 'normal', weaponTimer: 0 };
    GameCore.applyPickupEffect(player, 'spread');
    assert.equal(player.weapon, 'spread');
    assert.equal(player.weaponTimer, 480);
  });

  test('life pickup grants an extra life', () => {
    const player = { health: 100, maxHealth: 100, weapon: 'normal', weaponTimer: 0, lives: 2 };
    GameCore.applyPickupEffect(player, 'life');
    assert.equal(player.lives, 3);
  });

  test('life pickup caps at MAX_LIVES', () => {
    const player = { health: 100, maxHealth: 100, weapon: 'normal', weaponTimer: 0, lives: GameCore.MAX_LIVES };
    GameCore.applyPickupEffect(player, 'life');
    assert.equal(player.lives, GameCore.MAX_LIVES);
  });
});

describe('healPlayer', () => {
  test('heals but caps at maxHealth', () => {
    const player = { health: 90, maxHealth: 100 };
    GameCore.healPlayer(player, 30);
    assert.equal(player.health, 100);
  });

  test('does not overheal from a low starting point', () => {
    const player = { health: 50, maxHealth: 100 };
    GameCore.healPlayer(player, 10);
    assert.equal(player.health, 60);
  });
});

describe('comboScore', () => {
  test('first kill in a streak awards the base score', () => {
    assert.equal(GameCore.comboScore(1), GameCore.BASE_KILL_SCORE);
  });

  test('score increases with combo count', () => {
    const first = GameCore.comboScore(1);
    const second = GameCore.comboScore(2);
    const third = GameCore.comboScore(3);
    assert.ok(second > first);
    assert.ok(third > second);
  });

  test('caps the multiplier at COMBO_MAX_STACK regardless of how high the count goes', () => {
    const atCap = GameCore.comboScore(GameCore.COMBO_MAX_STACK + 1);
    const wayBeyond = GameCore.comboScore(1000);
    assert.equal(atCap, wayBeyond);
  });

  test('treats a combo count of 0 the same as 1 (never scores below base)', () => {
    assert.equal(GameCore.comboScore(0), GameCore.BASE_KILL_SCORE);
  });
});

describe('resolveLethalHit', () => {
  test('consumes a life and respawns at full health when lives remain', () => {
    const player = { health: 0, maxHealth: 100, lives: 3 };
    const result = GameCore.resolveLethalHit(player);
    assert.equal(result.gameOver, false);
    assert.equal(player.lives, 2);
    assert.equal(player.health, 100);
  });

  test('ends the game on the last life', () => {
    const player = { health: 0, maxHealth: 100, lives: 1 };
    const result = GameCore.resolveLethalHit(player);
    assert.equal(result.gameOver, true);
    assert.equal(player.lives, 0);
    assert.equal(player.health, 0);
  });

  test('treats 0 lives as already game over, not negative lives', () => {
    const player = { health: 0, maxHealth: 100, lives: 0 };
    const result = GameCore.resolveLethalHit(player);
    assert.equal(result.gameOver, true);
    assert.equal(player.lives, 0);
  });
});

describe('applyDamage', () => {
  test('reduces health by the given amount', () => {
    const entity = { health: 50 };
    GameCore.applyDamage(entity, 20);
    assert.equal(entity.health, 30);
  });

  test('reports lethal when health drops to exactly zero', () => {
    const entity = { health: 10 };
    const died = GameCore.applyDamage(entity, 10);
    assert.equal(died, true);
    assert.equal(entity.health, 0);
  });

  test('reports non-lethal while health remains positive', () => {
    const entity = { health: 10 };
    const died = GameCore.applyDamage(entity, 5);
    assert.equal(died, false);
  });
});
