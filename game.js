// ===== Setup =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const healthBar = document.getElementById('health-bar');
const livesEl = document.getElementById('lives');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const waveEl = document.getElementById('wave');
const comboEl = document.getElementById('combo');
const weaponStatusEl = document.getElementById('weapon-status');
const overlay = document.getElementById('overlay');
const gameoverEl = document.getElementById('gameover');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Floor grid, pre-rendered to an offscreen canvas and blitted each frame
// instead of redrawn — cheap regardless of line count, and gives the arena
// some visual structure instead of a flat, texture-less fill (part of the
// "colors are too dark" fix: a flat near-black field reads as uniformly
// dark even when individual elements have decent contrast against it).
const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d');

function renderBackground() {
  bgCanvas.width = canvas.width + 40;
  bgCanvas.height = canvas.height + 40;

  // Saturated crimson floor instead of a near-black field — the arena
  // itself should read as vivid, dangerous ground, not an empty void.
  const base = bgCtx.createRadialGradient(
    bgCanvas.width / 2, bgCanvas.height / 2, 0,
    bgCanvas.width / 2, bgCanvas.height / 2, Math.max(bgCanvas.width, bgCanvas.height) * 0.75
  );
  base.addColorStop(0, '#7a1c2c');
  base.addColorStop(1, '#3a0f1a');
  bgCtx.fillStyle = base;
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  // Dried-blood blotches baked into the floor, once, for a gorey, lived-in
  // arena rather than a clean grid.
  for (let i = 0; i < 35; i++) {
    const bx = Math.random() * bgCanvas.width;
    const by = Math.random() * bgCanvas.height;
    const br = 18 + Math.random() * 46;
    bgCtx.fillStyle = `rgba(100, 10, 20, ${0.10 + Math.random() * 0.14})`;
    bgCtx.beginPath();
    bgCtx.arc(bx, by, br, 0, Math.PI * 2);
    bgCtx.fill();
  }

  bgCtx.strokeStyle = 'rgba(255, 110, 110, 0.25)';
  bgCtx.lineWidth = 1;
  const spacing = 56;
  bgCtx.beginPath();
  for (let x = 0; x < bgCanvas.width; x += spacing) {
    bgCtx.moveTo(x + 0.5, 0);
    bgCtx.lineTo(x + 0.5, bgCanvas.height);
  }
  for (let y = 0; y < bgCanvas.height; y += spacing) {
    bgCtx.moveTo(0, y + 0.5);
    bgCtx.lineTo(bgCanvas.width, y + 0.5);
  }
  bgCtx.stroke();

  // Light vignette (colored, not black) just to keep the corners a touch
  // dimmer than the center so the HUD text stays legible.
  const vignette = bgCtx.createRadialGradient(
    bgCanvas.width / 2, bgCanvas.height / 2, Math.min(bgCanvas.width, bgCanvas.height) * 0.3,
    bgCanvas.width / 2, bgCanvas.height / 2, Math.max(bgCanvas.width, bgCanvas.height) * 0.72
  );
  vignette.addColorStop(0, 'rgba(20,0,8,0)');
  vignette.addColorStop(1, 'rgba(20,0,8,0.35)');
  bgCtx.fillStyle = vignette;
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderBackground();
}
window.addEventListener('resize', resize);
resize();

// ===== Audio (all procedural, no external files) =====
const actx = new (window.AudioContext || window.webkitAudioContext)();

