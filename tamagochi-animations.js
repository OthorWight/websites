/* Cosmetic idle performances. Their clock and random rolls never change pet care. */
(function (root) {
  'use strict';
  const NORMAL = ['wave', 'hop', 'dance', 'tumble', 'butterfly', 'yawn'];
  const RARE_CHANCE = 1 / 1000;
  const DEFINITIONS = {
    wave: { duration: 4200, caption: 'Hello, favorite human! ♡', mood: 'Waving hello' },
    hop: { duration: 4600, caption: 'Small feet. Big excitement!', mood: 'Happy little hops' },
    dance: { duration: 5600, caption: 'This song is only in my head. ♫', mood: 'Doing a little dance' },
    tumble: { duration: 4800, caption: 'Behold! My very impressive trick.', mood: 'Taking a tiny tumble' },
    butterfly: { duration: 6400, caption: 'Oh! A tiny visitor!', mood: 'Watching a butterfly' },
    yawn: { duration: 4800, caption: 'A biiig yawn for a little pal.', mood: 'A little stretch & yawn' },
    overlord: { duration: 7800, caption: 'Why is it suddenly so quiet…?', mood: 'A very normal little friend' }
  };
  function choose(random, previous, rareSeen) {
    if (!rareSeen && random() < RARE_CHANCE) return 'overlord';
    const choices = NORMAL.filter(id => id !== previous);
    return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  }
  function create({ random = Math.random } = {}) {
    let nextAt = null, active = null, previous = null, rareSeen = false, identity;
    const delay = () => 20000 + random() * 25000;
    function interrupt() { active = null; nextAt = null; }
    function tick(now, eligible, petIdentity) {
      if (identity !== petIdentity) { identity = petIdentity; previous = null; interrupt(); }
      if (!eligible) { interrupt(); return null; }
      if (nextAt === null && !active) nextAt = now + delay();
      if (active && now >= active.start + DEFINITIONS[active.id].duration) { active = null; nextAt = now + delay(); }
      if (!active && now >= nextAt) {
        const id = choose(random, previous, rareSeen);
        active = { id, start: now }; previous = id; if (id === 'overlord') rareSeen = true;
        nextAt = null;
      }
      return active ? frame(active.id, now - active.start) : null;
    }
    return { tick, interrupt };
  }
  function frame(id, elapsed) {
    const def = DEFINITIONS[id];
    if (!def || elapsed < 0 || elapsed >= def.duration) return null;
    const progress = elapsed / def.duration;
    let caption = def.caption, mood = def.mood;
    if (id === 'overlord') {
      if (progress >= .2 && progress < .72) { caption = 'YOUR SOUL SHALL BE MINE.'; mood = 'Practicing world domination'; }
      else if (progress >= .72) { caption = '…actually, just the rice bowl. ♡'; mood = 'Villain audition: complete'; }
    }
    return { id, elapsed, progress, caption, mood };
  }
  function pose(event, reducedMotion = false) {
    const result = { dx: 0, dy: 0, rotation: 0, scaleX: 1, scaleY: 1, eyes: 'normal', mouth: 'normal', arms: null, armLift: 0, gaze: 0, evil: false };
    if (!event) return result;
    const { id, progress: p } = event, t = reducedMotion ? .4 : p, envelope = Math.sin(t * Math.PI);
    if (id === 'wave') { result.arms = 'wave'; result.armLift = reducedMotion ? 7 : 6 + Math.sin(t * Math.PI * 8) * 4; result.rotation = reducedMotion ? 0 : Math.sin(t * Math.PI * 2) * .06; }
    if (id === 'hop') { result.dy = reducedMotion ? 0 : -18 * Math.abs(Math.sin(t * Math.PI * 3)); result.eyes = 'happy'; result.arms = 'up'; }
    if (id === 'dance') { result.dx = reducedMotion ? 0 : 7 * Math.sin(t * Math.PI * 6); result.rotation = reducedMotion ? 0 : .15 * Math.sin(t * Math.PI * 6); result.arms = 'up'; result.eyes = 'happy'; }
    if (id === 'tumble') { result.dx = reducedMotion ? 0 : Math.sin(t * Math.PI * 2) * 20; result.dy = reducedMotion ? 0 : -7 * envelope; result.rotation = reducedMotion ? 0 : Math.PI * 2 * (t * t * (3 - 2 * t)); result.eyes = 'happy'; }
    if (id === 'butterfly') { result.gaze = reducedMotion ? 2 : Math.round(Math.cos(t * Math.PI * 2) * 2); result.rotation = reducedMotion ? 0 : Math.sin(t * Math.PI * 2) * .05; }
    if (id === 'yawn') { result.scaleX = reducedMotion ? 1 : 1 - .06 * envelope; result.scaleY = reducedMotion ? 1 : 1 + .13 * envelope; result.eyes = 'closed'; result.mouth = 'yawn'; result.arms = 'up'; }
    if (id === 'overlord' && p >= .16 && p < .72) { result.evil = true; result.dy = reducedMotion ? 0 : -12 - Math.sin(p * Math.PI * 4) * 2; result.arms = 'up'; result.mouth = 'evil'; }
    return result;
  }
  function effects(ctx, event, { behind = false, reducedMotion = false } = {}) {
    if (!event) return;
    const { id, progress: p } = event, t = reducedMotion ? .4 : p;
    const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    const sparkle = (x, y, color) => { rect(x, y - 3, 2, 8, color); rect(x - 3, y, 8, 2, color); };
    ctx.save();
    if (id === 'overlord' && p < .72 && behind) {
      // A slow, steady dusk and a theatrical summoning ring; no flicker or jump cut.
      const amount = Math.min(1, p / .16) * Math.min(1, (.72 - p) / .12);
      ctx.globalAlpha = .42 * amount; rect(0, 0, 256, 176, '#302039'); ctx.globalAlpha = amount;
      ctx.strokeStyle = '#b86781'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(134, 151, 44, 8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(100, 151); ctx.lineTo(151, 145); ctx.lineTo(151, 157); ctx.closePath(); ctx.moveTo(166, 151); ctx.lineTo(116, 145); ctx.lineTo(116, 157); ctx.closePath(); ctx.stroke();
      [[90, 118], [175, 122], [153, 83]].forEach(([x, y], i) => sparkle(x, y + (reducedMotion ? 0 : Math.sin(t * Math.PI * 2 + i) * 4), '#b98aa8'));
    }
    if (behind) { ctx.restore(); return; }
    if (id === 'hop') { sparkle(87, 130 - Math.sin(t * Math.PI) * 12, '#f6e5a1'); sparkle(177, 120 - Math.sin(t * Math.PI) * 8, '#f6e5a1'); }
    if (id === 'dance') {
      ctx.fillStyle = '#816886'; ctx.font = 'bold 16px monospace';
      ctx.fillText('♪', 80, 116 + (reducedMotion ? 0 : Math.sin(t * Math.PI * 4) * 7)); ctx.fillText('♫', 168, 101 + (reducedMotion ? 0 : Math.cos(t * Math.PI * 4) * 6));
    }
    if (id === 'tumble') { rect(85, 140, 12, 2, '#79926e'); rect(80, 145, 9, 2, '#79926e'); }
    if (id === 'butterfly') {
      const x = 137 + Math.cos(t * Math.PI * 2) * 42, y = 88 - Math.sin(t * Math.PI) * 14, open = reducedMotion || Math.sin(t * Math.PI * 18) >= 0;
      rect(x - (open ? 7 : 3), y - 3, open ? 6 : 2, 8, '#bd88b3'); rect(x + 2, y - 3, open ? 6 : 2, 8, '#d7a1bd'); rect(x, y - 2, 2, 8, '#6d785d');
      rect(x - 2, y - 5, 2, 2, '#6d785d'); rect(x + 2, y - 5, 2, 2, '#6d785d');
    }
    if (id === 'yawn') {
      const x = 173, y = reducedMotion ? 95 : 105 - Math.sin(t * Math.PI) * 12;
      ctx.fillStyle = '#89987c'; ctx.font = '12px monospace'; ctx.fillText('o', x, y); ctx.fillText('°', x + 8, y - 10);
    }
    ctx.restore();
  }
  root.PocketPalAnimations = { NORMAL, RARE_CHANCE, DEFINITIONS, create, choose, frame, pose, effects };
})(globalThis);
