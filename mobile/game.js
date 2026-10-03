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

// ===== Virtual joysticks (touch) =====
function makeStick(elId) {
  const el = document.getElementById(elId);
  const knob = el.querySelector('.stick-knob');
  const state = { el, knob, touchId: null, dx: 0, dy: 0, active: false, cx: 0, cy: 0, maxR: 40 };

  function start(touch) {
    const rect = el.getBoundingClientRect();
    state.cx = rect.left + rect.width / 2;
    state.cy = rect.top + rect.height / 2;
    state.touchId = touch.identifier;
    state.active = true;
    el.classList.add('active');
    move(touch);
  }

  function move(touch) {
    let dx = touch.clientX - state.cx;
    let dy = touch.clientY - state.cy;
    const dist = Math.hypot(dx, dy);
    if (dist > state.maxR) {
      dx = (dx / dist) * state.maxR;
      dy = (dy / dist) * state.maxR;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const norm = state.maxR;
    state.dx = dx / norm;
    state.dy = dy / norm;
  }

  function end() {
    state.touchId = null;
    state.active = false;
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

const moveStick = makeStick('move-stick');
const aimStick = makeStick('aim-stick');

// ===== Enemy kind definitions =====
const ENEMY_KINDS = {
  grunt: { baseR: 17, speedMul: 1, hpMul: 1, contactDamage: 10, hue: 105, label: 'grunt' },
  brute: { baseR: 29, speedMul: 0.55, hpMul: 2.6, contactDamage: 18, hue: 15, label: 'brute' },
  spitter: { baseR: 14, speedMul: 0.9, hpMul: 0.8, contactDamage: 6, hue: 280, label: 'spitter' }
};

function pickEnemyKind() {
  const roll = Math.random();
  if (wave >= 3 && roll < 0.2) return 'spitter';
  if (wave >= 2 && roll < 0.45) return 'brute';
  return 'grunt';
}

// ===== Game state =====
let player = { x: 0, y: 0, r: 16, speed: 4, health: 100, maxHealth: 100, hurtCooldown: 0, angle: -Math.PI / 2, weapon: 'normal', weaponTimer: 0 };
let bullets = [], enemies = [], particles = [], splatters = [], obstacles = [], enemyProjectiles = [], pickups = [];
let score = 0, wave = 1, enemiesToSpawn = 0, spawnTimer = 0, fireTimer = 0, running = false, shake = 0;

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawnObstacles() {
  obstacles = [];
  const count = 5;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  let attempts = 0;
  while (obstacles.length < count && attempts < 200) {
    attempts++;
    const w = 50 + Math.random() * 70;
    const h = 50 + Math.random() * 70;
    const x = 40 + Math.random() * (canvas.width - 80 - w);
    const y = 40 + Math.random() * (canvas.height - 80 - h);
    const rect = { x, y, w, h };
    const rectCx = x + w / 2, rectCy = y + h / 2;
    if (Math.hypot(rectCx - cx, rectCy - cy) < 150) continue;
    if (obstacles.some(o => rectsOverlap(
      { x: rect.x - 20, y: rect.y - 20, w: rect.w + 40, h: rect.h + 40 }, o))) continue;
    obstacles.push(rect);
  }
}

function resolveObstacleCollisions(entity) {
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
}

function circleIntersectsAnyObstacle(cx, cy, cr) {
  for (const rect of obstacles) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    if (Math.hypot(cx - closestX, cy - closestY) < cr) return true;
  }
  return false;
}

function reset() {
  player = { x: canvas.width / 2, y: canvas.height / 2, r: 16, speed: 4, health: 100, maxHealth: 100, hurtCooldown: 0, angle: -Math.PI / 2, weapon: 'normal', weaponTimer: 0 };
  bullets = [];
  enemies = [];
  particles = [];
  splatters = [];
  enemyProjectiles = [];
  pickups = [];
  score = 0;
  wave = 1;
  enemiesToSpawn = 5;
  spawnTimer = 0;
  fireTimer = 0;
  shake = 0;
  running = true;
  spawnObstacles();
  healthBar.style.width = '100%';
  scoreEl.textContent = 'Score: 0';
  waveEl.textContent = 'Wave: 1';
  weaponStatusEl.classList.add('hidden');
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) { x = -30; y = Math.random() * canvas.height; }
  else if (edge === 1) { x = canvas.width + 30; y = Math.random() * canvas.height; }
  else if (edge === 2) { x = Math.random() * canvas.width; y = -30; }
  else { x = Math.random() * canvas.width; y = canvas.height + 30; }

  const kind = pickEnemyKind();
  const def = ENEMY_KINDS[kind];
  const baseSpeed = (1 + Math.min(wave * 0.15, 2.5)) * def.speedMul;
  const baseHp = Math.round((2 + Math.floor(wave / 3)) * def.hpMul);
  enemies.push({
    kind,
    x, y,
    r: def.baseR + Math.random() * 4,
    speed: baseSpeed + Math.random() * 0.4,
    hp: baseHp,
    maxHp: baseHp,
    hue: def.hue + Math.random() * 20 - 10,
    wobble: Math.random() * Math.PI * 2,
    contactDamage: def.contactDamage,
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
  if (Math.random() > 0.18) return;
  const types = ['health', 'spread', 'rapid'];
  const type = types[Math.floor(Math.random() * types.length)];
  pickups.push({ x, y, type, r: 12, bob: Math.random() * Math.PI * 2 });
}

function applyPickup(p) {
  playPickup();
  if (p.type === 'health') {
    player.health = Math.min(player.maxHealth, player.health + 30);
    healthBar.style.width = player.health + '%';
  } else {
    player.weapon = p.type;
    player.weaponTimer = 480;
  }
}

function fireCooldown() {
  return player.weapon === 'rapid' ? 4 : 8;
}

function shoot(angle) {
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
  finalScoreEl.textContent = `Score: ${score} — Wave ${wave}`;
  gameoverEl.classList.remove('hidden');
}

// ===== Update =====
function update() {
  if (!running) return;

  // movement from left stick
  const mdx = moveStick.dx, mdy = moveStick.dy;
  const len = Math.hypot(mdx, mdy);
  if (len > 0.15) {
    player.x += (mdx / Math.max(len, 1)) * player.speed * Math.min(len, 1);
    player.y += (mdy / Math.max(len, 1)) * player.speed * Math.min(len, 1);
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

  // aim + fire from right stick
  const adx = aimStick.dx, ady = aimStick.dy;
  const alen = Math.hypot(adx, ady);
  fireTimer--;
  if (alen > 0.25) {
    player.angle = Math.atan2(ady, adx);
    if (fireTimer <= 0) {
      shoot(player.angle);
      fireTimer = fireCooldown();
    }
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
    enemiesToSpawn = 4 + wave * 2;
    waveEl.textContent = `Wave: ${wave}`;
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
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
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
    if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + p.r) {
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
    if (Math.hypot(player.x - p.x, player.y - p.y) < player.r + p.r) {
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
