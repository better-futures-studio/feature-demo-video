(() => {
  /* Fingertip overlay for phone recordings (lib.mjs showFinger). agent-browser's --cursor arrow is drawn
     inside a locked custom element and can't be restyled, so phone segments draw this instead.
     Keep the comment inside the function: the file is evaluated as a single expression. */
  if (document.getElementById('demo-finger')) return true;
  const dot = document.createElement('div');
  dot.id = 'demo-finger';
  Object.assign(dot.style, { position: 'fixed', left: '0', top: '0', width: '44px', height: '44px', margin: '-22px 0 0 -22px', borderRadius: '50%',
    background: 'rgba(30, 41, 59, 0.22)', border: '2px solid rgba(255, 255, 255, 0.85)', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.25)',
    pointerEvents: 'none', zIndex: '2147483647', transform: 'translate(-100px, -100px) scale(1)', transition: 'transform 90ms ease-out, background 90ms' });
  document.documentElement.appendChild(dot);
  let x = -100, y = -100, pressed = false;
  const paint = () => { dot.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + (pressed ? 0.78 : 1) + ')'; dot.style.background = pressed ? 'rgba(30, 41, 59, 0.38)' : 'rgba(30, 41, 59, 0.22)'; };
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; paint(); }, true);
  addEventListener('pointerdown', (e) => { x = e.clientX; y = e.clientY; pressed = true; paint(); }, true);
  addEventListener('pointerup', () => { pressed = false; paint(); }, true);
  return true;
})()
