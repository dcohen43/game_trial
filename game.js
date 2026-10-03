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

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
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
let player = { x: 0, y: 0, r: 16, speed: 4, health: 100, maxHealth: 100, hurtCooldown: 0, weapon: 'normal', weaponTimer: 0, lives: GameCore.STARTING_LIVES };
let bullets = [], enemies = [], particles = [], splatters = [], obstacles = [], enemyProjectiles = [], pickups = [];
let score = 0, wave = 1, enemiesToSpawn = 0, spawnTimer = 0, fireTimer = 0, running = false, shake = 0, levelBannerTimer = 0, regenGrace = 0;
let comboCount = 0, comboTimer = 0;

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
  const lethal = GameCore.applyDamage(player, amount);
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
  player = { x: canvas.width / 2, y: canvas.height / 2, r: 16, speed: 4, health: 100, maxHealth: 100, hurtCooldown: 0, weapon: 'normal', weaponTimer: 0, lives: GameCore.STARTING_LIVES };
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
      color: '200, 10, 20'
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
  const type = GameCore.rollPickupDrop();
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
  const makeBullet = a => bullets.push({
    x: player.x + Math.cos(a) * player.r,
    y: player.y + Math.sin(a) * player.r,
    vx: Math.cos(a) * 11,
    vy: Math.sin(a) * 11,
    r: 4
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

  // spawn waves
  if (enemiesToSpawn > 0) {
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
      if (GameCore.circlesOverlap(b.x, b.y, b.r, e.x, e.y, e.r)) {
        e.hp--;
        spawnBlood(b.x, b.y, 6, 3);
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          spawnBlood(e.x, e.y, 35, 6);
          playDeath();
          shake = 10;
          registerKill();
          maybeDropPickup(e.x, e.y);
          enemies.splice(j, 1);
        } else {
          playHit();
        }
        break;
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
function drawEnemy(e) {
  if (e.kind === 'brute') {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = `hsl(${e.hue}, 75%, 32%)`;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      const r = e.r * (i % 2 === 0 ? 1 : 0.85);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (e.kind === 'spitter') {
    ctx.save();
    ctx.translate(e.x, e.y);
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.rotate(angle);
    ctx.fillStyle = `hsl(${e.hue}, 70%, 45%)`;
    ctx.beginPath();
    ctx.moveTo(e.r, 0);
    ctx.lineTo(-e.r * 0.7, e.r * 0.8);
    ctx.lineTo(-e.r * 0.7, -e.r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = `hsl(${e.hue}, 70%, 35%)`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#300';
  ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4);
  ctx.fillStyle = '#e33';
  ctx.fillRect(e.x - e.r, e.y - e.r - 8, (e.r * 2) * (e.hp / e.maxHp), 4);
}

const PICKUP_COLORS = { health: '#3f3', spread: '#ff0', rapid: '#3cf', life: '#ffd700' };

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
// well in front) in place of the old plain circle + stub. Call with the
// context already translated to the player's position and rotated to its
// facing angle.
function drawPlayerSprite(r) {
  ctx.fillStyle = '#6b7d45';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2c3621';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#4a5a30';
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

  ctx.fillStyle = '#1a0e0e';
  ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

  for (const s of splatters) {
    ctx.fillStyle = `rgba(120, 0, 10, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const rect of obstacles) {
    ctx.fillStyle = '#2a1818';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = '#4a2828';
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
    ctx.fillStyle = '#ffd400';
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
