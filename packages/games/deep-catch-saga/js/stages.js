// stages.js — the three-stage fishing loop state machine:
//   1) cast   : swing needle, stop in center zone = far cast → depth cap
//   2) sink   : steer hook left/right, avoid rocks (line snaps back) and
//               jellyfish (stun 0.8s), deeper = rarer bite pool, may reel up early
//   3) reel   : tension QTE — hold to reel when the fish is calm, release while
//               it struggles; tension burst x3 = line snap. Legendary fish use a
//               fast-slow alternating rhythm.
// Pure mechanics; economy/dex/report/UI stay in game.js via env hooks.

import { DEPTH_TIERS, TEMPO, QUALITIES, pickFish, fishOf, weightFor } from './fish.js';

export const PX_M = 6;                 // px per meter
export const SURFACE_Y = 260;          // world px of the sea surface line
export const W = 540, H = 960;
export const WORLD_H = SURFACE_Y + 360 * PX_M + 90;
export const FLY_T = 0.5;

export function layerOf(depthM) {
  for (let i = 0; i < DEPTH_TIERS.length; i++) if (depthM < DEPTH_TIERS[i]) return i;
  return 5;
}
export function castPowerAt(pos) {
  return Math.max(0, Math.min(1, 1 - Math.abs(pos - 50) / 50));
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (x1, y1, x2, y2) => (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);

export function makeStages(env) {
  // env: { rng, noAuto():bool, upgrades():[sink,tol,rarity,magnet], audio,
  //        fx:{burst,float,shake,stop,splash,ring}, hooks:{onCatch,onSnap,onRock,onJelly} }
  const S = {
    stage: 'dock', t: 0,
    castPos: 50, castDir: 1, castPower: 0, cap: 15,
    flyT: 0, flyFromX: 288, flyFromY: SURFACE_Y - 64, entryX: 270,
    depth: 0, hookX: 270, hookVX: 0, stunT: 0, rising: false,
    biteT: 0,
    fish: null, weight: 0,
    phase: 'calm', phaseT: 0, phaseIdx: 0, tension: 0, bursts: 0, progress: 0,
    rocks: [], jellies: [],
    resultT: 0, retractT: 0, retractReason: '',
    caughtCount: 0, lostCount: 0,
    reelFxT: 0,
  };

  const sinkSpeed = () => 62 + 14 * (env.upgrades()[0] | 0);
  const tolFactor = () => 1 - 0.08 * (env.upgrades()[1] | 0);
  const rarityLvl = () => env.upgrades()[2] | 0;
  const magnetPow = () => 30 * (env.upgrades()[3] | 0);

  function generateDive() {
    S.rocks.length = 0; S.jellies.length = 0;
    const cap = S.cap, rng = env.rng;
    for (let d = 14; d < cap - 10; d += 20 + rng() * 24) {
      const n = 1 + (rng() < .45 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const r = 22 + rng() * 24;
        const verts = [];
        const nv = 8;
        for (let i = 0; i < nv; i++) {
          const a = (i / nv) * Math.PI * 2;
          verts.push([Math.cos(a) * r * (.72 + rng() * .42), Math.sin(a) * r * (.62 + rng() * .4)]);
        }
        S.rocks.push({ x: 76 + rng() * 388, yM: d + rng() * 16, r, verts });
      }
    }
    for (let d = 18; d < cap - 8; d += 26 + rng() * 30) {
      S.jellies.push({ x: 80 + rng() * 380, yM: d + rng() * 18, r: 13 + rng() * 11, ph: rng() * 6.283, cool: 0 });
    }
  }

  function toCast() {
    S.stage = 'cast';
    S.castPos = env.rng() * 100;
    S.castDir = env.rng() < .5 ? 1 : -1;
    S.depth = 0; S.hookX = 270; S.hookVX = 0; S.stunT = 0; S.rising = false;
    S.fish = null; S.bursts = 0; S.tension = 0; S.progress = 0;
  }

  function startCast(power) {
    if (power != null) S.castPower = clamp(power, 0, 1);
    else S.castPower = castPowerAt(S.castPos);
    S.cap = Math.round(15 + S.castPower * 345);
    S.entryX = 90 + S.castPower * 360;
    S.flyFromX = 288; S.flyFromY = SURFACE_Y - 64;
    S.flyT = FLY_T;
    S.stage = 'fly';
    S.fish = null; S.bursts = 0; S.tension = 0; S.progress = 0;
    env.audio.sfx.cast();
  }

  function doBite(forceQ) {
    const layer = layerOf(S.depth);
    const f = forceQ != null
      ? fishOf(layer, clamp(forceQ | 0, 0, 6))
      : pickFish(layer, rarityLvl(), env.rng);
    S.fish = f; S.weight = 0;
    S.phase = 'calm'; S.phaseT = 0; S.phaseIdx = 0;
    S.tension = 26; S.bursts = 0; S.progress = 0;
    S.stage = 'reel';
    env.audio.sfx.bite();
  }

  function phaseDur() {
    const tp = TEMPO[S.fish ? S.fish.q : 0];
    if (S.phase === 'struggle') {
      // legendary fish (q6): fast-slow alternating struggle rhythm
      if (S.fish && S.fish.q === 6) return S.phaseIdx % 2 === 0 ? .42 : .78;
      return tp.s;
    }
    return tp.c;
  }

  function endResult() {
    S.stage = 'cast';
    S.castPos = env.rng() * 100;
    S.fish = null;
    S.depth = 0; S.hookX = 270;
  }

  function update(dt, inp) {
    S.t += dt;
    switch (S.stage) {
      case 'dock':
        S.hookX = 270 + Math.sin(S.t * .8) * 6;
        break;

      case 'cast': {
        S.castPos += S.castDir * 92 * dt;
        if (S.castPos >= 100) { S.castPos = 100; S.castDir = -1; }
        if (S.castPos <= 0) { S.castPos = 0; S.castDir = 1; }
        break;
      }

      case 'fly': {
        S.flyT -= dt;
        const k = 1 - Math.max(0, S.flyT) / FLY_T;
        S.hookX = S.flyFromX + (S.entryX - S.flyFromX) * k;
        const arc = Math.sin(Math.min(1, k) * Math.PI);
        S.depth = Math.max(0, (k - .6) / .4) * 4;
        S._flyArc = arc;
        if (S.flyT <= 0) {
          S.stage = 'sink'; S.depth = 0; S.hookX = S.entryX; S.hookVX = 0;
          S.biteT = 3 + env.rng() * 4.5;
          generateDive();
          env.audio.sfx.splash();
          env.fx.splash(S.hookX, SURFACE_Y);
        }
        break;
      }

      case 'sink': {
        if (S.stunT > 0) S.stunT -= dt;
        const spd = sinkSpeed() * (S.stunT > 0 ? .45 : 1);
        S.rising = !!inp.rise && S.depth > 0.01 && S.stunT <= 0;
        if (S.rising) {
          S.depth -= spd * 1.7 * dt;
          if (S.depth <= 0) { S.depth = 0; toCast(); break; }
        } else if (S.depth < S.cap) {
          S.depth = Math.min(S.cap, S.depth + spd * dt);
        }
        // horizontal steering
        const mv = S.stunT > 0 ? 0 : clamp(inp.move | 0, -1, 1);
        S.hookVX = mv * 130;
        // magnet upgrade: gentle auto-dodge away from nearby obstacles
        if (magnetPow() > 0 && S.stunT <= 0) {
          const hy = SURFACE_Y + S.depth * PX_M;
          let push = 0;
          for (const r of S.rocks) {
            const ry = SURFACE_Y + r.yM * PX_M;
            if (dist2(S.hookX, hy, r.x, ry) < 80 * 80) push += (S.hookX < r.x ? -1 : 1) * magnetPow();
          }
          for (const j of S.jellies) {
            const jy = SURFACE_Y + (j.yM + jellyDrift(j)) * PX_M;
            if (dist2(S.hookX, hy, j.x, jy) < 70 * 70) push += (S.hookX < j.x ? -1 : 1) * magnetPow();
          }
          push = clamp(push, -magnetPow() * 1.5, magnetPow() * 1.5);
          S.hookVX += push;
        }
        S.hookX = clamp(S.hookX + S.hookVX * dt, 60, 480);
        // collisions
        const hy = SURFACE_Y + S.depth * PX_M;
        for (const r of S.rocks) {
          const ry = SURFACE_Y + r.yM * PX_M;
          const rr = r.r + 9;
          if (dist2(S.hookX, hy, r.x, ry) < rr * rr) {
            env.audio.sfx.rock();
            env.fx.burst(S.hookX, hy, '#c8b890', 10, 120);
            env.fx.shake(.25, 4);
            env.hooks.onRock();
            S.stage = 'retract'; S.retractT = 1.0; S.retractReason = 'rock'; S.lostCount++;
            return;
          }
        }
        for (const j of S.jellies) {
          if (j.cool > 0) { j.cool -= dt; continue; }
          const jy = SURFACE_Y + (j.yM + jellyDrift(j)) * PX_M;
          const rr = j.r + 8;
          if (dist2(S.hookX, hy, j.x, jy) < rr * rr) {
            S.stunT = 0.8; j.cool = 1.4;
            env.audio.sfx.stun();
            env.fx.burst(j.x, jy, '#b48cff', 12, 100);
            env.hooks.onJelly();
          }
        }
        // bite countdown
        if (!S.rising && !env.noAuto()) {
          S.biteT -= dt;
          if (S.biteT <= 0) { doBite(); return; }
        }
        break;
      }

      case 'reel': {
        if (!S.fish) { toCast(); break; }
        const tp = TEMPO[S.fish.q];
        S.phaseT += dt;
        if (S.phaseT >= phaseDur()) {
          S.phaseT = 0; S.phaseIdx++;
          S.phase = S.phase === 'struggle' ? 'calm' : 'struggle';
          env.audio.sfx.strain();
        }
        const tol = tolFactor();
        if (inp.hold) {
          if (S.phase === 'struggle') S.tension += tp.rise * tol * dt;
          else { S.progress += tp.prog * dt; S.tension = Math.max(0, S.tension - 16 * dt); }
          S.reelFxT -= dt;
          if (S.reelFxT <= 0) {
            S.reelFxT = S.phase === 'struggle' ? .2 : .15;
            if (S.phase === 'struggle') env.audio.sfx.strain(); else env.audio.sfx.reelTick();
          }
        } else {
          if (S.phase === 'struggle') { S.tension = Math.max(0, S.tension - 24 * dt); S.progress += 2.5 * dt; }
          else S.tension = Math.max(0, S.tension - 20 * dt);
        }
        if (S.tension >= 100) {
          S.bursts++; S.tension = 38;
          env.fx.stop(.07); env.fx.shake(.3, 5);
          env.audio.sfx.burst();
          env.fx.burst(S.hookX, SURFACE_Y + S.depth * PX_M, '#ff5a4a', 14, 160);
          if (S.bursts >= 3) {
            S.stage = 'retract'; S.retractT = 1.0; S.retractReason = 'snap'; S.lostCount++;
            env.hooks.onSnap(S.fish);
            return;
          }
        }
        if (S.progress >= 100) {
          S.progress = 100;
          S.weight = weightFor(S.fish, env.rng);
          S.caughtCount++;
          S.stage = 'result'; S.resultT = 2.6;
          env.hooks.onCatch(S.fish, S.weight);
          return;
        }
        break;
      }

      case 'result': {
        S.resultT -= dt;
        if (S.resultT <= 0) endResult();
        break;
      }

      case 'retract': {
        S.retractT -= dt;
        S.depth = Math.max(0, S.depth - 300 * dt);
        if (S.retractT <= 0) toCast();
        break;
      }
    }
  }

  function jellyDrift(j) { return Math.sin(S.t * .6 + j.ph) * 2.2; }

  // test/debug helpers (exposed on G via game.js)
  function setDepthStage(n) {
    const i = clamp(n | 0, 0, 5);
    const b0 = i === 0 ? 0 : DEPTH_TIERS[i - 1];
    const b1 = DEPTH_TIERS[i];
    S.stage = 'sink';
    S.depth = (b0 + b1) / 2;
    S.cap = Math.max(S.cap, b1);
    S.hookX = 270; S.hookVX = 0; S.stunT = 0; S.rising = false;
    S.biteT = 3.5 + env.rng() * 2;
    S.fish = null; S.tension = 0; S.progress = 0; S.bursts = 0;
    generateDive();
  }
  function setPhase(p) {
    S.phase = p === 'struggle' ? 'struggle' : 'calm';
    S.phaseT = 0;
  }
  function abortReel() {
    S.fish = null;
    toCast();
  }

  // ==================== world rendering (called by game.js) ====================
  function renderWorld(ctx, camY) {
    const t = S.t;
    // rocks
    for (const r of S.rocks) {
      const y = SURFACE_Y + r.yM * PX_M;
      if (y < camY - 80 || y > camY + H + 80) continue;
      ctx.save();
      ctx.translate(r.x, y);
      ctx.fillStyle = '#2e3d4a';
      ctx.beginPath();
      ctx.moveTo(r.verts[0][0], r.verts[0][1]);
      for (let i = 1; i < r.verts.length; i++) ctx.lineTo(r.verts[i][0], r.verts[i][1]);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(90,140,110,.5)';
      ctx.beginPath();
      ctx.ellipse(-r.r * .2, -r.r * .55, r.r * .55, r.r * .22, -.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r.r * .4, -r.r * .1); ctx.lineTo(r.r * .1, r.r * .3); ctx.stroke();
      ctx.restore();
    }
    // jellyfish
    for (const j of S.jellies) {
      const y = SURFACE_Y + (j.yM + jellyDrift(j)) * PX_M;
      if (y < camY - 60 || y > camY + H + 60) continue;
      const pulse = 1 + Math.sin(t * 2.2 + j.ph) * .1;
      ctx.save();
      ctx.translate(j.x, y);
      ctx.shadowColor = 'rgba(180,140,255,.9)'; ctx.shadowBlur = 14;
      const gg = ctx.createRadialGradient(0, -j.r * .2, j.r * .1, 0, 0, j.r * pulse);
      gg.addColorStop(0, 'rgba(220,200,255,.85)');
      gg.addColorStop(.7, 'rgba(170,130,240,.55)');
      gg.addColorStop(1, 'rgba(140,100,220,.15)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(0, 0, j.r * pulse, Math.PI, 0);
      ctx.quadraticCurveTo(j.r * pulse, j.r * .3, 0, j.r * .34);
      ctx.quadraticCurveTo(-j.r * pulse, j.r * .3, -j.r * pulse, 0);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(190,160,255,.55)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        const x0 = -j.r * .6 + i * j.r * .4;
        ctx.beginPath();
        ctx.moveTo(x0, j.r * .3);
        ctx.quadraticCurveTo(x0 + Math.sin(t * 2 + i) * 5, j.r * .9, x0 + Math.sin(t * 1.6 + i * 1.7) * 7, j.r * 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }
    // line + hook (+ hooked fish)
    const hy = SURFACE_Y + S.depth * PX_M;
    const rodX = 292, rodY = SURFACE_Y - 58;
    if (S.stage !== 'dock' && S.stage !== 'cast') {
      const sag = Math.min(70, Math.abs(S.hookX - rodX) * .18 + 14);
      const midX = (rodX + S.hookX) / 2 + Math.sin(t * 2.1) * 4;
      const midY = (rodY + hy) / 2 + sag;
      ctx.strokeStyle = 'rgba(235,244,250,.75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(rodX, rodY);
      ctx.quadraticCurveTo(midX, midY, S.hookX, hy - 6);
      ctx.stroke();
      // hook
      ctx.strokeStyle = '#d8e4ee'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(S.hookX, hy - 8);
      ctx.lineTo(S.hookX, hy + 2);
      ctx.arc(S.hookX + 4, hy + 2, 4, Math.PI, 0, true);
      ctx.stroke();
      // bait
      ctx.fillStyle = '#ff8a6a';
      ctx.beginPath(); ctx.arc(S.hookX + 2, hy + 4, 3.2, 0, 7); ctx.fill();
      // glow halo when a legendary fish is hooked
      if (S.fish && S.fish.q >= 5) {
        ctx.save();
        ctx.shadowColor = S.fish.q === 6 ? '#ffd44e' : '#ff70a8';
        ctx.shadowBlur = 18;
        ctx.fillStyle = 'rgba(255,220,120,.85)';
        ctx.beginPath(); ctx.arc(S.hookX, hy, 4, 0, 7); ctx.fill();
        ctx.restore();
      }
    }
    // hooked fish struggling beside the hook
    if ((S.stage === 'reel' || S.stage === 'result') && S.fish) {
      const struggling = S.phase === 'struggle' && S.stage === 'reel';
      const wobble = struggling ? Math.sin(t * 18) * .38 : Math.sin(t * 3) * .12;
      const offX = struggling ? Math.sin(t * 9) * 26 : Math.sin(t * 2) * 8;
      const pull = Math.cos(t * 2) > 0 ? 1 : -1;
      const sc = Math.max(.55, Math.min(1.5, S.fish.len / 70));
      ctx.save();
      if (S.fish.q === 6) {
        ctx.shadowColor = '#ffd44e'; ctx.shadowBlur = 22;
      } else if (S.fish.q >= 4) {
        ctx.shadowColor = S.fish.hue2; ctx.shadowBlur = 14;
      }
      env.drawFish(ctx, S.fish, S.hookX + offX, hy + 26, sc, wobble, 1, pull < 0);
      ctx.restore();
      // tension guide: line color heats up near bursting
      if (S.stage === 'reel') {
        const heat = S.tension / 100;
        if (heat > .6) {
          ctx.strokeStyle = `rgba(255,${Math.round(200 - heat * 160)},80,${(heat - .6) * 2})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(rodX, rodY);
          ctx.quadraticCurveTo((rodX + S.hookX) / 2, (rodY + hy) / 2 + sag, S.hookX, hy - 6);
          ctx.stroke();
        }
      }
    }
  }

  // cast power bar (screen space)
  function renderCastBar(ctx) {
    if (S.stage !== 'cast') return;
    const bx = (W - 320) / 2, by = 96, bw = 320, bh = 24;
    ctx.save();
    ctx.fillStyle = 'rgba(28,18,8,.82)';
    ctx.strokeStyle = 'rgba(255,214,140,.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx - 8, by - 8, bw + 16, bh + 16, 10); else ctx.rect(bx - 8, by - 8, bw + 16, bh + 16);
    ctx.fill(); ctx.stroke();
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#7ea8c8'); g.addColorStop(.28, '#8fd0a8'); g.addColorStop(.44, '#ffd24a');
    g.addColorStop(.5, '#fff3b8'); g.addColorStop(.56, '#ffd24a');
    g.addColorStop(.72, '#8fd0a8'); g.addColorStop(1, '#7ea8c8');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 30, by, 1, bh); ctx.strokeRect(bx + bw - 30, by, 1, bh);
    // needle
    const nx = bx + (S.castPos / 100) * bw;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(nx, by - 5); ctx.lineTo(nx - 6, by - 14); ctx.lineTo(nx + 6, by - 14);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(nx - 2, by, 4, bh);
    ctx.font = '700 13px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9c8';
    ctx.fillText('停在中区 = 远投！预计可达 ' + S.cap + 'm', W / 2, by + bh + 22);
    ctx.restore();
  }

  // reel QTE bar (screen space): fish name + phase, tension bar, burst pips, reel progress
  function renderReelBar(ctx) {
    if (S.stage !== 'reel' || !S.fish) return;
    const bw = 320, bx = (W - bw) / 2, by = H - 150;
    const q = QUALITIES[S.fish.q];
    ctx.save();
    ctx.fillStyle = 'rgba(28,18,8,.85)';
    ctx.strokeStyle = 'rgba(255,214,140,.45)'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx - 10, by - 34, bw + 20, 106, 12); else ctx.rect(bx - 10, by - 34, bw + 20, 106);
    ctx.fill(); ctx.stroke();
    // fish label + phase
    ctx.font = '700 14px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = q.color;
    ctx.fillText(S.fish.name + ' · ' + q.name, bx, by - 12);
    ctx.font = '700 15px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'right';
    if (S.phase === 'struggle') {
      ctx.fillStyle = `rgba(255,90,74,${.7 + Math.sin(S.t * 14) * .3})`;
      ctx.fillText('挣扎！松手', bx + bw, by - 12);
    } else {
      ctx.fillStyle = `rgba(125,220,134,${.8 + Math.sin(S.t * 8) * .2})`;
      ctx.fillText('平稳·快收线', bx + bw, by - 12);
    }
    // tension bar
    const tn = clamp(S.tension / 100, 0, 1);
    ctx.fillStyle = 'rgba(10,14,20,.7)';
    ctx.fillRect(bx, by, bw, 16);
    const tg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    tg.addColorStop(0, '#7ddc86'); tg.addColorStop(.55, '#ffd24a'); tg.addColorStop(1, '#ff5a4a');
    ctx.fillStyle = tg;
    ctx.fillRect(bx, by, bw * tn, 16);
    if (tn > .7) {
      ctx.strokeStyle = `rgba(255,90,74,${.5 + Math.sin(S.t * 18) * .4})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 2, by - 2, bw + 4, 20);
    }
    ctx.font = '11px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(255,240,210,.9)';
    ctx.textAlign = 'left';
    ctx.fillText('张力', bx + 4, by + 12);
    // burst pips (right of tension bar)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(bx + bw - 12 - i * 18, by + 8, 6, 0, 7);
      ctx.fillStyle = i < S.bursts ? '#ff5a4a' : 'rgba(255,255,255,.22)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // progress bar
    const pg = clamp(S.progress / 100, 0, 1);
    ctx.fillStyle = 'rgba(10,14,20,.7)';
    ctx.fillRect(bx, by + 26, bw, 13);
    const pgd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    pgd.addColorStop(0, '#58b8f0'); pgd.addColorStop(1, '#ffd44e');
    ctx.fillStyle = pgd;
    ctx.fillRect(bx, by + 26, bw * pg, 13);
    ctx.fillStyle = 'rgba(255,240,210,.9)';
    ctx.fillText('收线', bx + 4, by + 37);
    ctx.textAlign = 'right';
    ctx.fillText(Math.floor(pg * 100) + '%', bx + bw - 4, by + 37);
    ctx.restore();
  }

  function snapshot() {
    return {
      stage: S.stage, castPos: +S.castPos.toFixed(1), castPower: +S.castPower.toFixed(3),
      cap: S.cap, depth: +S.depth.toFixed(2), layer: layerOf(S.depth),
      hookX: +S.hookX.toFixed(1), stunT: +S.stunT.toFixed(2), biteT: +S.biteT.toFixed(2),
      fishId: S.fish ? S.fish.id : null, fishQ: S.fish ? S.fish.q : -1,
      phase: S.phase, tension: +S.tension.toFixed(2), bursts: S.bursts,
      progress: +S.progress.toFixed(2), rocks: S.rocks.length, jellies: S.jellies.length,
      resultT: +S.resultT.toFixed(2), retractReason: S.retractReason,
      caughtCount: S.caughtCount, lostCount: S.lostCount,
      tempoSpecial: !!(S.fish && S.fish.q === 6),
    };
  }

  return {
    S, update, startCast, doBite, setDepthStage, setPhase, abortReel, endResult,
    generateDive, snapshot, renderWorld, renderCastBar, renderReelBar, layerOf, jellyDrift,
    sinkSpeed, tolFactor, rarityLvl, magnetPow,
  };
}
