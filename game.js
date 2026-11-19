/* =========================================================
   БЫЧОК ПРОТИВ ЗОМБИ-УНИВЕРА — v3.2 (Smooth 2D)
   20 открытых уровней, карты x2, ключи на паркур-островах, портал,
   летающие враги и черви, деревья, мины и смертельные провалы,
   возврат врагов и мини-боссов на спавн при падении в яму,
   мини-боссы на 5 и 15 этажах, босс "Кирилл-Вебкодер" на 20,
   ульта-луч на клавишу "Н" (каждая 10-я атака).
   ========================================================= */

'use strict';

// =================== КОНСТАНТЫ ===================
const W = 480, H = 270;
const GRAVITY = 0.55;
const GROUND_Y = 230;
const PLAYER_SPEED = 2.85;
const JUMP_VELOCITY = -10.2;
const SHOOT_CD = 0.34;
const ULT_MAX_CHARGES = 10;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;

const hpInner = document.getElementById('hp-bar-inner');
const ultInner = document.getElementById('ult-bar-inner');
const levelLabel = document.getElementById('level-label');
const scoreLabel = document.getElementById('score-label');
const keysLabel = document.getElementById('keys-label');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ov-title');
const ovText = document.getElementById('ov-text');
const ovBtn = document.getElementById('ov-btn');
const pauseBtn = document.getElementById('pause-btn');
const soundBtn = document.getElementById('sound-btn');
const touchControls = document.getElementById('touch-controls');

// =================== СОХРАНЕНИЕ ===================
const SAVE_KEY = 'bychok_save_v3';
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return {
      unlocked: 20,
      bestScore: s.bestScore || 0,
      soundOn: s.soundOn !== false
    };
  } catch {
    return { unlocked: 20, bestScore: 0, soundOn: true };
  }
}
function writeSave(s) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
}
let SAVE = loadSave();

// =================== АУДИО ===================
class Audio8bit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.musicOn = SAVE.soundOn;
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  beep(freq, dur, type = 'square', gainNode = this.sfxGain, vol = 0.3, slide = 0) {
    if (!this.ctx || !this.musicOn) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(gainNode);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  sfxJump()     { this.beep(340, 0.12, 'triangle', this.sfxGain, 0.26, 260); }
  sfxHit()      { this.beep(190, 0.08, 'sawtooth', this.sfxGain, 0.34, -80); }
  sfxShoot()    { this.beep(720, 0.08, 'triangle', this.sfxGain, 0.28, -280); }
  sfxHurt()     { this.beep(140, 0.25, 'sawtooth', this.sfxGain, 0.42, -100); }
  sfxEnemyDie() { this.beep(520, 0.15, 'triangle', this.sfxGain, 0.3, -380); }
  sfxPickup()   { this.beep(680, 0.11, 'sine', this.sfxGain, 0.32, 320); }
  sfxPortal()   { this.beep(520, 0.22, 'sine', this.sfxGain, 0.35, 420); }
  sfxUlt()      { this.beep(260, 0.45, 'sawtooth', this.sfxGain, 0.45, 580); }
  sfxMine()     { this.beep(110, 0.35, 'sawtooth', this.sfxGain, 0.5, -75); }
  sfxLand()     { this.beep(95, 0.05, 'triangle', this.sfxGain, 0.2, -30); }
  sfxBoss()     { this.beep(85, 0.4, 'sawtooth', this.sfxGain, 0.45, -40); }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const melody = [
      440, 0, 523, 0, 587, 523, 440, 0,
      392, 0, 440, 494, 523, 0, 494, 440,
      349, 0, 392, 0, 440, 494, 523, 0,
      587, 523, 494, 440, 392, 0, 349, 0
    ];
    const bass = [110, 110, 130, 110, 98, 98, 110, 130, 87, 87, 98, 87, 110, 98, 87, 110];
    let step = 0;
    const tick = () => {
      if (!this.musicOn) { step = (step + 1) % 16; return; }
      const n = melody[step % melody.length];
      if (n) this.beep(n, 0.14, 'triangle', this.musicGain, 0.25);
      if (step % 2 === 0) this.beep(bass[(step / 2) % bass.length], 0.18, 'sine', this.musicGain, 0.34);
      step++;
    };
    this.musicTimer = setInterval(tick, 145);
  }
  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
  toggle() {
    this.musicOn = !this.musicOn;
    SAVE.soundOn = this.musicOn;
    writeSave(SAVE);
    soundBtn.textContent = this.musicOn ? '🔊' : '🔇';
    if (this.musicOn) {
      this.init();
      this.resume();
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }
}
const audio = new Audio8bit();
soundBtn.textContent = SAVE.soundOn ? '🔊' : '🔇';

// =================== ВВОД ===================
const keys = { left: false, right: false, jump: false, attack: false, shoot: false, ult: false };
const keyMap = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'jump', ArrowUp: 'jump', Space: 'jump',
  KeyJ: 'attack', ArrowDown: 'attack',
  KeyK: 'shoot', KeyL: 'shoot',
  KeyH: 'ult'
};
function resetKeys() {
  keys.left = keys.right = keys.jump = keys.attack = keys.shoot = keys.ult = false;
  document.querySelectorAll('.tbtn.pressed').forEach(b => b.classList.remove('pressed'));
}
window.addEventListener('keydown', (e) => {
  const k = e.key ? e.key.toLowerCase() : '';
  if (keyMap[e.code]) {
    keys[keyMap[e.code]] = true;
    e.preventDefault();
  } else if (k === 'н' || k === 'h') {
    keys.ult = true;
    e.preventDefault();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', (e) => {
  const k = e.key ? e.key.toLowerCase() : '';
  if (keyMap[e.code]) {
    keys[keyMap[e.code]] = false;
    e.preventDefault();
  } else if (k === 'н' || k === 'h') {
    keys.ult = false;
    e.preventDefault();
  }
});
window.addEventListener('blur', resetKeys);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetKeys(); });
window.addEventListener('contextmenu', resetKeys);

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) touchControls.classList.remove('hidden');
document.querySelectorAll('.tbtn').forEach(btn => {
  const act = btn.dataset.action;
  const on = (e) => {
    e.preventDefault();
    keys[act] = true;
    btn.classList.add('pressed');
    audio.resume();
  };
  const off = (e) => {
    e.preventDefault();
    keys[act] = false;
    btn.classList.remove('pressed');
  };
  btn.addEventListener('touchstart', on, { passive: false });
  btn.addEventListener('touchend', off, { passive: false });
  btn.addEventListener('touchcancel', off, { passive: false });
  btn.addEventListener('mousedown', on);
  btn.addEventListener('mouseup', off);
  btn.addEventListener('mouseleave', off);
});
document.addEventListener('touchend', (e) => {
  if (!e.target.closest || !e.target.closest('.tbtn')) {
    document.querySelectorAll('.tbtn.pressed').forEach(b => {
      if (!b.matches(':active')) {
        keys[b.dataset.action] = false;
        b.classList.remove('pressed');
      }
    });
  }
}, { passive: true });
document.addEventListener('touchcancel', resetKeys, { passive: true });

// =================== УТИЛИТЫ ===================
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const aabb = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.h && a.y + a.h > b.y;

function isOverPit(x, w, pits) {
  const center = x + w * 0.5;
  for (const pit of pits) {
    if (center > pit.x + 4 && center < pit.x + pit.w - 4) return true;
  }
  return false;
}

function updateUltHud(charges) {
  const pct = clamp((charges / ULT_MAX_CHARGES) * 100, 0, 100);
  ultInner.style.width = pct + '%';
  ultInner.classList.toggle('ready', charges >= ULT_MAX_CHARGES);
}

