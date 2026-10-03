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

  test('omitting spaceScale behaves the same as passing 1 (full-size arena)', () => {
    const a = GameCore.enemyStatsForLevel('grunt', 5);
    const b = GameCore.enemyStatsForLevel('grunt', 5, 1);
    assert.equal(a.speed, b.speed);
  });

  test('a smaller spaceScale mildly reduces speed, never by more than 15%', () => {
    const full = GameCore.enemyStatsForLevel('grunt', 5, 1).speed;
    const cramped = GameCore.enemyStatsForLevel('grunt', 5, 0).speed; // smallest possible arena
    assert.ok(cramped < full);
    assert.ok(cramped >= full * 0.85 - 1e-9);
  });

  test('spaceScale does not affect hp', () => {
    const full = GameCore.enemyStatsForLevel('grunt', 5, 1).hp;
    const cramped = GameCore.enemyStatsForLevel('grunt', 5, 0.55).hp;
    assert.equal(full, cramped);
  });
});

describe('enemiesPerLevel', () => {
  test('grows by exactly 1 per level', () => {
    assert.equal(GameCore.enemiesPerLevel(1), 5);
    assert.equal(GameCore.enemiesPerLevel(2), 6);
    assert.equal(GameCore.enemiesPerLevel(10), 14);
  });

  test('omitting spaceScale behaves the same as passing 1 (full-size arena)', () => {
    assert.equal(GameCore.enemiesPerLevel(5), GameCore.enemiesPerLevel(5, 1));
  });

  test('a smaller spaceScale reduces the count proportionally', () => {
    const full = GameCore.enemiesPerLevel(10, 1);
    const cramped = GameCore.enemiesPerLevel(10, 0.55);
    assert.ok(cramped < full);
    assert.equal(cramped, Math.round(14 * 0.55));
  });

  test('never drops below 3, even on the smallest arena at level 1', () => {
    assert.ok(GameCore.enemiesPerLevel(1, 0.1) >= 3);
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

  test('piercing is slower than normal, balanced by hitting multiple enemies', () => {
    assert.ok(GameCore.fireCooldown('piercing') > GameCore.fireCooldown('normal'));
  });
});

describe('pickupWeightsForLevel', () => {
  test('every level\'s weights are aligned to PICKUP_TYPES and sum to 1', () => {
    for (const level of [1, 2, GameCore.PICKUP_ADVANCED_LEVEL, 10]) {
      const weights = GameCore.pickupWeightsForLevel(level);
      assert.equal(weights.length, GameCore.PICKUP_TYPES.length);
      const sum = weights.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `level ${level} weights sum to ${sum}`);
    }
  });

  test('shield/piercing/life are locked out before the advanced level', () => {
    const weights = GameCore.pickupWeightsForLevel(GameCore.PICKUP_ADVANCED_LEVEL - 1);
    for (const kind of ['shield', 'piercing', 'life']) {
      assert.equal(weights[GameCore.PICKUP_TYPES.indexOf(kind)], 0);
    }
  });

  test('shield/piercing/life unlock at the advanced level', () => {
    const weights = GameCore.pickupWeightsForLevel(GameCore.PICKUP_ADVANCED_LEVEL);
    for (const kind of ['shield', 'piercing', 'life']) {
      assert.ok(weights[GameCore.PICKUP_TYPES.indexOf(kind)] > 0);
    }
  });
});

describe('rollPickupDrop', () => {
  test('returns null when the drop roll misses', () => {
    assert.equal(GameCore.rollPickupDrop(1, fakeRng(0.5)), null);
  });

  test('returns a pickup type when the drop roll hits', () => {
    // first call: drop chance roll (< 0.18 hits); second call: which type
    const type = GameCore.rollPickupDrop(1, fakeRng(0.0, 0.0));
    assert.equal(GameCore.PICKUP_TYPES.includes(type), true);
  });

  test('type roll maps across the full weighted range for a given level', () => {
    const first = GameCore.rollPickupDrop(1, fakeRng(0.0, 0.0));
    const last = GameCore.rollPickupDrop(1, fakeRng(0.0, 0.999));
    assert.equal(first, GameCore.PICKUP_TYPES[0]);
    // early levels: 'rapid' (index 2) is the last pickup with nonzero weight
    assert.equal(last, 'rapid');
  });

  test('before the advanced level, only the basic three pickups ever drop', () => {
    for (const roll of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.999]) {
      const type = GameCore.rollPickupDrop(1, fakeRng(0.0, roll));
      assert.ok(['health', 'spread', 'rapid'].includes(type));
    }
  });

  test('at the advanced level, a high roll can land on "life"', () => {
    const type = GameCore.rollPickupDrop(GameCore.PICKUP_ADVANCED_LEVEL, fakeRng(0.0, 0.999));
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

  test('shield pickup sets the shield to SHIELD_AMOUNT', () => {
    const player = { health: 100, maxHealth: 100, weapon: 'normal', weaponTimer: 0, shield: 0 };
    GameCore.applyPickupEffect(player, 'shield');
    assert.equal(player.shield, GameCore.SHIELD_AMOUNT);
  });

  test('a second shield pickup refreshes rather than stacking', () => {
    const player = { health: 100, maxHealth: 100, weapon: 'normal', weaponTimer: 0, shield: 10 };
    GameCore.applyPickupEffect(player, 'shield');
    assert.equal(player.shield, GameCore.SHIELD_AMOUNT);
  });

  test('piercing pickup sets the weapon like other weapon pickups', () => {
    const player = { health: 100, maxHealth: 100, weapon: 'normal', weaponTimer: 0 };
    GameCore.applyPickupEffect(player, 'piercing');
    assert.equal(player.weapon, 'piercing');
    assert.equal(player.weaponTimer, 480);
  });
});

describe('absorbWithShield', () => {
  test('a full shield absorbs damage up to its capacity', () => {
    const player = { shield: 50 };
    const leftover = GameCore.absorbWithShield(player, 20);
    assert.equal(leftover, 0);
    assert.equal(player.shield, 30);
  });

  test('damage exceeding the shield spills over to the returned leftover', () => {
    const player = { shield: 15 };
    const leftover = GameCore.absorbWithShield(player, 20);
    assert.equal(leftover, 5);
    assert.equal(player.shield, 0);
  });

  test('no shield passes all damage through unchanged', () => {
    const player = { shield: 0 };
    assert.equal(GameCore.absorbWithShield(player, 20), 20);
    const noShieldField = {};
    assert.equal(GameCore.absorbWithShield(noShieldField, 20), 20);
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

describe('secondsRemaining', () => {
  test('rounds up to the next whole second', () => {
    assert.equal(GameCore.secondsRemaining(300), 5);
    assert.equal(GameCore.secondsRemaining(299), 5);
    assert.equal(GameCore.secondsRemaining(241), 5);
    assert.equal(GameCore.secondsRemaining(240), 4);
  });

  test('reaches exactly 1 on the final second, not 0 until frames run out', () => {
    assert.equal(GameCore.secondsRemaining(60), 1);
    assert.equal(GameCore.secondsRemaining(1), 1);
  });

  test('never goes negative', () => {
    assert.equal(GameCore.secondsRemaining(0), 0);
    assert.equal(GameCore.secondsRemaining(-30), 0);
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
