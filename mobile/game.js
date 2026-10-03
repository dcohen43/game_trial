// ===== Setup =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const healthBar = document.getElementById('health-bar');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const weaponStatusEl = document.getElementById('weapon-status');
const overlay = document.getElementById('overlay');
const gameoverEl = document.getElementById('gameover');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const controlBar = document.getElementById('control-bar');

// Scales world-object sizes (enemies, player, obstacles, projectiles) down
// on small screens. Fixed pixel sizes designed for a tablet-size canvas
// read as comically oversized on a phone-size canvas, since the same pixel
// count covers a much bigger fraction of the screen. 700px is roughly a
// tablet landscape canvas (scale 1); it floors at 0.55 so things stay
// legible/hittable on the smallest phones, and never scales above 1 so
// nothing balloons on very large screens.
let worldScale = 1;

// Floor grid + vignette, pre-rendered to an offscreen canvas and just
// blitted each frame instead of redrawn — cheap regardless of how many
// grid lines it takes, and gives the arena some visual depth instead of a
// flat fill.
const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d');

function renderBackground() {
  bgCanvas.width = canvas.width + 40;
  bgCanvas.height = canvas.height + 40;
  bgCtx.fillStyle = '#1a0e0e';
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  bgCtx.strokeStyle = 'rgba(255, 60, 60, 0.05)';
  bgCtx.lineWidth = 1;
  const spacing = 48;
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

  const grad = bgCtx.createRadialGradient(
    bgCanvas.width / 2, bgCanvas.height / 2, Math.min(bgCanvas.width, bgCanvas.height) * 0.2,
    bgCanvas.width / 2, bgCanvas.height / 2, Math.max(bgCanvas.width, bgCanvas.height) * 0.7
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - controlBar.getBoundingClientRect().height;
  worldScale = Math.max(0.55, Math.min(1, Math.min(canvas.width, canvas.height) / 700));
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

// ===== Virtual joysticks (touch) =====
// ===== Move stick: fixed position, always visible =====
function makeMoveStick(elId) {
  const el = document.getElementById(elId);
  const knob = el.querySelector('.stick-knob');
  const state = { touchId: null, dx: 0, dy: 0, maxR: 55 };
  let originX = 0, originY = 0;

  function start(touch) {
    // The touch zone is much bigger than the visible 130px stick (it fills
    // its whole half of the control bar so it's easy to grab). maxR must
    // scale with that zone, or almost any touch lands outside a tiny fixed
    // radius and instantly clamps to full deflection — no graduated control
    // at all, which read as "unresponsive" despite dx/dy changing correctly.
    const rect = el.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
    state.maxR = Math.min(rect.width, rect.height) / 2 * 0.85;
    state.touchId = touch.identifier;
    el.classList.add('active');
    move(touch);
  }

  function move(touch) {
    let dx = touch.clientX - originX;
    let dy = touch.clientY - originY;
    const dist = Math.hypot(dx, dy);
    if (dist > state.maxR) {
      dx = (dx / dist) * state.maxR;
      dy = (dy / dist) * state.maxR;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    state.dx = dx / state.maxR;
    state.dy = dy / state.maxR;
  }

  function end() {
    state.touchId = null;
    state.dx = 0;
    state.dy = 0;
    knob.style.transform = 'translate(0px, 0px)';
    el.classList.remove('active');
  }

  el.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state.touchId === null) start(e.changedTouches[0]);
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === state.touchId) {
        e.preventDefault();
        move(touch);
      }
    }
  }, { passive: false });

  window.addEventListener('touchend', e => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === state.touchId) end();
    }
  });
  window.addEventListener('touchcancel', e => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === state.touchId) end();
    }
  });

  return state;
}

const moveStick = makeMoveStick('move-stick');

// ===== Aim & fire stick: a real, fixed, always-visible joystick, same
// mechanics as the move stick. Its CURRENT direction from center sets
// facing directly every frame (read in update(), not accumulated from
// deltas) — sliding a thumb around the stick's own small visible range
// sweeps all 360 degrees with no lifting required, and since each frame
// just reads a held position rather than differentiating noisy touch
// samples, it isn't prone to the jitter a delta/rotary approach was.
// Touching down fires continuously; releasing stops firing and holds the
// last facing (never snaps back to anything). =====
const aimStick = makeMoveStick('look-zone');
const AIM_DEADZONE = 0.15; // fraction of maxR below which direction is ignored

// ===== Speed setting (adjustable, persisted) =====
const BASE_SPEED = 4;
const speedSlider = document.getElementById('speed-slider');
const speedValueEl = document.getElementById('speed-value');