function noiseBuffer(duration) {
  const size = Math.floor(actx.sampleRate * duration);
  const buffer = actx.createBuffer(1, size, actx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playShoot() {
  const t = actx.currentTime;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

function playEnemyShoot() {
  const t = actx.currentTime;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(260, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + 0.14);
}

function playHit() {
  const t = actx.currentTime;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

function playClink() {
  const t = actx.currentTime;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(500, t);
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

function playPickup() {
  const t = actx.currentTime;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.15);
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

function playDeath() {
  const t = actx.currentTime;

  const osc = actx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(500 + Math.random() * 150, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.45);

  const shaper = actx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = Math.tanh(x * 4);
  }
  shaper.curve = curve;

  const gain = actx.createGain();
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

  osc.connect(shaper).connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + 0.5);

  const noise = actx.createBufferSource();
  noise.buffer = noiseBuffer(0.3);
  const noiseFilter = actx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 900;
  const noiseGain = actx.createGain();
  noiseGain.gain.setValueAtTime(0.35, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  noise.connect(noiseFilter).connect(noiseGain).connect(actx.destination);
  noise.start(t);

  const thud = actx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(140, t);
  thud.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  const thudGain = actx.createGain();
  thudGain.gain.setValueAtTime(0.4, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  thud.connect(thudGain).connect(actx.destination);
  thud.start(t);
  thud.stop(t + 0.2);
}

function playPlayerHurt() {
  const t = actx.currentTime;
  const osc = actx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
  const gain = actx.createGain();
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + 0.25);
}

// ===== Input =====
const keys = {};
const mouse = { x: 0, y: 0, down: false };
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', () => { mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });

// ===== Enemy kind definitions (shared logic lives in core.js) =====
const ENEMY_KINDS = GameCore.ENEMY_KINDS;

// ===== Game state =====
const REGEN_GRACE_FRAMES = 180; // ~3s without taking a hit before passive regen kicks in
const REGEN_RATE = 0.04; // HP/frame (~2.4 HP/s) once regen is active — a slow trickle, not a substitute for pickups
let player = { x: 0, y: 0, r: 16, speed: 4, health: 100, maxHealth: 100, hurtCooldown: 0, weapon: 'normal', weaponTimer: 0, lives: GameCore.STARTING_LIVES, shield: 0 };
let bullets = [], enemies = [], particles = [], splatters = [], obstacles = [], enemyProjectiles = [], pickups = [];
let score = 0, wave = 1, enemiesToSpawn = 0, spawnTimer = 0, fireTimer = 0, running = false, shake = 0, levelBannerTimer = 0, regenGrace = 0;
let comboCount = 0, comboTimer = 0, countdownTimer = 0, nextEnemyId = 1;

function updateLivesHud() {
  livesEl.textContent = `Lives: ${player.lives}`;
}

// ===== High score (persisted) =====
function loadHighScore() {
  try {
    const v = parseInt(localStorage.getItem('carnageArenaHighScore'), 10);
    return isNaN(v) ? 0 : v;
  } catch (e) {
    return 0;
  }
}
function saveHighScore(v) {
  try { localStorage.setItem('carnageArenaHighScore', v); } catch (e) { /* ignore */ }
}
let highScore = loadHighScore();
bestEl.textContent = `Best: ${highScore}`;

// ===== Kill combo (momentum reward for chaining kills quickly) =====
function updateComboHud() {
  if (comboCount >= 2) {
    comboEl.classList.remove('hidden');
    comboEl.textContent = `Combo x${comboCount}`;
  } else {
    comboEl.classList.add('hidden');
  }
}

function registerKill() {
  comboCount = comboTimer > 0 ? comboCount + 1 : 1;
  comboTimer = GameCore.COMBO_WINDOW_FRAMES;
  score += GameCore.comboScore(comboCount);
  scoreEl.textContent = `Score: ${score}`;
  updateComboHud();
}

// Applies damage with the player's hit-cooldown/shake/regen-grace side
// effects, then resolves lethal hits through the lives system instead of
// always ending the game. Returns true if this hit was processed (false if
// still within the post-hit cooldown window).
function damagePlayer(amount, hurtCooldownFrames, shakeAmount) {
  if (player.hurtCooldown > 0) return false;
  player.hurtCooldown = hurtCooldownFrames;
  regenGrace = REGEN_GRACE_FRAMES;
  playPlayerHurt();
  shake = shakeAmount;
  const leftover = GameCore.absorbWithShield(player, amount);
  if (leftover <= 0) return true;
  const lethal = GameCore.applyDamage(player, leftover);
  if (lethal) {
    const result = GameCore.resolveLethalHit(player);
    updateLivesHud();
    if (result.gameOver) {
      healthBar.style.width = '0%';
      endGame();
    } else {
      healthBar.style.width = '100%';
    }
  } else {
    healthBar.style.width = Math.max(0, player.health) + '%';
  }
  return true;
}

// Obstacle color themes cycle by level so the arena visibly looks different
// after each transition, on top of the layout itself regenerating.
const OBSTACLE_THEMES = [
  { fill: '#5a2a22', stroke: '#ff8552' }, // rust/amber
  { fill: '#1a4a4a', stroke: '#4de0e0' }, // teal steel
  { fill: '#4a2258', stroke: '#c060ff' }, // violet
  { fill: '#585a1a', stroke: '#e8d23a' }, // olive brass
  { fill: '#22285c', stroke: '#6080ff' }  // indigo
];
function currentObstacleTheme() {
  return OBSTACLE_THEMES[(wave - 1) % OBSTACLE_THEMES.length];
}

function spawnObstacles() {
  obstacles = [];
  const count = 6;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  let attempts = 0;
  while (obstacles.length < count && attempts < 200) {
    attempts++;
    const w = 60 + Math.random() * 90;
    const h = 60 + Math.random() * 90;
    const x = 60 + Math.random() * (canvas.width - 120 - w);
    const y = 60 + Math.random() * (canvas.height - 120 - h);
    const rect = { x, y, w, h };
    const rectCx = x + w / 2, rectCy = y + h / 2;
    if (Math.hypot(rectCx - cx, rectCy - cy) < 180) continue;
    if (obstacles.some(o => GameCore.rectsOverlap(
      { x: rect.x - 20, y: rect.y - 20, w: rect.w + 40, h: rect.h + 40 }, o))) continue;
    obstacles.push(rect);
  }
}

function resolveObstacleCollisions(entity) {
  return GameCore.resolveObstacleCollisions(entity, obstacles);
}

function circleIntersectsAnyObstacle(cx, cy, cr) {
  return GameCore.circleIntersectsAnyObstacle(cx, cy, cr, obstacles);
}

function reset() {
  player = { x: canvas.width / 2, y: canvas.height / 2, r: 16, speed: 4, health: 100, maxHealth: 100, hurtCooldown: 0, weapon: 'normal', weaponTimer: 0, lives: GameCore.STARTING_LIVES, shield: 0 };
  bullets = [];
  enemies = [];
  particles = [];
  splatters = [];
  enemyProjectiles = [];
  pickups = [];
  score = 0;
  wave = 1;
  enemiesToSpawn = GameCore.enemiesPerLevel(wave);
  spawnTimer = 0;
  fireTimer = 0;
  shake = 0;
  levelBannerTimer = 0;
  regenGrace = 0;
  comboCount = 0;
  comboTimer = 0;
  countdownTimer = 0;
  running = true;
  spawnObstacles();
  healthBar.style.width = '100%';
  updateLivesHud();
  updateComboHud();
  scoreEl.textContent = 'Score: 0';
  waveEl.textContent = 'Level: 1';
  weaponStatusEl.classList.add('hidden');
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) { x = -30; y = Math.random() * canvas.height; }
  else if (edge === 1) { x = canvas.width + 30; y = Math.random() * canvas.height; }
  else if (edge === 2) { x = Math.random() * canvas.width; y = -30; }
  else { x = Math.random() * canvas.width; y = canvas.height + 30; }

  const kind = GameCore.pickEnemyKind(wave);
  const stats = GameCore.enemyStatsForLevel(kind, wave);
  enemies.push({
    id: nextEnemyId++,
    kind,
    x, y,
    r: stats.r + Math.random() * 4,
    speed: stats.speed + Math.random() * 0.4,
    hp: stats.hp,
    maxHp: stats.hp,
    hue: stats.hue + Math.random() * 20 - 10,
    wobble: Math.random() * Math.PI * 2,
    contactDamage: stats.contactDamage,
    shootCooldown: 60 + Math.random() * 40,
    preferredRange: 260
  });
}

function spawnBlood(x, y, amount, power) {
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * power) + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 30 + Math.random() * 30,
      size: 2 + Math.random() * 4,
      gravity: 0.15,
      color: '255, 25, 40'
    });
  }
  if (splatters.length > 400) splatters.splice(0, 100);
  for (let i = 0; i < Math.floor(amount / 4); i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * power * 6;
    splatters.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      size: 2 + Math.random() * 6,
      alpha: 0.5 + Math.random() * 0.4
    });
  }
}