// =================== СУЩНОСТИ ===================
class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.spawnX = x;
    this.spawnY = y;
    this.vx = 0; this.vy = 0;
    this.hp = 1; this.maxHp = 1;
    this.facing = 1;
    this.dead = false;
    this.onGround = false;
    this.flash = 0;
    this.animT = 0;
  }
  gravity(platforms, pits = [], instantKillOnPit = false, world = null) {
    this.vy += GRAVITY;
    const oldY = this.y;
    this.y += this.vy;

    this.onGround = false;
    if (this.vy >= 0) {
      for (const p of platforms) {
        if (this.x + this.w > p.x && this.x < p.x + p.w) {
          if (oldY + this.h <= p.y + 3 && this.y + this.h >= p.y) {
            this.y = p.y - this.h;
            this.vy = 0;
            this.onGround = true;
            break;
          }
        }
      }
    }

    const overPit = isOverPit(this.x, this.w, pits);
    if (!this.onGround && !overPit && this.y + this.h >= GROUND_Y) {
      if (this.vy > 3.2) audio.sfxLand();
      this.y = GROUND_Y - this.h;
      this.vy = 0;
      this.onGround = true;
    }

    if (this.y > H + 12) {
      if (instantKillOnPit && world) {
        world.player.instantKill(world);
        return;
      }
      // Монстры и мини-боссы при падении в яму возвращаются на точку своего спавна
      if (typeof this.spawnX === 'number' && typeof this.spawnY === 'number') {
        this.x = this.spawnX;
        this.y = this.spawnY;
      } else {
        this.y = GROUND_Y - this.h;
      }
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
    }
  }
  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ---- Луч ульты ----