function loadSpeedMul() {
  try {
    const v = parseFloat(localStorage.getItem('carnageArenaSpeedMul'));
    return isNaN(v) ? 0.7 : v;
  } catch (e) {
    return 0.7;
  }
}
function saveSpeedMul(v) {
  try { localStorage.setItem('carnageArenaSpeedMul', v); } catch (e) { /* ignore */ }
}

let speedMultiplier = loadSpeedMul();
speedSlider.value = speedMultiplier;
speedValueEl.textContent = speedMultiplier.toFixed(2) + 'x';
speedSlider.addEventListener('input', () => {
  speedMultiplier = parseFloat(speedSlider.value);
  speedValueEl.textContent = speedMultiplier.toFixed(2) + 'x';
  saveSpeedMul(speedMultiplier);
  player.speed = BASE_SPEED * speedMultiplier;
});

// ===== Control bar size (adjustable, persisted) =====
const controlSizeSlider = document.getElementById('control-size-slider');
const controlSizeValueEl = document.getElementById('control-size-value');

function loadControlSize() {
  try {
    const v = parseInt(localStorage.getItem('carnageArenaControlSize'), 10);
    return isNaN(v) ? 190 : v;
  } catch (e) {
    return 190;
  }
}
function saveControlSize(v) {
  try { localStorage.setItem('carnageArenaControlSize', v); } catch (e) { /* ignore */ }
}

let controlSize = loadControlSize();
controlSizeSlider.value = controlSize;
controlSizeValueEl.textContent = controlSize + 'px';
document.documentElement.style.setProperty('--control-bar-height', controlSize + 'px');
controlSizeSlider.addEventListener('input', () => {
  controlSize = parseInt(controlSizeSlider.value, 10);
  controlSizeValueEl.textContent = controlSize + 'px';
  saveControlSize(controlSize);
  document.documentElement.style.setProperty('--control-bar-height', controlSize + 'px');
  resize();
});

// ===== Enemy kind definitions (shared logic lives in core.js) =====
const ENEMY_KINDS = GameCore.ENEMY_KINDS;

// ===== Game state =====
let player = { x: 0, y: 0, r: 16 * worldScale, speed: BASE_SPEED * speedMultiplier, health: 100, maxHealth: 100, hurtCooldown: 0, angle: -Math.PI / 2, weapon: 'normal', weaponTimer: 0 };
let bullets = [], enemies = [], particles = [], splatters = [], obstacles = [], enemyProjectiles = [], pickups = [];
let score = 0, wave = 1, enemiesToSpawn = 0, spawnTimer = 0, fireTimer = 0, running = false, shake = 0, levelBannerTimer = 0;