function spawnSparks(x, y) {
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.5 + 0.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 12 + Math.random() * 10,
      size: 1.5 + Math.random() * 2,
      gravity: 0.02,
      color: '255, 200, 80'
    });
  }
}

function maybeDropPickup(x, y) {
  const type = GameCore.rollPickupDrop(wave);
  if (!type) return;
  pickups.push({ x, y, type, r: 12, bob: Math.random() * Math.PI * 2 });
}

function applyPickup(p) {
  playPickup();
  GameCore.applyPickupEffect(player, p.type);
  healthBar.style.width = player.health + '%';
  if (p.type === 'life') updateLivesHud();
}

function fireCooldown() {
  return GameCore.fireCooldown(player.weapon);
}

function shoot() {
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const pierce = player.weapon === 'piercing';
  const makeBullet = a => bullets.push({
    x: player.x + Math.cos(a) * player.r,
    y: player.y + Math.sin(a) * player.r,
    vx: Math.cos(a) * 11,
    vy: Math.sin(a) * 11,
    r: pierce ? 5 : 4,
    pierce,
    hitIds: pierce ? new Set() : null
  });
  if (player.weapon === 'spread') {
    makeBullet(angle - 0.22);
    makeBullet(angle);
    makeBullet(angle + 0.22);
  } else {
    makeBullet(angle);
  }
  playShoot();
}