class UltBeam {
  constructor(x, y, dir, world) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.world = world;
    this.life = 0.55;
    this.maxLife = 0.55;
    this.tickTimer = 0;
    this.dead = false;
  }
  getRect() {
    const length = 420;
    const h = 24;
    return {
      x: this.dir > 0 ? this.x : this.x - length,
      y: this.y - h / 2,
      w: length,
      h
    };
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    this.tickTimer -= dt;
    if (this.tickTimer <= 0) {
      this.tickTimer = 0.08;
      const r = this.getRect();
      for (const e of this.world.enemies) {
        if (!e.dead && aabb(r, e.box())) e.takeDamage(2, this.world);
      }
      for (const b of this.world.bosses) {
        if (!b.dead && aabb(r, b.box())) b.takeDamage(2, this.world);
      }
      for (const p of this.world.projectiles) {
        if (!p.dead && aabb(r, p.box())) p.dead = true;
      }
    }
  }
  draw(ctx) {
    if (this.dead) return;
    const r = this.getRect();
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
    grad.addColorStop(0.25, 'rgba(129, 140, 248, 0.9)');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(0.75, 'rgba(244, 114, 182, 0.9)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.15)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 14 + Math.sin(this.life * 40) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---- Игрок ----
class Player extends Entity {
  constructor(x, y) {
    super(x, y, 22, 26);
    this.hp = 5; this.maxHp = 5;
    this.invuln = 0;
    this.attackT = 0;
    this.attackCd = 0;
    this.shootCd = 0;
    this.ultCharges = 0;
    this.ultCd = 0;
    this.points = 0;
    this.runT = 0;
  }
  registerAttack() {
    if (this.ultCharges < ULT_MAX_CHARGES) {
      this.ultCharges++;
      updateUltHud(this.ultCharges);
    }
  }
  activateUlt(world) {
    if (this.ultCharges < ULT_MAX_CHARGES || this.ultCd > 0) return;
    this.ultCharges = 0;
    this.ultCd = 0.6;
    updateUltHud(this.ultCharges);
    world.beams.push(new UltBeam(
      this.x + this.w / 2 + this.facing * 12,
      this.y + this.h / 2,
      this.facing,
      world
    ));
    world.shake = 7;
    audio.sfxUlt();
  }
  update(dt, world) {
    if (this.dead) return;
    let move = 0;
    if (keys.left) move -= 1;
    if (keys.right) move += 1;
    const inCoffee = world.traps.some(t => t.type === 'coffee' && aabb(this.box(), t.box()));
    const speedMod = inCoffee ? 0.45 : 1;
    this.vx = move * PLAYER_SPEED * speedMod;
    if (move !== 0) {
      this.facing = move;
      this.runT += 0.22;
    }
    this.x = clamp(this.x + this.vx, 0, world.width - this.w);

    if (keys.jump && this.onGround) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
      audio.sfxJump();
    }

    if (this.ultCd > 0) this.ultCd -= dt;
    if (keys.ult) this.activateUlt(world);

    // Ближняя атака
    if (keys.attack && this.attackCd <= 0 && this.attackT <= 0) {
      this.attackT = 0.18;
      this.attackCd = 0.3;
      this.registerAttack();
      audio.sfxHit();
    }
    if (this.attackT > 0) this.attackT -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;

    // Стрельба
    if (this.shootCd > 0) this.shootCd -= dt;
    if (keys.shoot && this.shootCd <= 0) {
      this.shootCd = SHOOT_CD;
      this.registerAttack();
      world.playerProjectiles.push(new PlayerBullet(
        this.x + this.w / 2 + this.facing * 12,
        this.y + 11,
        this.facing * 6.2,
        0,
        world
      ));
      audio.sfxShoot();
    }

    if (this.invuln > 0) this.invuln -= dt;
    if (this.flash > 0) this.flash -= dt;

    this.gravity(world.platforms, world.pits, true, world);
    if (this.dead) return;
    this.animT += 0.15;

    // Хитбокс ближней атаки
    if (this.attackT > 0.08) {
      const reach = 32;
      const atkBox = {
        x: this.facing > 0 ? this.x + this.w - 4 : this.x - reach + 4,
        y: this.y + 1,
        w: reach,
        h: this.h - 2
      };
      for (const e of world.enemies) {
        if (!e.dead && aabb(atkBox, e.box())) e.takeDamage(1, world);
      }
      for (const b of world.bosses) {
        if (!b.dead && aabb(atkBox, b.box())) b.takeDamage(1, world);
      }
      for (const p of world.projectiles) {
        if (!p.dead && aabb(atkBox, p.box())) p.dead = true;
      }
    }
  }
  takeDamage(n, world) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= n;
    this.invuln = 1.0;
    this.flash = 0.2;
    audio.sfxHurt();
    world.shake = 8;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      world.onPlayerDeath();
    }
    hpInner.style.width = (this.hp / this.maxHp * 100) + '%';
  }
  instantKill(world) {
    if (this.dead) return;
    this.hp = 0;
    this.dead = true;
    audio.sfxMine();
    world.shake = 12;
    hpInner.style.width = '0%';
    world.onPlayerDeath('fatal_trap');
  }
  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    hpInner.style.width = (this.hp / this.maxHp * 100) + '%';
  }
  draw(ctx) {
    const { x, y, w, h } = this;
    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) return;
    const bob = this.onGround && Math.abs(this.vx) > 0.5 ? Math.sin(this.runT) * 1.6 : 0;
    const px = x, py = y + bob;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.beginPath();
    ctx.ellipse(px + w / 2, y + h + 2, w * 0.52, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyCol = this.flash > 0 ? '#ffffff' : '#ff9bb0';
    const headCol = this.flash > 0 ? '#ffffff' : '#ffb8c8';

    const legOff = Math.sin(this.runT) * 2.5;
    ctx.fillStyle = '#c14a6a';
    ctx.beginPath();
    ctx.roundRect(px + 3, py + h - 5, 6, 5 + legOff, 2.5);
    ctx.roundRect(px + w - 9, py + h - 5, 6, 5 - legOff, 2.5);
    ctx.fill();

    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.roundRect(px + 1, py + 8, w - 2, h - 12, 6);
    ctx.fill();

    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.ellipse(px + 4, py - 1, 3.2, 4.2, -0.25, 0, Math.PI * 2);
    ctx.ellipse(px + w - 4, py - 1, 3.2, 4.2, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = headCol;
    ctx.beginPath();
    ctx.roundRect(px + 2, py, w - 4, 13, 6);
    ctx.fill();

    const snoutX = this.facing > 0 ? px + w - 5 : px + 1;
    ctx.fillStyle = '#d96a8a';
    ctx.beginPath();
    ctx.roundRect(snoutX, py + 5.5, 5, 4.5, 2);
    ctx.fill();

    const eyeX = this.facing > 0 ? px + w - 7 : px + 5;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(eyeX, py + 4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    if (this.attackT > 0.08) {
      ctx.fillStyle = 'rgba(255, 240, 120, 0.85)';
      const rx = this.facing > 0 ? px + w : px - 14;
      ctx.beginPath();
      ctx.roundRect(rx, py + 4, 14, 16, 6);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---- Враги (включая летающих и червяков) ----
class Enemy extends Entity {
  constructor(x, y, type, world) {
    const isWorm = type === 'worm';
    super(x, y, isWorm ? 24 : 20, isWorm ? 16 : 24);
    this.type = type;
    this.world = world;
    this.spawnX = x;
    this.spawnY = y;
    this.attackTimer = rand(0.8, 2);
    this.jumpTimer = rand(0.6, 1.4);

    const cfg = {
      freshman: { hp: 4, speed: 0.75, color: '#5fd97a', jump: false, ranged: false, fly: false, worm: false, dmg: 1 },
      debtor:   { hp: 5, speed: 0.85, color: '#e0a952', jump: false, ranged: true,  fly: false, worm: false, dmg: 1 },
      athlete:  { hp: 6, speed: 1.45, color: '#5f8bd9', jump: true,  ranged: false, fly: false, worm: false, dmg: 1 },
      coder:    { hp: 5, speed: 0.95, color: '#b85fd9', jump: false, ranged: true,  fly: false, worm: false, dmg: 1 },
      flyer:    { hp: 4, speed: 1.25, color: '#38bdf8', jump: false, ranged: true,  fly: true,  worm: false, dmg: 1 },
      worm:     { hp: 5, speed: 1.15, color: '#f43f5e', jump: true,  ranged: false, fly: false, worm: true,  dmg: 1 }
    }[type];

    this.cfg = cfg;
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.speed = cfg.speed;
  }
  update(dt, world) {
    if (this.flash > 0) this.flash -= dt;
    if (this.dead) return;
    const p = world.player;
    const dx = p.x - this.x;
    this.facing = dx >= 0 ? 1 : -1;
    this.animT += dt * 6;

    if (this.cfg.fly) {
      this.vx = Math.sign(dx) * this.speed;
      this.x = clamp(this.x + this.vx, 0, world.width - this.w);
      const desiredY = clamp(p.y - 38 + Math.sin(this.animT * 0.7) * 16, 40, GROUND_Y - 36);
      this.y += (desiredY - this.y) * 0.08;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0 && Math.abs(dx) < 250) {
        this.shoot(world);
        this.attackTimer = rand(1.5, 2.5);
      }
      return;
    }

    this.vx = Math.sign(dx) * this.speed;
    this.x = clamp(this.x + this.vx, 0, world.width - this.w);

    if ((this.cfg.jump || this.cfg.worm) && this.onGround) {
      this.jumpTimer -= dt;
      if (this.jumpTimer <= 0) {
        this.vy = this.cfg.worm ? -7.8 : -9.2;
        this.onGround = false;
        this.jumpTimer = rand(0.7, 1.4);
      }
    }

    if (Math.abs(dx) < 28 && Math.abs(p.y - this.y) < 34) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        p.takeDamage(this.cfg.dmg, world);
        this.attackTimer = rand(0.9, 1.6);
      }
    } else {
      this.attackTimer = Math.max(0, this.attackTimer - dt * 0.3);
    }

    if (this.cfg.ranged) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0 && Math.abs(dx) < 260) {
        this.shoot(world);
        this.attackTimer = rand(1.4, 2.4);
      }
    }

    this.gravity(world.platforms, world.pits, false, world);
  }
  shoot(world) {
    const dir = this.facing;
    if (this.type === 'flyer') {
      world.projectiles.push(new Projectile(
        this.x + this.w / 2, this.y + this.h / 2, dir * 3.6, 0.2, 'spore', world
      ));
    } else if (this.type === 'debtor') {
      world.projectiles.push(new Projectile(
        this.x + this.w / 2, this.y + 6, dir * 3.5, -1.5, 'book', world
      ));
    } else {
      world.projectiles.push(new Projectile(
        this.x + this.w / 2, this.y + 6, dir * 4.2, -0.6, 'bug', world
      ));
    }
  }
  takeDamage(n, world) {
    this.hp -= n;
    this.flash = 0.15;
    this.x = clamp(this.x + world.player.facing * 4, 0, world.width - this.w);
    if (this.hp <= 0) {
      this.dead = true;
      audio.sfxEnemyDie();
      world.player.points += 15;
      scoreLabel.textContent = 'Счёт: ' + world.player.points;
      world.killCount++;
      if (Math.random() < 0.25) {
        world.pickups.push(new Pickup(this.x + this.w / 2 - 6, this.y, 'health', world));
      }
    }
  }
  draw(ctx) {
    if (this.dead) return;
    const px = this.x, py = this.y;
    const col = this.flash > 0 ? '#ffffff' : this.cfg.color;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(px + this.w / 2, py + this.h + 1, this.w * 0.48, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.type === 'worm') {
      for (let i = 3; i >= 0; i--) {
        const segX = px + this.w / 2 - this.facing * (i * 5) + Math.sin(this.animT + i) * 1.5;
        const segY = py + this.h / 2 + Math.cos(this.animT + i * 0.8) * 2;
        const r = i === 0 ? 6.5 : 5.5 - i * 0.6;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(segX, segY, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px + this.w / 2 + this.facing * 2, py + this.h / 2 - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'flyer') {
      const flap = Math.sin(this.animT * 2.2) * 7;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
      ctx.beginPath();
      ctx.ellipse(px + 3, py + 8 + flap * 0.4, 7, 3.5, -0.4, 0, Math.PI * 2);
      ctx.ellipse(px + this.w - 3, py + 8 - flap * 0.4, 7, 3.5, 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px + this.w / 2, py + this.h / 2, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(px + this.w / 2 + this.facing * 3, py + this.h / 2 - 1, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const bob = Math.sin(this.animT) * 1.2;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(px + 1, py + 7 + bob, this.w - 2, this.h - 8, 5);
      ctx.roundRect(px + 2, py + bob, this.w - 4, 11, 5);
      ctx.fill();

      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(px + 6, py + 4.5 + bob, 1.6, 0, Math.PI * 2);
      ctx.arc(px + this.w - 6, py + 4.5 + bob, 1.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#111';
      ctx.font = 'bold 7px sans-serif';
      ctx.fillText({ freshman: '1', debtor: '$', athlete: '⚽', coder: '<>' }[this.type],
        px + 4, py + this.h - 2 + bob);
    }

    const barW = this.w;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(px, py - 7, barW, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.roundRect(px + 0.5, py - 6.5, (barW - 1) * (this.hp / this.maxHp), 3, 1.5);
    ctx.fill();
    ctx.restore();
  }
}

// ---- Снаряды врагов ----
class Projectile {
  constructor(x, y, vx, vy, type, world) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.type = type; this.world = world;
    this.w = type === 'book' ? 10 : 8;
    this.h = type === 'book' ? 10 : 8;
    this.dead = false;
    this.life = 3.5;
  }
  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt) {
    this.x += this.vx;
    this.y += this.vy;
    if (this.type !== 'spore') this.vy += 0.12;
    this.life -= dt;
    if (this.life <= 0 || this.x < -50 || this.x > this.world.width + 50 || this.y > H + 100) {
      this.dead = true;
    }
    if (!this.dead && aabb(this.box(), this.world.player.box())) {
      this.world.player.takeDamage(1, this.world);
      this.dead = true;
    }
  }
  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    if (this.type === 'book') {
      ctx.fillStyle = '#9a4e1a';
      ctx.beginPath();
      ctx.roundRect(this.x, this.y, this.w, this.h, 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x + 2, this.y + 3, this.w - 4, 1.5);
    } else if (this.type === 'spore') {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---- Снаряды игрока ----
class PlayerBullet {
  constructor(x, y, vx, vy, world) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.w = 9; this.h = 9;
    this.dead = false;
    this.world = world;
    this.life = 2.5;
    this.rot = 0;
  }
  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt) {
    this.x += this.vx;
    this.y += this.vy;
    this.rot += dt * 18;
    this.life -= dt;
    if (this.life <= 0 || this.x < -50 || this.x > this.world.width + 50) this.dead = true;
    for (const e of this.world.enemies) {
      if (!e.dead && aabb(this.box(), e.box())) {
        e.takeDamage(1, this.world);
        this.dead = true;
        return;
      }
    }
    for (const b of this.world.bosses) {
      if (!b.dead && aabb(this.box(), b.box())) {
        b.takeDamage(1, this.world);
        this.dead = true;
        return;
      }
    }
  }
  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x + 4.5, this.y + 4.5);
    ctx.rotate(this.rot);
    ctx.fillStyle = '#ff9bb0';
    ctx.beginPath();
    ctx.roundRect(-4.5, -3.5, 9, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#be185d';
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---- Ключ на летающем острове ----
class KeyPickup {
  constructor(x, y, world) {
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 14;
    this.world = world;
    this.collected = false;
    this.t = rand(0, 6);
  }
  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt) {
    if (this.collected) return;
    this.t += dt;
    if (aabb(this.box(), this.world.player.box())) {
      this.collected = true;
      this.world.onKeyCollected(this);
    }
  }
  draw(ctx) {
    if (this.collected) return;
    const bob = Math.sin(this.t * 4.5) * 3;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2 + bob;

    ctx.save();
    ctx.shadowColor = 'rgba(255, 221, 87, 0.85)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd43b';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(cx - 3, cy, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillRect(cx + 1, cy - 1.5, 6.5, 3);
    ctx.fillRect(cx + 5, cy + 1.5, 2, 2.5);
    ctx.restore();
  }
}

// ---- Портал на следующий уровень ----
class Portal {
  constructor(x, y, world) {
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 44;
    this.world = world;
    this.t = 0;
  }
  get open() {
    return this.world.keysCollected >= this.world.keysTotal;
  }
  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt) {
    this.t += dt * 3.5;
    if (this.open && this.world.gameState === 'playing' && aabb(this.box(), this.world.player.box())) {
      this.world.onPortalEnter();
    }
  }
  draw(ctx) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    ctx.save();
    if (this.open) {
      const grad = ctx.createRadialGradient(cx, cy, 3, cx, cy, 24);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, '#38bdf8');
      grad.addColorStop(0.85, '#818cf8');
      grad.addColorStop(1, 'rgba(129, 140, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 15 + Math.sin(this.t) * 2, 22 + Math.cos(this.t) * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(200, 210, 255, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 13, 20, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔒', cx, this.y - 4);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
}

// ---- Аптечка ----
class Pickup {
  constructor(x, y, type, world) {
    this.x = x; this.y = y;
    this.w = 13; this.h = 13;
    this.type = type;
    this.world = world;
    this.vy = -3;
    this.dead = false;
    this.t = 0;
    this.onGround = false;
  }
  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt) {
    if (this.dead) return;
    this.t += dt;
    if (!this.onGround) {
      this.vy += GRAVITY;
      this.y += this.vy;
      for (const p of this.world.platforms) {
        if (this.x + this.w > p.x && this.x < p.x + p.w &&
            this.y + this.h >= p.y && this.y + this.h <= p.y + 10 && this.vy > 0) {
          this.y = p.y - this.h;
          this.vy = 0;
          this.onGround = true;
        }
      }
      if (!isOverPit(this.x, this.w, this.world.pits) && this.y + this.h >= GROUND_Y) {
        this.y = GROUND_Y - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    }
    if (aabb(this.box(), this.world.player.box())) {
      this.world.player.heal(2);
      audio.sfxPickup();
      this.dead = true;
    }
    if (this.t > 35 || this.y > H + 80) this.dead = true;
  }
  draw(ctx) {
    if (this.dead) return;
    const bob = Math.sin(this.t * 4) * 2;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(this.x, this.y + bob, this.w, this.h, 3);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(this.x + this.w / 2 - 1.5, this.y + 3 + bob, 3, 7);
    ctx.fillRect(this.x + 3, this.y + this.h / 2 - 1.5 + bob, 7, 3);
    ctx.restore();
  }
}

// ---- Ловушки (включая мины и провалы) ----
class Trap {
  constructor(type, x, y, w, h, opts = {}) {
    Object.assign(this, { type, x, y, w, h });
    this.opts = opts;
    this.timer = 0;
    this.animT = 0;
    this.triggered = false;
  }
  update(dt, world) {
    this.animT += dt;
    if (this.type === 'fan') {
      if (Math.abs(world.player.x + world.player.w / 2 - (this.x + this.w / 2)) < this.w * 1.4) {
        world.player.x += (this.opts.dir || 1) * 0.65;
        world.player.x = clamp(world.player.x, 0, world.width - world.player.w);
      }
    }
    if (this.type === 'socket') {
      this.timer -= dt;
      if (this.timer <= 0) this.timer = rand(1.5, 3);
    }
    if (this.type === 'falling_book') {
      this.timer += dt;
      if (this.timer > (this.opts.interval || 2) && this.y < -20) {
        this.y = 0;
        this.timer = 0;
      }
      if (this.y > -20) {
        this.y += 5;
        if (this.y > GROUND_Y) this.y = -30;
      }
    }
    if (this.type === 'beaker') this.timer += dt;
  }
  onPlayerCollide(world) {
    const p = world.player;
    if (!aabb(this.box(), p.box())) return;
    if (this.type === 'mine' && !this.triggered) {
      this.triggered = true;
      p.instantKill(world);
      return;
    }
    if (this.type === 'pit_trap') {
      p.instantKill(world);
      return;
    }
    if (this.type === 'papers' && p.onGround && p.vx !== 0 && !p._slipping) p._slipping = 0.4;
    if (this.type === 'falling_book' && this.y > 0) {
      p.takeDamage(1, world);
      this.y = -30;
    }
    if (this.type === 'socket' && this.timer < 0.2) p.takeDamage(1, world);
  }
  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  draw(ctx) {
    if (this.triggered && this.type === 'mine') return;
    const { x, y, w, h } = this;
    ctx.save();
    switch (this.type) {
      case 'mine': {
        const cx = x + w / 2, cy = y + h / 2;
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(cx, cy + 2, w * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = Math.sin(this.animT * 10) > 0 ? '#ef4444' : '#991b1b';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'pit_trap': {
        ctx.fillStyle = '#07070c';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#dc2626';
        for (let sx = x + 3; sx < x + w - 4; sx += 8) {
          ctx.beginPath();
          ctx.moveTo(sx, y + 6);
          ctx.lineTo(sx + 3.5, y);
          ctx.lineTo(sx + 7, y + 6);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'coffee':
        ctx.fillStyle = '#4a2a15';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 2);
        ctx.fill();
        break;
      case 'papers':
        ctx.fillStyle = '#f5f5dc';
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.translate(x + i * 8, y);
          ctx.rotate((i - 1) * 0.2);
          ctx.fillRect(0, 0, 10, 12);
          ctx.restore();
        }
        break;
      case 'falling_book':
        if (this.y > -20) {
          ctx.fillStyle = '#991b1b';
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 2);
          ctx.fill();
        }
        break;
      case 'fan': {
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        const ang = this.animT * 14;
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(ang + i * Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -h / 2 + 3);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'socket':
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 2);
        ctx.fill();
        ctx.fillStyle = this.timer < 0.2 ? '#facc15' : '#6b7280';
        ctx.fillRect(x + 3, y + 3, 2.5, 2.5);
        ctx.fillRect(x + w - 5.5, y + 3, 2.5, 2.5);
        break;
      case 'beaker':
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 3);
        ctx.fill();
        break;
      case 'ball':
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }
}

// ---- Боссы и мини-боссы (с механикой ключей по стадиям) ----
class Boss extends Entity {
  constructor(x, y, world, opts = {}) {
    const isMini = !!opts.mini;
    super(x, y, isMini ? 32 : 42, isMini ? 34 : 44);
    this.world = world;
    this.spawnX = x;
    this.spawnY = y;
    this.title = opts.title || 'ХРИСТИЧ';
    this.isMini = isMini;
    this.color = opts.color || '#a02020';
    this.hp = opts.hp || (isMini ? 24 : 65);
    this.maxHp = this.hp;
    this.stage = 1;
    this.maxStages = opts.stages || 3;
    this.attackCd = 2;
    this.jumpCd = 3;
    this.summonCd = 5;
    this.screamCd = 6;
    this.boomerang = null;
  }
  getStageCapHp() {
    const stageSpan = this.maxHp / this.maxStages;
    const minAllowedHp = this.maxHp - stageSpan * this.stage;
    if (this.stage < this.maxStages && !this.world.stageKeysReady(this.stage)) {
      return Math.max(1, Math.ceil(minAllowedHp));
    }
    return 0;
  }
  update(dt, world) {
    if (this.flash > 0) this.flash -= dt;
    if (this.dead) return;

    const hpPct = this.hp / this.maxHp;
    if (hpPct <= 0.34) this.stage = Math.max(this.stage, 3);
    else if (hpPct <= 0.67) this.stage = Math.max(this.stage, 2);

    const speedMod = 1 + (this.stage - 1) * 0.35;
    const p = world.player;
    const dx = p.x - this.x;
    this.facing = dx >= 0 ? 1 : -1;
    this.animT += dt;

    this.attackCd -= dt * speedMod;
    this.jumpCd -= dt * speedMod;
    this.summonCd -= dt;
    this.screamCd -= dt;

    this.vx = Math.sign(dx) * (this.isMini ? 0.85 : 0.6) * speedMod;
    this.x = clamp(this.x + this.vx, 0, world.width - this.w);

    if (this.attackCd <= 0 && Math.abs(dx) < 250) {
      this.throwBoomerang(world);
      this.attackCd = 2.8 / speedMod;
    }
    if (this.jumpCd <= 0 && this.onGround) {
      this.vy = -10.5;
      this.vx = Math.sign(dx) * 2.4;
      this.jumpCd = 3.8 / speedMod;
    }
    if (this.summonCd <= 0 && this.stage >= 2) {
      this.summonMinions(world);
      this.summonCd = 8.5 / speedMod;
    }
    if (this.screamCd <= 0 && this.stage >= 2 && !this.isMini) {
      if (Math.abs(dx) < 140) p.takeDamage(1, world);
      this.screamCd = 7 / speedMod;
      world.shake = 11;
      world.screamEffect = 0.45;
      audio.sfxBoss();
    }
    if (Math.abs(dx) < this.w + 6 && Math.abs(p.y - this.y) < 48 && this.attackCd < 1.1) {
      p.takeDamage(1, world);
      this.attackCd = 1.3;
    }

    this.gravity(world.platforms, world.pits, false, world);
    this.x = clamp(this.x, 0, world.width - this.w);

    if (this.boomerang && !this.boomerang.dead) this.boomerang.update(dt);
    else this.boomerang = null;
  }
  throwBoomerang(world) {
    if (this.boomerang) return;
    this.boomerang = new Boomerang(
      this.x + this.w / 2, this.y + 10, this.facing * 4.4, world, this
    );
  }
  summonMinions(world) {
    const types = ['freshman', 'flyer', 'worm'];
    for (let i = 0; i < 2; i++) {
      const ex = clamp(this.x + rand(-90, 90), 40, world.width - 50);
      const t = types[randi(0, types.length - 1)];
      world.enemies.push(new Enemy(ex, GROUND_Y - 24, t, world));
    }
    audio.sfxBoss();
  }
  takeDamage(n, world) {
    if (this.dead) return;
    const floorHp = this.getStageCapHp();
    this.hp = Math.max(floorHp, this.hp - n);
    this.flash = 0.15;
    world.player.points += 8;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      world.onBossDefeated(this);
    }
  }
  draw(ctx) {
    if (this.dead) return;
    const px = this.x, py = this.y;
    const col = this.flash > 0 ? '#ffffff' : this.color;
    const lockedByKey = this.hp <= this.getStageCapHp() && this.stage < this.maxStages;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(px + this.w / 2, py + this.h + 2, this.w * 0.52, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(px, py + 8, this.w, this.h - 8, 8);
    ctx.roundRect(px + 4, py, this.w - 8, 24, 8);
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(px + this.w * 0.32, py + 10, 4, 0, Math.PI * 2);
    ctx.arc(px + this.w * 0.68, py + 10, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(px + this.w * 0.32 + this.facing * 1.2, py + 10, 1.8, 0, Math.PI * 2);
    ctx.arc(px + this.w * 0.68 + this.facing * 1.2, py + 10, 1.8, 0, Math.PI * 2);
    ctx.fill();

    if (lockedByKey) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(px - 3, py - 3, this.w + 6, this.h + 6, 10);
      ctx.stroke();
    }

    const barW = 160;
    const bx = W / 2 - barW / 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(bx, 20, barW, 10, 4);
    ctx.fill();
    ctx.fillStyle = lockedByKey ? '#38bdf8' : '#ef4444';
    ctx.beginPath();
    ctx.roundRect(bx + 1, 21, (barW - 2) * (this.hp / this.maxHp), 8, 3);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    const suffix = lockedByKey ? ' · НУЖЕН КЛЮЧ СТАДИИ' : ` · СТАДИЯ ${this.stage}`;
    ctx.fillText(`${this.title}${suffix} (${this.hp}/${this.maxHp})`, W / 2, 15);
    ctx.textAlign = 'left';

    if (this.boomerang) this.boomerang.draw(ctx);
    ctx.restore();
  }
}

class Boomerang {
  constructor(x, y, vx, world, owner) {
    this.x = x; this.y = y; this.vx = vx; this.vy = -2;
    this.world = world; this.owner = owner;
    this.w = 14; this.h = 14;
    this.t = 0; this.dead = false; this.returning = false; this.rot = 0;
  }
  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt) {
    this.t += dt;
    this.rot += dt * 15;
    if (!this.returning) {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.1;
      if (this.t > 1.2 || this.x < 0 || this.x > this.world.width - this.w) this.returning = true;
    } else {
      const dx = this.owner.x + this.owner.w / 2 - this.x;
      const dy = this.owner.y + this.owner.h / 2 - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) { this.dead = true; return; }
      this.x += (dx / d) * 5;
      this.y += (dy / d) * 5;
    }
    if (aabb(this.box(), this.world.player.box())) {
      this.world.player.takeDamage(1, this.world);
    }
  }
  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x + 7, this.y + 7);
    ctx.rotate(this.rot);
    ctx.fillStyle = '#ffdd57';
    ctx.beginPath();
    ctx.roundRect(-7, -2.5, 14, 5, 2);
    ctx.roundRect(-2.5, -7, 5, 14, 2);
    ctx.fill();
    ctx.restore();
  }
}