function spawnObstacles() {
  obstacles = [];
  const count = 5;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  let attempts = 0;
  while (obstacles.length < count && attempts < 200) {
    attempts++;
    const w = (50 + Math.random() * 70) * worldScale;
    const h = (50 + Math.random() * 70) * worldScale;
    const x = 40 + Math.random() * (canvas.width - 80 - w);
    const y = 40 + Math.random() * (canvas.height - 80 - h);
    const rect = { x, y, w, h, variant: Math.floor(Math.random() * 3) };
    const rectCx = x + w / 2, rectCy = y + h / 2;
    if (Math.hypot(rectCx - cx, rectCy - cy) < 150) continue;
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
  player = { x: canvas.width / 2, y: canvas.height / 2, r: 16 * worldScale, speed: BASE_SPEED * speedMultiplier, health: 100, maxHealth: 100, hurtCooldown: 0, angle: -Math.PI / 2, weapon: 'normal', weaponTimer: 0 };
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
  running = true;
  spawnObstacles();
  healthBar.style.width = '100%';
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
    r: (stats.r + Math.random() * 4) * worldScale,
    speed: stats.speed + Math.random() * 0.4,
    hp: stats.hp,
    maxHp: stats.hp,
    hue: stats.hue + Math.random() * 20 - 10,
    wobble: Math.random() * Math.PI * 2,
    contactDamage: stats.contactDamage,
    shootCooldown: 60 + Math.random() * 40,
    preferredRange: 220
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
  pickups.push({ x, y, type, r: 12 * worldScale, bob: Math.random() * Math.PI * 2 });
}

function applyPickup(p) {
  playPickup();
  GameCore.applyPickupEffect(player, p.type);
  healthBar.style.width = player.health + '%';
}

function fireCooldown() {
  return GameCore.fireCooldown(player.weapon);
}

function shoot(angle) {
  const makeBullet = a => bullets.push({
    x: player.x + Math.cos(a) * player.r,
    y: player.y + Math.sin(a) * player.r,
    vx: Math.cos(a) * 11,
    vy: Math.sin(a) * 11,
    r: 4 * worldScale
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
  finalScoreEl.textContent = `Score: ${score} — Level ${wave}`;
  gameoverEl.classList.remove('hidden');
}

// ===== Update =====
function update() {
  if (!running) return;

  // movement from left stick (linear: speed tracks deflection directly, for responsiveness)
  const mdx = moveStick.dx, mdy = moveStick.dy;
  const len = Math.hypot(mdx, mdy);
  if (len > 0.08) {
    const mag = Math.min(len, 1);
    player.x += (mdx / len) * player.speed * mag;
    player.y += (mdy / len) * player.speed * mag;
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

  // aim: read the stick's current direction directly, every frame — not a
  // delta. Holding it deflected in a direction IS the facing, immediately.
  const aimDist = Math.hypot(aimStick.dx, aimStick.dy);
  if (aimDist > AIM_DEADZONE) {
    player.angle = Math.atan2(aimStick.dy, aimStick.dx);
  }

  // fire for as long as the aim stick is held, toward the current facing
  fireTimer--;
  if (aimStick.touchId !== null && fireTimer <= 0) {
    shoot(player.angle);
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
  }

  if (levelBannerTimer > 0) levelBannerTimer--;

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
          score += 10;
          scoreEl.textContent = `Score: ${score}`;
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
      if (player.hurtCooldown <= 0) {
        player.health -= p.damage;
        player.hurtCooldown = 20;
        playPlayerHurt();
        shake = 5;
        healthBar.style.width = Math.max(0, player.health) + '%';
        if (player.health <= 0) endGame();
      }
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
          r: 5 * worldScale, damage: 8
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
      if (player.hurtCooldown <= 0) {
        player.health -= e.contactDamage;
        player.hurtCooldown = 30;
        playPlayerHurt();
        shake = 6;
        healthBar.style.width = Math.max(0, player.health) + '%';
        if (player.health <= 0) endGame();
      }
    }
  }
  if (player.hurtCooldown > 0) player.hurtCooldown--;

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

// Three purely-visual obstacle styles over the same rectangular hitbox, so
// the arena doesn't read as identical boxes copy-pasted everywhere.
function drawObstacle(rect) {
  const { x, y, w, h, variant } = rect;
  if (variant === 1) {
    // rusted container: warm tint, diagonal corner braces
    ctx.fillStyle = '#331c14';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#6b3a24';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(180, 100, 60, 0.5)';
    ctx.lineWidth = 3;
    const c = Math.min(w, h) * 0.25;
    ctx.beginPath();
    ctx.moveTo(x, y + c); ctx.lineTo(x + c, y);
    ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y + c);
    ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h);
    ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h - c);
    ctx.stroke();
  } else if (variant === 2) {
    // wooden crate: darker fill, slat lines
    ctx.fillStyle = '#231414';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#4a2828';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(100, 50, 40, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.33); ctx.lineTo(x + w, y + h * 0.33);
    ctx.moveTo(x, y + h * 0.66); ctx.lineTo(x + w, y + h * 0.66);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#2a1818';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#4a2828';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }
}

const PICKUP_COLORS = { health: '#3f3', spread: '#ff0', rapid: '#3cf' };

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

function draw() {
  ctx.save();
  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  ctx.drawImage(bgCanvas, -20, -20);

  for (const s of splatters) {
    ctx.fillStyle = `rgba(120, 0, 10, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const rect of obstacles) drawObstacle(rect);

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

  // persistent aim-direction line, visible even when not touching the aim stick
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.strokeStyle = 'rgba(255, 220, 0, 0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(player.r + 6, 0);
  ctx.lineTo(player.r + 70, 0);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#3cf';
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eee';
  ctx.fillRect(player.r - 4, -4, 20, 8);
  ctx.restore();

  if (levelBannerTimer > 0) {
    const alpha = Math.min(1, levelBannerTimer / 30);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f33';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#800';
    ctx.shadowBlur = 16;
    ctx.fillText(`LEVEL ${wave}`, canvas.width / 2, canvas.height / 2 - 80);
    ctx.restore();
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
function unlockAudio() {
  if (actx.state === 'suspended') actx.resume();
}

startBtn.addEventListener('touchend', e => {
  e.preventDefault();
  unlockAudio();
  overlay.classList.add('hidden');
  reset();
});
startBtn.addEventListener('click', () => {
  unlockAudio();
  overlay.classList.add('hidden');
  reset();
});

restartBtn.addEventListener('touchend', e => {
  e.preventDefault();
  gameoverEl.classList.add('hidden');
  reset();
});
restartBtn.addEventListener('click', () => {
  gameoverEl.classList.add('hidden');
  reset();
});

loop();