function endGame() {
  running = false;
  let newBest = false;
  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
    bestEl.textContent = `Best: ${highScore}`;
    newBest = true;
  }
  finalScoreEl.textContent = newBest
    ? `Score: ${score} — Level ${wave} — NEW BEST!`
    : `Score: ${score} — Level ${wave} (Best: ${highScore})`;
  gameoverEl.classList.remove('hidden');
}

// ===== Update =====
function update() {
  if (!running) return;

  // movement
  let dx = 0, dy = 0;
  if (keys['w']) dy -= 1;
  if (keys['s']) dy += 1;
  if (keys['a']) dx -= 1;
  if (keys['d']) dx += 1;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    player.x += (dx / len) * player.speed;
    player.y += (dy / len) * player.speed;
  }
  player.x = Math.max(player.r, Math.min(canvas.width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(canvas.height - player.r, player.y));
  resolveObstacleCollisions(player);

  // weapon timer
  if (player.weaponTimer > 0) {
    player.weaponTimer--;
    weaponStatusEl.classList.remove('hidden');
    weaponStatusEl.textContent = `${player.weapon.toUpperCase()} ${(player.weaponTimer / 60).toFixed(1)}s`;
    if (player.weaponTimer <= 0) {
      player.weapon = 'normal';
      weaponStatusEl.classList.add('hidden');
    }
  }

  // shooting
  fireTimer--;
  if (mouse.down && fireTimer <= 0) {
    shoot();
    fireTimer = fireCooldown();
  }

  // spawn waves — held off while a level-transition countdown is running,
  // so the player gets a clear beat to see the regenerated arena.
  if (countdownTimer > 0) {
    countdownTimer--;
  } else if (enemiesToSpawn > 0) {
    spawnTimer--;
    if (spawnTimer <= 0) {
      spawnEnemy();
      enemiesToSpawn--;
      spawnTimer = 45;
    }
  } else if (enemies.length === 0) {
    wave++;
    enemiesToSpawn = GameCore.enemiesPerLevel(wave);
    waveEl.textContent = `Level: ${wave}`;
    levelBannerTimer = 100;
    spawnObstacles();
    resolveObstacleCollisions(player); // in case a new wall landed on the player
    for (const p of pickups) resolveObstacleCollisions(p); // ...or on a dropped pickup
    countdownTimer = GameCore.LEVEL_COUNTDOWN_FRAMES;
  }

  if (levelBannerTimer > 0) levelBannerTimer--;

  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer === 0 && comboCount > 0) {
      comboCount = 0;
      updateComboHud();
    }
  }

  // bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) {
      bullets.splice(i, 1);
      continue;
    }
    if (circleIntersectsAnyObstacle(b.x, b.y, b.r)) {
      spawnSparks(b.x, b.y);
      playClink();
      bullets.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (b.pierce && b.hitIds.has(e.id)) continue;
      if (GameCore.circlesOverlap(b.x, b.y, b.r, e.x, e.y, e.r)) {
        e.hp--;
        spawnBlood(b.x, b.y, 8, 3.5);
        if (b.pierce) {
          b.hitIds.add(e.id);
        } else {
          bullets.splice(i, 1);
        }
        if (e.hp <= 0) {
          spawnBlood(e.x, e.y, 42, 7);
          playDeath();
          shake = 10;
          registerKill();
          maybeDropPickup(e.x, e.y);
          enemies.splice(j, 1);
        } else {
          playHit();
        }
        if (!b.pierce) break;
      }
    }
  }

  // enemy projectiles
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const p = enemyProjectiles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -20 || p.x > canvas.width + 20 || p.y < -20 || p.y > canvas.height + 20) {
      enemyProjectiles.splice(i, 1);
      continue;
    }
    if (circleIntersectsAnyObstacle(p.x, p.y, p.r)) {
      spawnSparks(p.x, p.y);
      enemyProjectiles.splice(i, 1);
      continue;
    }
    if (GameCore.circlesOverlap(p.x, p.y, p.r, player.x, player.y, player.r)) {
      damagePlayer(p.damage, 20, 5);
      enemyProjectiles.splice(i, 1);
    }
  }

  // enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.wobble += 0.15;
    const distToPlayer = Math.hypot(player.x - e.x, player.y - e.y);
    const angle = Math.atan2(player.y - e.y, player.x - e.x);

    if (e.kind === 'spitter') {
      if (distToPlayer > e.preferredRange + 40) {
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;
      } else if (distToPlayer < e.preferredRange - 40) {
        e.x -= Math.cos(angle) * e.speed;
        e.y -= Math.sin(angle) * e.speed;
      } else {
        e.x += Math.cos(angle + Math.PI / 2) * e.speed * 0.6;
        e.y += Math.sin(angle + Math.PI / 2) * e.speed * 0.6;
      }
      e.shootCooldown--;
      if (e.shootCooldown <= 0 && distToPlayer < e.preferredRange + 150) {
        enemyProjectiles.push({
          x: e.x, y: e.y,
          vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6,
          r: 5, damage: 8
        });
        playEnemyShoot();
        e.shootCooldown = 90 + Math.random() * 40;
      }
    } else {
      e.x += Math.cos(angle) * e.speed + Math.sin(e.wobble) * 0.4;
      e.y += Math.sin(angle) * e.speed + Math.cos(e.wobble) * 0.4;
    }

    resolveObstacleCollisions(e);

    if (distToPlayer < player.r + e.r) {
      damagePlayer(e.contactDamage, 30, 6);
    }
  }
  if (player.hurtCooldown > 0) player.hurtCooldown--;

  // passive health regen after a few seconds without taking a hit
  if (regenGrace > 0) {
    regenGrace--;
  } else if (player.health < player.maxHealth && running) {
    GameCore.healPlayer(player, REGEN_RATE);
    healthBar.style.width = player.health + '%';
  }

  // pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.bob += 0.08;
    if (GameCore.circlesOverlap(player.x, player.y, player.r, p.x, p.y, p.r)) {
      applyPickup(p);
      pickups.splice(i, 1);
    }
  }

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.97;
    p.life++;
    if (p.life > p.maxLife) particles.splice(i, 1);
  }

  if (shake > 0) shake *= 0.85;
}