// =================== ГЕНЕРАТОР 20 УРОВНЕЙ ===================
const LEVEL_TITLES = [
  'Аудитория первокурсников',
  'Коридор с шкафчиками',
  'Столовая',
  'Библиотека',
  'Этаж 5 — Двойняшки Соловушки',
  'Компьютерный класс',
  'Химлаборатория',
  'Крыша универа',
  'Подвал / Серверная',
  'Тёмный читальный зал',
  'Забытая кафедра',
  'Коридор теней',
  'Лаборатория мутаций',
  'Башня дедлайнов',
  'Этаж 15 — Ректор-Хронофаг',
  'Бездна пересдач',
  'Кровавый актовый зал',
  'Катакомбы вечной сессии',
  'Предел реальности',
  'Этаж 20 — КИРИЛЛ-ВЕБКОДЕР'
];

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpHex(hex1, hex2, t) {
  const c1 = parseInt(hex1.slice(1), 16);
  const c2 = parseInt(hex2.slice(1), 16);
  const r = Math.round(lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t));
  const g = Math.round(lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t));
  const b = Math.round(lerp(c1 & 255, c2 & 255, t));
  return `rgb(${r}, ${g}, ${b})`;
}

const LEVELS = Array.from({ length: 20 }, (_, idx) => {
  const lvlNum = idx + 1;
  const t = idx / 19;
  const width = Math.round((3600 + idx * 110) * (lvlNum === 20 ? 1.15 : 1));

  const skyTop = lerpHex('#6b8cff', '#1c0614', t);
  const skyBot = lerpHex('#b8d0ff', '#4a0818', t);
  const groundColor = lerpHex('#4b5563', '#19111a', t);
  const foliageColor = lerpHex('#34d399', '#581c2c', t);
  const trunkColor = lerpHex('#6b4423', '#2a1816', t);

  const platforms = [];
  const keyPositions = [];
  const islandCount = 9;
  for (let i = 0; i < islandCount; i++) {
    const px = 260 + i * Math.floor((width - 520) / islandCount);
    const py = i % 2 === 0 ? 166 : 126;
    const pw = 104;
    platforms.push({ x: px, y: py, w: pw, h: 11 });
  }
  const keyIslandIndices = [1, 4, 7];
  keyIslandIndices.forEach((kIdx, kOrder) => {
    const isl = platforms[kIdx];
    platforms.push({
      x: isl.x - 55,
      y: isl.y + 22,
      w: 52,
      h: 9
    });
    keyPositions.push({
      x: isl.x + isl.w / 2 - 7,
      y: isl.y - 22,
      stageReq: kOrder + 1
    });
  });

  const trees = [];
  for (let tx = 140; tx < width - 160; tx += 270) {
    trees.push({
      x: tx + ((idx * 37) % 50),
      scale: 0.8 + ((tx % 5) * 0.08)
    });
  }

  const pits = [];
  const traps = [];
  for (let gx = 520; gx < width - 480; gx += 520) {
    if (lvlNum >= 2 && pits.length < 4) {
      pits.push({ x: gx, w: 66 });
    }
    traps.push({
      type: 'mine',
      x: gx + 170,
      y: GROUND_Y - 10,
      w: 14,
      h: 10
    });
    if (lvlNum >= 3) {
      traps.push({
        type: 'pit_trap',
        x: gx + 310,
        y: GROUND_Y - 6,
        w: 36,
        h: 6
      });
    }
    if (lvlNum >= 4 && gx % 2 === 0) {
      traps.push({
        type: 'falling_book',
        x: gx + 90,
        y: -30,
        w: 14,
        h: 14,
        interval: Math.max(1.3, 2.2 - t * 0.7)
      });
    }
  }

  const enemies = {
    freshman: 4 + Math.floor(idx * 0.4),
    debtor: 2 + Math.floor(idx * 0.3),
    athlete: 2 + Math.floor(idx * 0.25),
    coder: 2 + Math.floor(idx * 0.25),
    flyer: 2 + Math.floor(idx * 0.35),
    worm: 2 + Math.floor(idx * 0.35)
  };

  const pickups = [
    { x: platforms[2].x + 30, y: platforms[2].y - 20 },
    { x: platforms[6].x + 30, y: platforms[6].y - 20 },
    { x: Math.floor(width * 0.75), y: GROUND_Y - 20 }
  ];

  const isSolovushkiLevel = lvlNum === 5;
  const isRectorLevel = lvlNum === 15;
  const isKirillLevel = lvlNum === 20;

  return {
    name: LEVEL_TITLES[idx],
    lvlNum,
    oominess: t,
    skyTop,
    skyBot,
    groundColor,
    foliageColor,
    trunkColor,
    width,
    platforms,
    trees,
    pits,
    keyPositions,
    portalX: width - 110,
    enemies,
    pickups,
    traps,
    isSolovushkiLevel,
    isRectorLevel,
    isKirillLevel,
    hasBoss: isSolovushkiLevel || isRectorLevel || isKirillLevel
  };
});

