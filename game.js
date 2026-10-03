// ===== Setup =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const healthBar = document.getElementById('health-bar');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
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

function playDeath() {
  const t = actx.currentTime;

  // Guttural descending scream (oscillator + distortion-ish via waveshaper)
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

  // Noise burst for the splatter/impact
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

  // Low thud punch
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

// ===== Game state =====
let player = { x: 0, y: 0, r: 16, speed: 4, health: 100, maxHealth: 100, hurtCooldown: 0 };
let bullets = [], enemies = [], particles = [], splatters = [];
let score = 0, wave = 1, enemiesToSpawn = 0, spawnTimer = 0, fireTimer = 0, running = false, shake = 0;

function reset() {
  player = { x: canvas.width / 2, y: canvas.height / 2, r: 16, speed: 4, health: 100, maxHealth: 100, hurtCooldown: 0 };
  bullets = [];
  enemies = [];
  particles = [];
  splatters = [];
  score = 0;
  wave = 1;
  enemiesToSpawn = 5;
  spawnTimer = 0;
  fireTimer = 0;
  shake = 0;
  running = true;
  healthBar.style.width = '100%';
  scoreEl.textContent = 'Score: 0';
  waveEl.textContent = 'Wave: 1';
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) { x = -30; y = Math.random() * canvas.height; }
  else if (edge === 1) { x = canvas.width + 30; y = Math.random() * canvas.height; }
  else if (edge === 2) { x = Math.random() * canvas.width; y = -30; }
  else { x = Math.random() * canvas.width; y = canvas.height + 30; }

  const baseSpeed = 1 + Math.min(wave * 0.15, 2.5);
  enemies.push({
    x, y,
    r: 14 + Math.random() * 6,
    speed: baseSpeed + Math.random() * 0.6,
    hp: 2 + Math.floor(wave / 3),
    maxHp: 2 + Math.floor(wave / 3),
    hue: 90 + Math.random() * 40,
    wobble: Math.random() * Math.PI * 2
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
      gravity: 0.15
    });
  }
  // permanent-ish ground splatter
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

function shoot() {
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  bullets.push({
    x: player.x + Math.cos(angle) * player.r,
    y: player.y + Math.sin(angle) * player.r,
    vx: Math.cos(angle) * 11,
    vy: Math.sin(angle) * 11,
    r: 4
  });
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

  // shooting
  fireTimer--;
  if (mouse.down && fireTimer <= 0) {
    shoot();
    fireTimer = 8;
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
          enemies.splice(j, 1);
        } else {
          playHit();
        }
        break;
      }
    }
  }

  // enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.wobble += 0.15;
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(angle) * e.speed + Math.sin(e.wobble) * 0.4;
    e.y += Math.sin(angle) * e.speed + Math.cos(e.wobble) * 0.4;

    if (Math.hypot(player.x - e.x, player.y - e.y) < player.r + e.r) {
      if (player.hurtCooldown <= 0) {
        player.health -= 10;
        player.hurtCooldown = 30;
        playPlayerHurt();
        shake = 6;
        healthBar.style.width = Math.max(0, player.health) + '%';
        if (player.health <= 0) endGame();
      }
    }
  }
  if (player.hurtCooldown > 0) player.hurtCooldown--;

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
function draw() {
  ctx.save();
  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  ctx.fillStyle = '#1a0e0e';
  ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

  // ground blood splatters
  for (const s of splatters) {
    ctx.fillStyle = `rgba(120, 0, 10, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // particles (blood)
  for (const p of particles) {
    const alpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = `rgba(200, 10, 20, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // enemies
  for (const e of enemies) {
    ctx.fillStyle = `hsl(${e.hue}, 70%, 35%)`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    // hp pips
    ctx.fillStyle = '#300';
    ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4);
    ctx.fillStyle = '#e33';
    ctx.fillRect(e.x - e.r, e.y - e.r - 8, (e.r * 2) * (e.hp / e.maxHp), 4);
  }

  // bullets
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
  ctx.fillStyle = '#3cf';
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eee';
  ctx.fillRect(player.r - 4, -4, 20, 8); // gun barrel
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