// ===== Draw =====
// Small glowing dot (two-layer: soft translucent halo + solid core) used for
// enemy eyes — reads as "glowing" without the per-frame cost of shadowBlur.
function drawGlowDot(x, y, radius, rgb) {
  ctx.fillStyle = `rgba(${rgb}, 0.35)`;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${rgb}, 1)`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Fully saturated, electric-neon bodies plus a glowing hot-magenta danger
// rim and eyes read as threatening rather than decorative — color
// psychology: saturated red/magenta = danger, and the outline gives every
// enemy a consistent "hostile" visual language regardless of its base hue.
// Spitters get toxic green eyes instead, to read as the ranged/poison-
// flavored threat.
function drawEnemy(e) {
  const eyeRgb = e.kind === 'spitter' ? '170, 255, 20' : '255, 15, 70';

  if (e.kind === 'brute') {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.strokeStyle = 'rgba(255, 20, 90, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      const rr = (e.r + 2) * (i % 2 === 0 ? 1 : 0.85);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = `hsl(${e.hue}, 100%, 48%)`;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      const rr = e.r * (i % 2 === 0 ? 1 : 0.85);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    drawGlowDot(e.r * 0.28, -e.r * 0.22, e.r * 0.14, eyeRgb);
    drawGlowDot(e.r * 0.28, e.r * 0.22, e.r * 0.14, eyeRgb);
    ctx.restore();
  } else if (e.kind === 'spitter') {
    ctx.save();
    ctx.translate(e.x, e.y);
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(255, 20, 90, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.r + 2, 0);
    ctx.lineTo(-(e.r + 2) * 0.7, (e.r + 2) * 0.8);
    ctx.lineTo(-(e.r + 2) * 0.7, -(e.r + 2) * 0.8);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = `hsl(${e.hue}, 100%, 54%)`;
    ctx.beginPath();
    ctx.moveTo(e.r, 0);
    ctx.lineTo(-e.r * 0.7, e.r * 0.8);
    ctx.lineTo(-e.r * 0.7, -e.r * 0.8);
    ctx.closePath();
    ctx.fill();
    drawGlowDot(e.r * 0.25, 0, e.r * 0.18, eyeRgb);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.strokeStyle = 'rgba(255, 20, 90, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `hsl(${e.hue}, 100%, 46%)`;
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    drawGlowDot(e.r * 0.3, -e.r * 0.28, e.r * 0.15, eyeRgb);
    drawGlowDot(e.r * 0.3, e.r * 0.28, e.r * 0.15, eyeRgb);
    ctx.restore();
  }
  ctx.fillStyle = '#300';
  ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4);
  ctx.fillStyle = '#e33';
  ctx.fillRect(e.x - e.r, e.y - e.r - 8, (e.r * 2) * (e.hp / e.maxHp), 4);
}

const PICKUP_COLORS = { health: '#3f3', spread: '#ff0', rapid: '#3cf', shield: '#7cf', piercing: '#f0f', life: '#ffd700' };

function drawPickup(p) {
  const bobY = Math.sin(p.bob) * 4;
  ctx.save();
  ctx.translate(p.x, p.y + bobY);
  ctx.shadowColor = PICKUP_COLORS[p.type];
  ctx.shadowBlur = 12;
  ctx.fillStyle = PICKUP_COLORS[p.type];
  ctx.beginPath();
  ctx.moveTo(0, -p.r);
  ctx.lineTo(p.r, 0);
  ctx.lineTo(0, p.r);
  ctx.lineTo(-p.r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Top-down tactical soldier: olive body, darker helmet offset toward the
// facing direction, dark vest straps, and a long rifle (stock behind, barrel
// well in front). A bright cyan-white glow + rim (a color used nowhere else
// in the game) sits behind/around the body specifically so the player is
// never lost against the dark arena, regardless of what's rendered under or
// near it — a "beacon" independent of the tactical color scheme. Call with
// the context already translated to the player's position and rotated to
// its facing angle.
function drawPlayerSprite(r) {
  const glow = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.2);
  glow.addColorStop(0, 'rgba(130, 230, 255, 0.55)');
  glow.addColorStop(1, 'rgba(130, 230, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8fe0ff';
  ctx.beginPath();
  ctx.arc(0, 0, r + 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7a9150';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2c3621';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#56682f';
  ctx.beginPath();
  ctx.arc(r * 0.2, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#23291a';
  ctx.fillRect(-r * 0.3, -r * 1.05, r * 0.5, r * 0.35);
  ctx.fillRect(-r * 0.3, r * 0.7, r * 0.5, r * 0.35);

  ctx.fillStyle = '#1a1712';
  ctx.fillRect(-r * 0.9, -r * 0.22, r * 0.5, r * 0.44);
  ctx.fillRect(r * 0.3, -r * 0.16, r * 1.8, r * 0.32);
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(r * 2.0, -r * 0.1, r * 0.25, r * 0.2);
}

function draw() {
  ctx.save();
  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  ctx.drawImage(bgCanvas, -20, -20);

  for (const s of splatters) {
    ctx.fillStyle = `rgba(190, 10, 30, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  const obstacleTheme = currentObstacleTheme();
  for (const rect of obstacles) {
    ctx.fillStyle = obstacleTheme.fill;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = obstacleTheme.stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }

  for (const p of pickups) drawPickup(p);

  for (const p of particles) {
    const alpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = `rgba(${p.color}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of enemies) drawEnemy(e);

  for (const p of enemyProjectiles) {
    ctx.fillStyle = '#c3f';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of bullets) {
    ctx.fillStyle = b.pierce ? '#8ff6ff' : '#ffd400';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // player
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  drawPlayerSprite(player.r);
  ctx.restore();

  if (player.shield > 0) {
    ctx.save();
    const pct = Math.min(1, player.shield / GameCore.SHIELD_AMOUNT);
    ctx.strokeStyle = `rgba(120, 200, 255, ${0.5 + 0.3 * Math.sin(Date.now() / 150)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 8, 0, Math.PI * 2 * pct);
    ctx.stroke();
    ctx.restore();
  }

  if (levelBannerTimer > 0) {
    const alpha = Math.min(1, levelBannerTimer / 30);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f33';
    ctx.font = 'bold 54px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#800';
    ctx.shadowBlur = 20;
    ctx.fillText(`LEVEL ${wave}`, canvas.width / 2, canvas.height / 2 - 100);
    ctx.restore();
  }

  // level-transition countdown: holds the player's attention on the new
  // arena layout before the next wave's enemies start spawning in.
  if (countdownTimer > 0) {
    const seconds = GameCore.secondsRemaining(countdownTimer);
    const tick = countdownTimer % 60;
    const scale = 0.7 + (tick / 60) * 0.5;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eee';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.globalAlpha = 0.8;
    ctx.fillText('NEXT WAVE INCOMING', canvas.width / 2, canvas.height / 2 - 90);
    ctx.restore();

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.85 + 0.15 * (tick / 60);
    ctx.fillStyle = '#f33';
    ctx.font = 'bold 100px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#800';
    ctx.shadowBlur = 26;
    ctx.fillText(String(seconds), 0, 0);
    ctx.restore();
  }

  // low-health tension cue: a pulsing red vignette, not a substitute for the
  // health bar — just urgency/adrenaline feedback when things are dire.
  if (running && player.health / player.maxHealth < 0.25) {
    const pulse = 0.18 + 0.14 * Math.sin(performance.now() / 180);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const grad = ctx.createRadialGradient(cx, cy, Math.min(canvas.width, canvas.height) * 0.25, cx, cy, Math.max(canvas.width, canvas.height) * 0.75);
    grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
    grad.addColorStop(1, `rgba(255, 0, 0, ${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
  }

  ctx.restore();
}

// ===== Loop =====
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ===== UI wiring =====
startBtn.addEventListener('click', () => {
  actx.resume();
  overlay.classList.add('hidden');
  reset();
});

restartBtn.addEventListener('click', () => {
  gameoverEl.classList.add('hidden');
  reset();
});

loop();
