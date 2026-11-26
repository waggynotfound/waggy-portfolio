/* One animation loop for the pointer ring and the cat. No timers while idle. */
(() => {
  'use strict';
  const cursor = document.querySelector('.cursor');
  if (!cursor) return;
  const dot = cursor.querySelector('.cursor-dot');
  const ring = cursor.querySelector('.cursor-ring');
  const cat = cursor.querySelector('.cursor-cat');
  const enabled = matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)');
  const delay = 120;
  const trail = [];
  // Clockwise octants in screen coordinates (positive Y points down).
  const octant = Math.PI / 4;
  const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'].map((name, i) => ({
    name, x: Math.cos(i * octant), y: Math.sin(i * octant)
  }));
  let active = false, frame = 0, previous = 0, lastMove = 0;
  let x, y, ringX, ringY, catX, catY, turnX, turnY, heading = 0, stride = 0;
  let width, height;

  function hide() {
    cancelAnimationFrame(frame);
    frame = 0;
    active = false;
    trail.length = 0;
    document.documentElement.classList.remove('has-cat-cursor');
    cursor.classList.remove('is-hot');
    cat.removeAttribute('data-paw');
  }

  function tick(now) {
    const dt = Math.min(48, Math.max(1, now - previous));
    previous = now;
    trail.push({ x, y, at: now });
    const then = now - delay;
    while (trail.length > 1 && trail[1].at <= then) trail.shift();
    const a = trail[0], b = trail[1] || a;
    const k = Math.max(0, Math.min(1, (then - a.at) / (b.at - a.at || 1)));
    const px = a.x + (b.x - a.x) * k, py = a.y + (b.y - a.y) * k;
    // Read the delayed trail, not the live pointer: the cat turns at the corner.
    // A small dead zone in distance and angle keeps the resting pose stable.
    const mx = px - turnX, my = py - turnY;
    if (Math.hypot(mx, my) >= 3) {
      const angle = Math.atan2(my, mx) / octant;
      const delta = (angle - heading + 12) % 8 - 4;
      if (Math.abs(delta) > .60) heading = (Math.round(angle) + 8) % 8;
      turnX = px; turnY = py;
    }
    const dir = directions[heading];
    if (cat.dataset.dir !== dir.name) cat.dataset.dir = dir.name;
    const tx = Math.max(2, Math.min(width - 50, px - 24 - dir.x * 39));
    const ty = Math.max(2, Math.min(height - 38, py - 18 - dir.y * 39 + Math.abs(dir.x) * 26));
    const follow = 1 - Math.exp(-dt / 52), glide = 1 - Math.exp(-dt / 84);
    const dx = tx - catX, dy = ty - catY;
    const walking = Math.hypot(dx, dy) > 1;
    if (walking) stride += Math.hypot(dx, dy) * follow;
    catX += dx * follow; catY += dy * follow;
    ringX += (x - ringX) * glide; ringY += (y - ringY) * glide;

    cat.dataset.paw = walking ? String(1 + (Math.floor(stride / 10) % 2)) : '0';
    cat.style.transform = `translate3d(${Math.round(catX)}px, ${Math.round(catY)}px, 0)`;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
    frame = now - lastMove < delay + 20 || walking || Math.hypot(x - ringX, y - ringY) > .2
      ? requestAnimationFrame(tick) : 0;
  }

  function move(e) {
    if (e.pointerType !== 'mouse' || !enabled.matches) { if (active) hide(); return; }
    x = e.clientX; y = e.clientY;
    lastMove = performance.now();
    if (!active) {
      width = innerWidth; height = innerHeight;
      ringX = turnX = x; ringY = turnY = y; heading = x < 64 ? 4 : 0; stride = 0;
      catX = Math.max(2, Math.min(width - 50, x - 24 - directions[heading].x * 39));
      catY = Math.max(2, Math.min(height - 38, y + 8));
      active = true;
      document.documentElement.classList.add('has-cat-cursor');
    }
    dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    cursor.classList.toggle('is-hot', !!e.target.closest?.('a, button, [data-cursor]'));
    if (!frame) {
      previous = lastMove - 16;
      // After a rest, keep the start of the trail at the last pointer position.
      if (trail.length) { const last = trail[trail.length - 1]; trail.length = 0; trail.push({ ...last, at: lastMove }); }
      tick(lastMove);
    }
  }

  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') hide(); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  enabled.addEventListener('change', () => { if (!enabled.matches) hide(); });
})();