// =================== ИГРОВОЙ МИР ===================
class World {
  constructor(levelIndex) {
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.width = this.level.width;
    this.platforms = this.level.platforms || [];
    this.pits = this.level.pits || [];
    this.trees = this.level.trees || [];
    this.player = new Player(45, GROUND_Y - 26);
    this.player.hp = this.player.maxHp;
    this.enemies = [];
    this.projectiles = [];
    this.playerProjectiles = [];
    this.beams = [];
    this.pickups = [];
    this.keysList = [];
    this.keysCollected = 0;
    this.keysTotal = 3;
    this.traps = [];
    this.bosses = [];
    this.miniBossesSpawned = false;
    this.portal = new Portal(this.level.portalX, GROUND_Y - 44, this);
    this.shake = 0;
    this.screamEffect = 0;
    this.killCount = 0;
    this.time = 0;
    this.cameraX = 0;
    this.gameState = 'playing';

    updateUltHud(this.player.ultCharges);
    this.updateKeysHud();
    this.spawnKeys();
    this.spawnTraps();
    this.spawnEnemies();
    this.spawnPickups();

    if (this.level.isRectorLevel) {
      this.spawnBoss({ title: 'РЕКТОР-ХРОНОФАГ', hp: 55, stages: 3, color: '#7e22ce', mini: true });
    } else if (this.level.isKirillLevel) {
      this.spawnBoss({ title: 'КИРИЛЛ-ВЕБКОДЕР', hp: 85, stages: 3, color: '#dc2626', mini: false });
    }
  }
  updateKeysHud() {
    if (keysLabel) {
      keysLabel.textContent = `🔑 ${this.keysCollected}/${this.keysTotal}`;
    }
  }
  stageKeysReady(stage) {
    return this.keysCollected >= stage;
  }
  onKeyCollected() {
    this.keysCollected++;
    this.player.points += 50;
    scoreLabel.textContent = 'Счёт: ' + this.player.points;
    this.updateKeysHud();
    audio.sfxPickup();
  }
  spawnKeys() {
    (this.level.keyPositions || []).forEach(kp => {
      this.keysList.push(new KeyPickup(kp.x, kp.y, this));
    });
  }
  spawnTraps() {
    (this.level.traps || []).forEach(t => {
      this.traps.push(new Trap(t.type, t.x, t.y, t.w, t.h, {
        dir: t.dir, interval: t.interval
      }));
    });
  }
  spawnPickups() {
    (this.level.pickups || []).forEach(p => {
      this.pickups.push(new Pickup(p.x, p.y, 'health', this));
    });
  }
  spawnEnemies() {
    if (!this.level.enemies) return;
    Object.keys(this.level.enemies).forEach(type => {
      const count = this.level.enemies[type];
      for (let i = 0; i < count; i++) {
        let ex;
        let tries = 0;
        do {
          ex = 260 + Math.random() * (this.width - 520);
          tries++;
        } while (tries < 20 && (
          this.enemies.some(e => Math.abs(e.x - ex) < 42) ||
          isOverPit(ex, 24, this.pits)
        ));
        const startY = type === 'flyer' ? 95 : GROUND_Y - 24;
        this.enemies.push(new Enemy(ex, startY, type, this));
      }
    });
  }
  spawnBoss(opts) {
    const bx = this.width - 240;
    this.bosses.push(new Boss(bx, GROUND_Y - 44, this, opts));
    audio.sfxBoss();
  }
  spawnSolovushkiPair() {
    if (this.miniBossesSpawned) return;
    this.miniBossesSpawned = true;
    const baseX = clamp(this.player.x + 140, 200, this.width - 140);
    this.bosses.push(new Boss(baseX, GROUND_Y - 34, this, {
      title: 'СОЛОВУШКА #1',
      hp: 26,
      stages: 3,
      color: '#e11d48',
      mini: true
    }));
    this.bosses.push(new Boss(clamp(baseX + 85, 220, this.width - 90), GROUND_Y - 34, this, {
      title: 'СОЛОВУШКА #2',
      hp: 26,
      stages: 3,
      color: '#e11d48',
      mini: true
    }));
    audio.sfxBoss();
  }
  onPlayerDeath(reason = 'hp') {
    if (this.gameState !== 'playing') return;
    this.gameState = 'dead';
    audio.stopMusic();
    const score = this.player.points;
    if (score > SAVE.bestScore) { SAVE.bestScore = score; writeSave(SAVE); }
    const subtitle = reason === 'fatal_trap'
      ? 'Смертельная ловушка не оставила шансов!'
      : '"Даже свинья не сдаёт сессию с первого раза"';
    setTimeout(() => showOverlay(
      '💀 Бычок пал',
      `Оценка: ${score}\nРекорд: ${SAVE.bestScore}\n\n${subtitle}`,
      'Заново',
      () => restartLevel()
    ), 700);
  }
  onBossDefeated(boss) {
    if (!this.bosses.every(b => b.dead)) return;
    if (this.level.isKirillLevel) {
      if (this.gameState !== 'playing') return;
      this.gameState = 'won';
      audio.stopMusic();
      SAVE.unlocked = 20;
      const score = this.player.points + 1000;
      if (score > SAVE.bestScore) SAVE.bestScore = score;
      writeSave(SAVE);
      setTimeout(() => showFinalScreen(), 900);
      return;
    }
    this.player.points += 250;
    scoreLabel.textContent = 'Счёт: ' + this.player.points;
    audio.sfxPickup();
  }
  onPortalEnter() {
    if (this.gameState !== 'playing') return;
    if (!this.portal.open) return;
    this.gameState = 'won';
    audio.sfxPortal();
    SAVE.unlocked = 20;
    const score = this.player.points + 100;
    if (score > SAVE.bestScore) SAVE.bestScore = score;
    writeSave(SAVE);

    if (this.levelIndex + 1 >= LEVELS.length) {
      audio.stopMusic();
      setTimeout(() => showFinalScreen(), 500);
      return;
    }

    setTimeout(() => showOverlay(
      '🌀 Портал пройден!',
      `${this.level.name}\nКлючи собраны: ${this.keysCollected}/${this.keysTotal}\nСчёт: ${score}`,
      'Следующий уровень',
      () => startLevel(this.levelIndex + 1)
    ), 350);
  }
  update(dt) {
    if (this.gameState !== 'playing') return;
    this.time += dt;

    this.player.update(dt, this);
    if (this.gameState !== 'playing') return;

    for (const e of this.enemies) e.update(dt, this);
    for (const p of this.projectiles) p.update(dt);
    for (const p of this.playerProjectiles) p.update(dt);
    for (const bm of this.beams) bm.update(dt);
    for (const pk of this.pickups) pk.update(dt);
    for (const k of this.keysList) k.update(dt);
    for (const t of this.traps) {
      t.update(dt, this);
      t.onPlayerCollide(this);
      if (this.gameState !== 'playing') return;
    }
    for (const b of this.bosses) b.update(dt, this);
    this.portal.update(dt);

    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.playerProjectiles = this.playerProjectiles.filter(p => !p.dead);
    this.beams = this.beams.filter(b => !b.dead);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.pickups = this.pickups.filter(p => !p.dead);
    this.bosses = this.bosses.filter(b => !b.dead);

    if (this.level.isSolovushkiLevel && this.enemies.length === 0 && !this.miniBossesSpawned) {
      this.spawnSolovushkiPair();
    }

    if (this.shake > 0) this.shake *= 0.9;
    if (this.shake < 0.3) this.shake = 0;
    if (this.screamEffect > 0) this.screamEffect -= dt;

    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i], b = this.enemies[j];
        if (a.dead || b.dead) continue;
        if (Math.abs(a.x - b.x) < 15 && Math.abs(a.y - b.y) < 20) {
          a.x -= 0.5;
          b.x += 0.5;
        }
      }
    }

    const targetCam = clamp(this.player.x - W * 0.35, 0, Math.max(0, this.width - W));
    this.cameraX += (targetCam - this.cameraX) * 0.14;
  }
  drawTree(ctx, tree) {
    const x = tree.x;
    const s = tree.scale;
    const trunkW = 10 * s;
    const trunkH = 38 * s;
    ctx.save();
    ctx.fillStyle = this.level.trunkColor;
    ctx.beginPath();
    ctx.roundRect(x - trunkW / 2, GROUND_Y - trunkH, trunkW, trunkH, 3);
    ctx.fill();

    ctx.fillStyle = this.level.foliageColor;
    ctx.beginPath();
    ctx.arc(x, GROUND_Y - trunkH - 8 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(x - 11 * s, GROUND_Y - trunkH - 1 * s, 13 * s, 0, Math.PI * 2);
    ctx.arc(x + 11 * s, GROUND_Y - trunkH - 1 * s, 13 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  draw(ctx) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, this.level.skyTop);
    skyGrad.addColorStop(1, this.level.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    if (this.level.oominess > 0.35) {
      ctx.save();
      ctx.fillStyle = `rgba(180, 20, 45, ${(this.level.oominess - 0.35) * 0.22})`;
      ctx.beginPath();
      ctx.arc(W * 0.78, 55, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(-this.cameraX * 0.3, 0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    for (let x = 0; x < this.width; x += 110) {
      ctx.beginPath();
      ctx.roundRect(x, 42, 46, 120, 8);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-this.cameraX, 0);

    for (const tr of this.trees) {
      if (tr.x + 40 < this.cameraX || tr.x - 40 > this.cameraX + W) continue;
      this.drawTree(ctx, tr);
    }

    const sortedPits = [...this.pits].sort((a, b) => a.x - b.x);
    let cursorX = 0;
    ctx.fillStyle = this.level.groundColor;
    for (const pit of sortedPits) {
      if (pit.x > cursorX) {
        ctx.fillRect(cursorX, GROUND_Y, pit.x - cursorX, H - GROUND_Y);
      }
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(pit.x - 2, GROUND_Y, 2, H - GROUND_Y);
      ctx.fillRect(pit.x + pit.w, GROUND_Y, 2, H - GROUND_Y);
      ctx.fillStyle = this.level.groundColor;
      cursorX = pit.x + pit.w;
    }
    if (cursorX < this.width) {
      ctx.fillRect(cursorX, GROUND_Y, this.width - cursorX, H - GROUND_Y);
    }

    for (const p of this.platforms) {
      ctx.fillStyle = '#6b4a1a';
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 5);
      ctx.fill();
      ctx.fillStyle = this.level.foliageColor;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y - 2, p.w, 4, 3);
      ctx.fill();
    }

    this.portal.draw(ctx);
    for (const k of this.keysList) k.draw(ctx);
    for (const t of this.traps) t.draw(ctx);
    for (const pk of this.pickups) pk.draw(ctx);
    for (const pr of this.projectiles) pr.draw(ctx);
    for (const pb of this.playerProjectiles) pb.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    for (const b of this.bosses) b.draw(ctx);
    this.player.draw(ctx);
    for (const bm of this.beams) bm.draw(ctx);

    ctx.restore();

    if (this.screamEffect > 0) {
      ctx.fillStyle = `rgba(255, 255, 0, ${this.screamEffect * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.shake > 0) {
      const dx = (Math.random() - 0.5) * this.shake;
      const dy = (Math.random() - 0.5) * this.shake;
      ctx.translate(dx, dy);
    }

    const progW = 120;
    const progX = W - progW - 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(progX, 44, progW, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#ffdd57';
    const prog = clamp(this.player.x / Math.max(1, this.width - this.player.w), 0, 1);
    ctx.beginPath();
    ctx.roundRect(progX, 44, progW * prog, 6, 3);
    ctx.fill();
  }
}

// =================== ФИНАЛЬНЫЙ ЭКРАН ===================
function showFinalScreen() {
  if (document.getElementById('final-screen')) return;
  const el = document.createElement('div');
  el.id = 'final-screen';
  el.innerHTML = `
    <div class="final-frame">
      <h1>🏆 ПОЗДРАВЛЯЕМ С УДАЧНОЙ СДАЧЕЙ СЕССИИ! 🏆</h1>
      <div class="final-body">
        Бычок сдал сессию.<br>
        Кирилл-Вебкодер ушёл в академ.<br>
        Зомби-студенты, летуны и червяки разбежались по парам.<br><br>
        <b>Ты прошёл все 20 уровней!</b><br>
        Спасибо, что играл.
      </div>
      <button id="final-btn">В меню</button>
      <div class="final-signature">
        кирилл, ты свой нейрослоп больше не делай, я устал это всё тебе писать(((это маленьким текстом внизу)
      </div>
    </div>
  `;
  document.body.appendChild(el);
  document.getElementById('final-btn').onclick = () => {
    el.remove();
    goToMenu();
  };
}

// =================== УПРАВЛЕНИЕ ИГРОЙ ===================
let currentWorld = null;
let lastTime = 0;
let rafId = null;

function startLevel(idx) {
  if (idx < 0 || idx >= LEVELS.length) idx = 0;
  resetKeys();
  currentWorld = new World(idx);
  levelLabel.textContent = `Уровень ${idx + 1}/20: ${LEVELS[idx].name}`;
  hpInner.style.width = '100%';
  scoreLabel.textContent = 'Счёт: 0';
  hideOverlay();
  audio.init();
  audio.resume();
  if (SAVE.soundOn) audio.startMusic();
  if (!rafId) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  }
}

function restartLevel() {
  if (currentWorld) startLevel(currentWorld.levelIndex);
}

function goToMenu() {
  if (currentWorld) {
    currentWorld.gameState = 'paused';
    currentWorld = null;
  }
  audio.stopMusic();
  hpInner.style.width = '100%';
  updateUltHud(0);
  scoreLabel.textContent = 'Счёт: 0';
  if (keysLabel) keysLabel.textContent = '🔑 0/3';
  levelLabel.textContent = 'Меню';
  showMenu();
}

function togglePause() {
  if (!currentWorld) return;
  if (currentWorld.gameState === 'playing') {
    currentWorld.gameState = 'paused';
    audio.stopMusic();
    showOverlay(
      '⏸ Пауза',
      'Отдохни, Бычок.\nНе забудь собрать 3 ключа и зайти в портал!',
      'Продолжить',
      () => {
        if (!currentWorld) return;
        currentWorld.gameState = 'playing';
        hideOverlay();
        if (SAVE.soundOn) audio.startMusic();
      }
    );
  } else if (currentWorld.gameState === 'paused') {
    currentWorld.gameState = 'playing';
    hideOverlay();
    if (SAVE.soundOn) audio.startMusic();
  }
}
pauseBtn.addEventListener('click', togglePause);
soundBtn.addEventListener('click', () => audio.toggle());

// =================== ИГРОВОЙ ЦИКЛ ===================
function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (currentWorld) {
    if (currentWorld.gameState === 'playing') currentWorld.update(dt);
    ctx.save();
    currentWorld.draw(ctx);
    ctx.restore();
    hpInner.style.width = (currentWorld.player.hp / currentWorld.player.maxHp * 100) + '%';
  }
  rafId = requestAnimationFrame(gameLoop);
}

// =================== ОВЕРЛЕИ / МЕНЮ ===================
function showOverlay(title, text, btnText, cb) {
  ovTitle.textContent = title;
  ovText.textContent = text;
  ovBtn.textContent = btnText;
  ovBtn.style.display = '';
  overlay.classList.remove('hidden');
  ovBtn.onclick = () => {
    overlay.classList.add('hidden');
    if (cb) cb();
  };
}
function hideOverlay() { overlay.classList.add('hidden'); }

function showMenu() {
  ovTitle.textContent = '🐷 Бычок против Зомби-Универа (20 уровней)';

  ovText.innerHTML =
    `Собери <b>3 ключа</b> на паркур-островах и войди в <b>портал</b>.<br>` +
    `Каждая <b>10-я атака</b> заряжает ульту — луч на клавишу <b>Н</b>.<br><br>` +
    `Рекорд: <b>${SAVE.bestScore}</b>` +
    `<div id="level-select" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:14px 0;text-align:left;font-size:11px;"></div>` +
    `<div style="font-size:11px;line-height:1.55;color:#cbd5e1;">` +
    `WASD/стрелки — ходьба · Пробел/W — прыжок<br>` +
    `J/↓ — удар · K/L — стрельба · Н (H) — ульта-луч` +
    `</div>`;

  ovBtn.style.display = 'none';
  ovBtn.onclick = null;

  const ls = document.getElementById('level-select');
  LEVELS.forEach((lvl, i) => {
    const btn = document.createElement('button');
    btn.textContent = `▶ ${i + 1}. ${lvl.name}`;
    btn.disabled = false;
    btn.style.cssText = `
      font-family: inherit; font-size: 11px; padding: 6px 8px;
      border: 1.5px solid #ffdd57;
      background: rgba(42, 42, 82, 0.9);
      color: #fff;
      border-radius: 8px; cursor: pointer;
      text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    `;
    btn.onclick = () => {
      overlay.classList.add('hidden');
      startLevel(i);
    };
    ls.appendChild(btn);
  });

  overlay.classList.remove('hidden');
}

// =================== СТАРТ ===================
window.addEventListener('load', () => {
  showMenu();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW err', err));
  }
});

document.addEventListener('pointerdown', () => {
  audio.init();
  audio.resume();
}, { once: true });