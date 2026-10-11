(function () {
  'use strict';
  const C = window.PocketPal, $ = id => document.getElementById(id);
  if (!C) { $('care-tip').textContent = 'The game could not load. Keep tamagochi-core.js and tamagochi.js beside this page, then refresh.'; return; }
  const modal = $('modal'), body = $('modal-body'), canvas = $('pet-canvas'), ctx = canvas.getContext('2d');
  let state, storageOK = true, session = null, toastTimer, modalCleanup = null, lastSaved = Date.now(), lastSpeech = '', notice = '';
  let shopSignature = '', albumSignature = '', journalSignature = '', goalsSignature = '';
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)'), A = window.PocketPalAnimations;
  const idle = A?.create({ random: () => Math.random() });
  let reducedMotion = motionPreference.matches;
  motionPreference.addEventListener('change', e => { reducedMotion = e.matches; idle?.interrupt(); draw(); });
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function load() {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(C.SAVE_KEY);
      if (raw) {
        try { state = C.restore(JSON.parse(raw), now); } catch (_) { state = null; }
        if (!state) { localStorage.setItem('pocket-pal-recovery', raw); notice = 'The saved game was unreadable. A recovery copy was kept; a new egg is ready.'; }
      } else {
        const oldRaw = localStorage.getItem('tamagochiGameState');
        if (oldRaw) {
          try {
            const old = JSON.parse(oldRaw);
            if (old && typeof old.name === 'string') { state = C.fresh(now); state.name = old.name.trim().slice(0, 20) || 'Mochi'; state.coins = C.clamp(Number(old.coins) || 0, 30, 200); notice = 'Welcome to Pocket Pal! Your name and up to 200 coins came along. Your original save is kept separately.'; }
          } catch (_) { /* Legacy data is kept untouched. */ }
        }
      }
    } catch (_) { storageOK = false; notice = 'Browser storage is unavailable. You can play this session and export a backup in Settings.'; }
    if (!state) state = C.fresh(now);
    const away = Math.max(0, (now - state.lastUpdate) / 1000);
    C.advance(state, now, { away: true });
    if (!notice && away > 300 && !state.paused && !state.dead) notice = `Welcome back! ${duration(Math.min(away, C.MAX_AWAY))} of pet time passed. Away-time protection kept health at 10 or above.`;
  }
  function save() {
    try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(state)); storageOK = true; lastSaved = Date.now(); }
    catch (_) { storageOK = false; }
    $('save-status').textContent = storageOK ? '● Saved on this device' : '○ Session only · export a backup';
    $('save-status').classList.toggle('storage-warning', !storageOK);
  }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4800); }
  let audio;
  function tone(kind = 'care') {
    if (!state.sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume().catch(() => {});
      const notes = kind === 'win' ? [523, 659, 784] : kind === 'error' ? [220] : [523, 659];
      notes.forEach((hz, i) => { const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + i * .09; osc.type = 'sine'; osc.frequency.value = hz; gain.gain.setValueAtTime(.035, t); gain.gain.exponentialRampToValueAtTime(.001, t + .16); osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .17); });
    } catch (_) { /* Sound is optional, including in restricted browsers. */ }
  }
  function duration(seconds) { if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))}s`; if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`; return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`; }
  function status() {
    if (state.dead) return { mood: 'A friend remembered', speech: 'Every little life leaves a little love.', tip: 'Their journey has ended. Welcome another egg in the discovery album.', health: 'Remembered' };
    if (state.paused) return { mood: 'Pet time paused', speech: 'Take your time. I will be right here.', tip: 'Needs, growth, and sleep recovery are paused. Press the middle device button to resume.', health: 'Paused' };
    if (state.stage === 'egg') return { mood: 'A new beginning', speech: 'Someone small is waiting to meet you.', tip: 'Your egg hatches after 20 seconds of pet time. Stay a little while!', health: 'An egg of possibility' };
    if (state.sleeping) return { mood: 'Dreaming little dreams', speech: 'Zzz… even little adventures need a rest.', tip: 'Energy recovers by 6 points per minute. Wake your pal when they are rested; sleeping continues while away.', health: state.sick ? 'Needs medicine' : 'Resting' };
    if (state.sick) return { mood: 'Feeling under the weather', speech: 'A little medicine would help…', tip: 'Give free medicine, then check food and cleanliness. Unmet needs can cause illness again.', health: 'Needs medicine' };
    if (state.fullness < 25) return { mood: 'A rumbly little tummy', speech: 'Is it time for a rice bowl?', tip: 'Feed a proper meal. Rice is always free. Low fullness left unattended can affect health.', health: state.health < 40 ? 'Feeling fragile' : 'Hungry' };
    if (state.cleanliness < 35 || state.waste) return { mood: 'Time for a tidy-up', speech: 'Can we make home nice and clean?', tip: 'Clean the room to remove waste and restore cleanliness. A dirty room can make your pal sick.', health: 'Needs a clean' };
    if (state.energy < 25) return { mood: 'A little sleepy', speech: 'My eyes are getting heavy…', tip: 'Turn out the lights for a rest. Playing spends energy; sleep restores it gradually.', health: 'Sleepy' };
    if (state.happiness < 35) return { mood: 'Could use a little joy', speech: 'Can we play something together?', tip: 'Try a mini-game or a cuddle. Coins come from playing, and happiness comes from spending time together.', health: 'Wants company' };
    return { mood: 'Happy to be here', speech: ['It is a good day to be little.', 'My favorite place is here with you.', 'A little home. A big world.'][Math.floor(state.age / 30) % 3], tip: 'Looking good! Tap your pal for a cuddle, play a game, or save up for a cozy new room.', health: state.health < 40 ? 'Recovering' : 'All is well' };
  }
  function render() {
    const st = status(), index = C.STAGES.indexOf(state.stage), active = !state.dead && !state.paused && state.stage !== 'egg' && !state.sleeping;
    $('pet-name').textContent = state.name;
    $('stage-label').textContent = `${state.stage.toUpperCase()} · GEN ${state.generation}`;
    $('screen-clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    $('coin-count').textContent = `◈ ${Math.floor(state.coins)}`;
    $('mood-label').textContent = st.mood;
    setSpeech(st.speech);
    $('care-tip').textContent = st.tip;
    $('health-badge').textContent = st.health;
    $('health-badge').classList.toggle('warning', state.sick || state.health < 40);
    $('scene-state').textContent = state.dead ? '♡' : state.paused ? 'PAUSED' : state.sleeping ? 'ZZZ' : state.stage === 'egg' ? 'HATCHING…' : state.sick ? '✚' : '♡';
    $('room-label').textContent = `${C.ITEMS.find(i => i.id === state.room).name.toUpperCase()} ROOM`;
    $('device').classList.toggle('sleeping', state.sleeping);
    $('device').classList.toggle('paused', state.paused);
    $('sound-btn').setAttribute('aria-pressed', state.sound);
    $('sound-btn').setAttribute('aria-label', `Turn sounds ${state.sound ? 'off' : 'on'}`);
    $('pause-btn').setAttribute('aria-pressed', state.paused);
    $('pause-btn').setAttribute('aria-label', `${state.paused ? 'Resume' : 'Pause'} pet time`);
    $('pause-btn').textContent = state.paused ? '▶' : 'Ⅱ';
    $('pet-btn').setAttribute('aria-label', `${state.name}, ${state.stage}, ${st.mood}. Give affection.`);
    $('pet-detail').textContent = state.stage === 'egg' ? 'Your story starts with an egg.' : `${state.form ? C.FORMS[state.form].name : state.stage[0].toUpperCase() + state.stage.slice(1)} · ${duration(state.age)} together · health ${Math.ceil(state.health)}%`;
    const next = C.THRESHOLDS[index + 1], start = C.THRESHOLDS[index];
    $('growth-title').textContent = state.dead ? 'A little life, remembered.' : index === 4 ? `${C.FORMS[state.form].name} · all grown up` : index === 0 ? 'A little patience…' : `Growing into a ${C.STAGES[index + 1]}`;
    $('growth-time').textContent = next && !state.dead ? `${duration(next - state.age)} ${index === 0 ? 'to hatch' : 'to grow'}` : `Generation ${state.generation}`;
    $('growth-bar').style.width = `${next ? C.clamp((state.age - start) / (next - start) * 100) : 100}%`;
    document.querySelectorAll('.growth-stages span').forEach((el, i) => el.classList.toggle('current', i === index));
    ['fullness', 'happiness', 'energy', 'cleanliness'].forEach(key => {
      const n = Math.ceil(state[key]), el = document.querySelector(`.need.${key}`); el.classList.toggle('low', n < 25);
      el.querySelector('.need-value').textContent = `${n}%`; const bar = el.querySelector('.need-track'); bar.setAttribute('aria-valuenow', n); el.querySelector('.need-fill').style.width = `${n}%`;
    });
    $('feed-btn').disabled = !active;
    $('play-btn').disabled = !active || state.sick || state.energy < 15 || state.fullness < 10;
    $('clean-btn').disabled = !active;
    $('sleep-btn').disabled = state.dead || state.paused || state.stage === 'egg';
    $('sleep-text').innerHTML = state.sleeping ? 'Wake up<small>Rise & shine, little pal</small>' : 'Sleep<small>A well-earned rest</small>';
    $('medicine-btn').hidden = !state.sick || state.dead;
    $('medicine-btn').disabled = !active;
    const g = state.goals;
    const goalKey = JSON.stringify(g);
    if (goalKey !== goalsSignature) { goalsSignature = goalKey; $('goals').innerHTML = [['meal', 'Share a proper meal'], ['clean', 'Freshen up the room'], ['game', 'Match 3 pairs or get 3 guesses right']].map(([key, text]) => `<div class="goal ${g[key] ? 'done' : ''}"><span class="goal-check" aria-hidden="true">${g[key] ? '✓' : ''}</span><span>${text}${g[key] ? ' ✓' : ''}</span></div>`).join(''); }
    $('claim-btn').disabled = g.claimed || !g.meal || !g.clean || !g.game;
    $('claim-btn').textContent = g.claimed ? 'Today’s bonus collected · lovely work!' : g.meal && g.clean && g.game ? 'Collect your 20-coin bonus →' : 'Complete all three · earn 20 coins';
    const journalKey = JSON.stringify(state.journal);
    if (journalKey !== journalSignature) { journalSignature = journalKey; $('journal').innerHTML = state.journal.slice(0, 6).map(j => `<li><time>${duration(j.age)} into our story</time>${escape(j.text)}</li>`).join(''); }
    renderShop(); renderAlbum(); draw();
    $('save-status').textContent = storageOK ? '● Saved on this device' : '○ Session only · export a backup';
  }
  function renderShop() {
    const key = JSON.stringify([state.coins, state.owned, state.room, state.hat]);
    if (shopSignature === key) return;
    shopSignature = key;
    $('shop').innerHTML = C.ITEMS.map(item => {
      const owned = state.owned.includes(item.id), equipped = state[item.type] === item.id;
      return `<div class="shop-card"><div class="swatch" style="background:${item.color}" aria-hidden="true">${item.type === 'room' ? '⌂' : item.id === 'bow' ? '🎀' : item.id === 'leaf' ? '🌿' : '♡'}</div><h3>${item.name}</h3><p>${item.description}</p><button data-buy="${item.id}" ${equipped || !owned && state.coins < item.cost ? 'disabled' : ''}>${equipped ? 'Equipped ✓' : owned ? 'Equip' : `Get for ${item.cost} coins`}</button></div>`;
    }).join('');
  }
  function renderAlbum() {
    const key = JSON.stringify([state.discoveries, state.history]);
    if (albumSignature !== key) { albumSignature = key; $('album').innerHTML = Object.entries(C.FORMS).map(([key, f]) => {
      const unlocked = state.discoveries.includes(key);
      return `<div class="album-card ${unlocked ? '' : 'locked'}"><div class="album-character" style="color:${unlocked ? f.color : '#a3ac99'}" aria-hidden="true">${unlocked ? '✿' : '?'}</div><h3>${unlocked ? f.name : 'Undiscovered'}</h3><p>${unlocked ? f.description : key === 'sunny' ? 'A bright future grows from balanced care.' : key === 'sprout' ? 'Some friends love shared meals most.' : key === 'starlit' ? 'Some friends love a playful life.' : 'Every path has a friend waiting.'}</p></div>`;
    }).join('') + state.history.map(h => `<div class="history-entry">Generation ${h.generation} · ${escape(h.name)} · ${h.form ? C.FORMS[h.form].name : 'Little pal'} · ${h.dead ? 'Remembered with love' : 'Off on a new adventure'}</div>`).join(''); }
    const eligible = state.dead || state.stage === 'adult' && state.age >= C.THRESHOLDS[4] + 7200;
    $('generation-btn').disabled = !eligible;
    $('generation-btn').textContent = state.dead ? 'Welcome a new little egg' : eligible ? 'Send your pal on an adventure →' : state.stage === 'adult' ? `${duration(C.THRESHOLDS[4] + 7200 - state.age)} until a new adventure` : 'Raise your pal to adulthood first';
  }
  function setSpeech(text) { if (text !== lastSpeech) { $('speech').textContent = text; lastSpeech = text; } }
  function draw() {
    if (!ctx) return;
    const eligible = !document.hidden && !modal.open && !state.paused && !state.dead && !state.sleeping && !state.sick && state.stage !== 'egg' && state.fullness >= 25 && state.energy >= 25 && state.happiness >= 25 && state.cleanliness >= 35 && state.health >= 40 && !state.waste;
    const visualNow = window.performance.now();
    const animation = idle?.tick(visualNow, eligible, state.generation) || null;
    const pose = A?.pose(animation, reducedMotion) || { dx: 0, dy: 0, rotation: 0, scaleX: 1, scaleY: 1, gaze: 0 };
    const normalStatus = status();
    setSpeech(animation?.caption || normalStatus.speech);
    $('mood-label').textContent = animation?.mood || normalStatus.mood;
    $('scene-state').textContent = animation ? (animation.id === 'overlord' ? '?' : '♪') : state.dead ? '♡' : state.paused ? 'PAUSED' : state.sleeping ? 'ZZZ' : state.stage === 'egg' ? 'HATCHING…' : state.sick ? '✚' : '♡';
    $('pet-btn').setAttribute('aria-label', `${state.name}, ${state.stage}, ${animation?.mood || normalStatus.mood}. Give affection.`);
    $('scene').dataset.animation = animation?.id || 'idle';
    canvas.setAttribute('aria-label', `${state.name}'s room${animation ? ': ' + animation.mood : ''}`);
    ctx.imageSmoothingEnabled = false;
    const w = canvas.width, h = canvas.height, night = state.room === 'night';
    const palette = state.room === 'peach' ? ['#efd3b9', '#d4bda3', '#f7e5d0', '#d7a891'] : night ? ['#b2bed5', '#949ebb', '#dae1ed', '#9395b6'] : ['#cedcb7', '#b2c49b', '#e0e9c9', '#98b488'];
    const rect = (x, y, a, b, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), a, b); };
    rect(0, 0, w, h, palette[0]); rect(0, 130, w, 46, palette[1]); rect(0, 129, w, 2, '#899778');
    // Original pixel room, drawn locally: window, floorboards, plant, and rug.
    rect(176, 35, 49, 57, '#7f967a'); rect(179, 38, 43, 51, palette[2]);
    rect(179, 66, 43, 23, night ? '#a3afd1' : '#b6d0bd'); rect(199, 38, 3, 51, '#7f967a'); rect(179, 62, 43, 3, '#7f967a');
    if (night) { [[187, 45], [210, 52], [185, 75], [209, 81]].forEach(([x, y]) => { rect(x, y, 2, 6, '#f3efbc'); rect(x - 2, y + 2, 6, 2, '#f3efbc'); }); }
    else { rect(184, 43, 10, 10, '#eedfa1'); rect(206, 51, 12, 4, '#f5f5dc'); }
    rect(23, 118, 16, 17, '#b0997d'); rect(20, 115, 22, 4, '#c3ab8d'); rect(29, 99, 4, 16, '#728b62');
    rect(22, 98, 10, 6, '#88a574'); rect(32, 91, 8, 7, '#789b68'); rect(27, 87, 6, 14, '#8eac78');
    for (let x = 7; x < 256; x += 40) rect(x, 150, 25, 1, '#8c9e7c40');
    rect(78, 148, 106, 14, palette[3]); rect(86, 144, 90, 22, palette[3]); rect(92, 150, 78, 10, '#ece6c440');
    const moving = !reducedMotion && !state.sleeping && !state.dead && !state.paused;
    A?.effects(ctx, animation, { behind: true, reducedMotion });
    const bob = moving && !animation ? (Math.floor(visualNow / 750) % 2 ? -2 : 0) : 0;
    const x = 106, y = 100 + bob, color = pose.evil ? '#796078' : state.form ? C.FORMS[state.form].color : '#edc985', edge = '#647052';
    rect(109, 145, 47, 4, '#63755430');
    if (state.dead) {
      rect(116, 101, 34, 39, '#edf0df'); rect(122, 96, 22, 49, '#edf0df'); rect(120, 118, 5, 5, '#859580'); rect(140, 118, 5, 5, '#859580'); rect(121, 91, 23, 3, '#d4bc68');
    } else if (state.stage === 'egg') {
      const shake = moving && state.age > 13 ? Math.floor(visualNow / 160) % 3 - 1 : 0;
      rect(116 + shake, 101, 30, 45, edge); rect(110 + shake, 113, 42, 28, edge); rect(121 + shake, 96, 20, 55, edge);
      rect(118 + shake, 104, 26, 40, '#f4ecd4'); rect(113 + shake, 116, 36, 23, '#f4ecd4'); rect(123 + shake, 100, 16, 46, '#f4ecd4');
      rect(120 + shake, 117, 7, 7, '#c4b892'); rect(136 + shake, 130, 8, 5, '#c4b892'); rect(130 + shake, 105, 5, 6, '#d7c99e');
      if (state.age > 15) { rect(129 + shake, 116, 3, 7, edge); rect(132 + shake, 122, 5, 3, edge); rect(134 + shake, 125, 3, 8, edge); }
    } else {
      const size = state.stage === 'baby' ? 0.72 : state.stage === 'child' ? .86 : 1;
      ctx.save(); ctx.translate(132 + pose.dx, 132 + bob + pose.dy); ctx.rotate(pose.rotation); ctx.translate(0, 17); ctx.scale(size * pose.scaleX, size * pose.scaleY); ctx.translate(-132, -149 - bob);
      rect(x + 5, y + 8, 48, 43, edge); rect(x - 1, y + 17, 60, 27, edge); rect(x + 11, y + 3, 36, 53, edge);
      rect(x + 7, y + 11, 44, 36, color); rect(x + 2, y + 19, 54, 23, color); rect(x + 13, y + 6, 32, 47, color);
      rect(x + 2, y + 48, 14, 7, edge); rect(x + 41, y + 48, 14, 7, edge); rect(x + 4, y + 48, 10, 4, color); rect(x + 43, y + 48, 10, 4, color);
      if (state.form === 'sprout' || state.hat === 'leaf') { rect(x + 27, y - 7, 3, 13, '#698958'); rect(x + 29, y - 10, 13, 7, '#82a769'); }
      if (state.form === 'starlit') { rect(x + 3, y - 4, 10, 18, color); rect(x + 43, y - 4, 10, 18, color); }
      if (pose.arms) {
        const leftY = pose.arms === 'wave' ? y + 20 - pose.armLift : y + 14;
        rect(x - 5, leftY, 11, 9, edge); rect(x - 3, leftY + 2, 9, 5, color);
        if (pose.arms === 'up') { rect(x + 52, y + 14, 11, 9, edge); rect(x + 52, y + 16, 9, 5, color); }
      }
      const sleepy = state.sleeping || state.energy < 15 || pose.eyes === 'closed', blink = moving && !animation && visualNow % 5800 < 140;
      if (pose.evil) {
        rect(x + 13, y + 24, 10, 6, '#de727a'); rect(x + 35, y + 24, 10, 6, '#de727a');
        rect(x + 13, y + 23, 3, 3, edge); rect(x + 42, y + 23, 3, 3, edge);
      } else if (pose.eyes === 'happy') {
        [16, 37].forEach(ex => { rect(x + ex, y + 27, 5, 2, edge); rect(x + ex - 1, y + 29, 2, 3, edge); rect(x + ex + 4, y + 29, 2, 3, edge); });
      } else { rect(x + 16 + pose.gaze, y + 25, 5, sleepy || blink ? 2 : 7, edge); rect(x + 37 + pose.gaze, y + 25, 5, sleepy || blink ? 2 : 7, edge); }
      rect(x + 10, y + 33, 7, 4, '#d9908190'); rect(x + 42, y + 33, 7, 4, '#d9908190');
      if (pose.mouth === 'yawn') { rect(x + 25, y + 36, 9, 9, edge); rect(x + 27, y + 38, 5, 4, '#d7a384'); }
      else if (pose.evil) { rect(x + 23, y + 36, 14, 6, edge); rect(x + 25, y + 36, 3, 3, '#f6e9ce'); rect(x + 32, y + 36, 3, 3, '#f6e9ce'); }
      else if (state.sick || state.happiness < 25) { rect(x + 26, y + 39, 7, 2, edge); rect(x + 24, y + 41, 2, 2, edge); rect(x + 33, y + 41, 2, 2, edge); }
      else { rect(x + 25, y + 37, 2, 3, edge); rect(x + 32, y + 37, 2, 3, edge); rect(x + 27, y + 40, 5, 2, edge); }
      if (state.hat === 'bow') { rect(x + 31, y + 1, 9, 10, '#c66f87'); rect(x + 44, y + 1, 9, 10, '#c66f87'); rect(x + 40, y + 4, 4, 4, '#a65572'); }
      if (pose.evil) {
        rect(x + 7, y - 4, 8, 15, '#ac6b83'); rect(x + 8, y - 9, 4, 6, '#ac6b83');
        rect(x + 42, y - 4, 8, 15, '#ac6b83'); rect(x + 45, y - 9, 4, 6, '#ac6b83');
        rect(x + 58, y + 36, 13, 3, '#ac6b83'); rect(x + 68, y + 28, 3, 9, '#ac6b83'); rect(x + 65, y + 25, 9, 4, '#ac6b83');
      }
      ctx.restore();
    }
    A?.effects(ctx, animation, { reducedMotion });
    for (let i = 0; i < state.waste; i++) { const px = 181 + i * 14; rect(px, 146, 12, 5, '#897355'); rect(px + 2, 142, 8, 5, '#897355'); rect(px + 4, 139, 4, 4, '#897355'); }
    if (state.sleeping) { ctx.fillStyle = '#5a6c61'; ctx.font = 'bold 13px monospace'; ctx.fillText('z', 165, 112); ctx.fillText('Z', 177, 100); }
    if (state.sick) { rect(83, 99, 4, 15, '#ab7070'); rect(78, 104, 14, 4, '#ab7070'); }
  }
  function cleanupModal() { const callback = modalCleanup; modalCleanup = null; if (callback) callback(); }
  function closeModal() { if (modal.open) { modal.close(); cleanupModal(); } }
  function openModal(title, html, cleanup = null) {
    idle?.interrupt();
    if (modal.open) { if (modalCleanup) { const cb = modalCleanup; modalCleanup = null; cb(); } }
    $('modal-title').textContent = title; body.innerHTML = html; modalCleanup = cleanup;
    if (!modal.open) modal.showModal();
    draw();
  }
  modal.addEventListener('close', () => { if (!modal.open) cleanupModal(); });
  $('close-modal').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) { const r = modal.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(); } });
  function care(action) { idle?.interrupt(); const r = C.act(state, action); save(); render(); toast(r.message); tone(r.ok ? 'care' : 'error'); return r; }
  function feedMenu() {
    openModal('Something good to eat', `<p class="game-instruction">Meals fill the tummy. A treat brings a smile, but your pal needs real meals too.</p><div class="menu-list"><button class="menu-item" data-food="meal"><span>🍚</span><span>Warm rice bowl<small>+28 fullness · +3 happiness</small></span><b>Always free</b></button><button class="menu-item" data-food="veggie"><span>🥬</span><span>Garden greens<small>+28 fullness · +8 health</small></span><b>3 coins</b></button><button class="menu-item" data-food="snack"><span>🍓</span><span>Berry treat<small>+20 happiness · +8 fullness<br>Two treats at a time; room for another every 20 minutes.</small></span><b>6 coins</b></button></div>`);
    body.querySelectorAll('[data-food]').forEach(b => b.addEventListener('click', () => { if (care(b.dataset.food).ok) closeModal(); }));
  }
  function gameMenu() {
    openModal('A little playtime', `<p class="game-instruction">Each game uses 8 energy and 4 fullness. Every match or correct guess earns 4 coins. No coins needed to play.</p><div class="menu-list"><button id="memory-start" class="menu-item"><span>🌷</span><span>Memory Garden<small>Find six pairs of little treasures.<br>Take your time; there is no timer.</small></span><b>Up to 24 ◈</b></button><button id="guess-start" class="menu-item"><span>↕</span><span>Higher or Lower<small>Will the next number go up or down?<br>Five rounds, numbers from 1 to 9.</small></span><b>Up to 20 ◈</b></button></div>`);
    $('memory-start').onclick = () => startGame('memory'); $('guess-start').onclick = () => startGame('guess');
  }
  function startGame(kind) {
    const r = C.beginGame(state); save(); render();
    if (!r.ok) { toast(r.message); closeModal(); return; }
    session = { kind, score: 0, finished: false };
    if (kind === 'memory') memoryGame(); else guessGame();
  }
  function endGame(showResult = true) {
    if (!session || session.finished) return;
    const current = session; current.finished = true; session = null; modalCleanup = null;
    if (current.timer) clearTimeout(current.timer);
    const reward = C.rewardGame(state, current.kind, current.score); save(); render(); tone(reward.coins ? 'win' : 'care');
    if (!showResult) { toast(reward.message); return; }
    const max = current.kind === 'memory' ? 6 : 5;
    openModal('A little victory', `<div class="result"><span class="result-icon">${current.score >= 3 ? '🌟' : '🌱'}</span><h3>${current.score === max ? 'You make a great team!' : 'A little better, together.'}</h3><p>${current.score}/${max} ${current.kind === 'memory' ? 'pairs found' : 'correct guesses'}</p><p><strong>+${reward.coins} coins</strong> · a happier little pal</p><button id="result-done" class="primary-button">Back to my pal ♡</button></div>`);
    $('result-done').onclick = closeModal;
  }
  function memoryGame() {
    const current = session, cards = ['🌷', '🍓', '🍀', '⭐', '🍄', '🐚'].flatMap(symbol => [symbol, symbol]);
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    let flipped = [], matches = new Set(), moves = 0, locked = false;
    openModal('Memory Garden', `<div class="game-info"><span id="memory-moves">0 moves</span><strong id="memory-score">0 / 6 pairs</strong></div><p class="game-instruction">Turn over two cards. Find the matching treasures! Keyboard: Tab to a card, then Enter or Space.</p><div class="memory-grid">${cards.map((_, i) => `<button class="memory-card" data-card="${i}" aria-label="Card ${i + 1}, face down">✿</button>`).join('')}</div><button id="finish-game" class="text-button">Finish & keep coins from matched pairs</button>`, () => endGame(false));
    function reveal(i, visible) { const b = body.querySelector(`[data-card="${i}"]`); if (!b) return; b.textContent = visible ? cards[i] : '✿'; b.classList.toggle('face-up', visible); b.setAttribute('aria-label', `Card ${i + 1}, ${visible ? cards[i] : 'face down'}`); }
    body.querySelectorAll('[data-card]').forEach(button => button.onclick = () => {
      if (locked || session !== current || matches.has(+button.dataset.card) || flipped.includes(+button.dataset.card)) return;
      const i = +button.dataset.card; flipped.push(i); reveal(i, true); tone();
      if (flipped.length !== 2) return;
      moves++; $('memory-moves').textContent = `${moves} moves`;
      const [a, b] = flipped;
      if (cards[a] === cards[b]) {
        matches.add(a); matches.add(b); current.score++; flipped = [];
        [a, b].forEach(n => { const el = body.querySelector(`[data-card="${n}"]`); el.classList.add('matched'); el.disabled = true; el.setAttribute('aria-label', `Card ${n + 1}, ${cards[n]}, matched`); });
        $('memory-score').textContent = `${current.score} / 6 pairs`;
        if (current.score === 6) { locked = true; current.timer = setTimeout(() => { if (session === current) endGame(); }, 500); }
      } else { locked = true; current.timer = setTimeout(() => { if (session !== current) return; reveal(a, false); reveal(b, false); flipped = []; locked = false; }, 800); }
    });
    $('finish-game').onclick = () => endGame();
  }
  function guessGame() {
    const current = session;
    let number = 1 + Math.floor(Math.random() * 9), round = 0;
    openModal('Higher or Lower', `<div class="game-info"><span id="guess-round">Round 1 / 5</span><strong id="guess-score">0 correct</strong></div><p class="game-instruction">The next number is from 1 to 9 and always different. Will it be higher or lower? Think about the odds.</p><div class="number-card" id="guess-number">${number}</div><div class="guess-controls"><button id="lower-btn">↓ Lower</button><button id="higher-btn">↑ Higher</button></div><p id="guess-feedback" class="round-feedback" role="status">Your guess?</p><button id="guess-next" class="primary-button" hidden>Next round →</button>`, () => endGame(false));
    function choose(higher) {
      if (session !== current || $('higher-btn').disabled) return;
      // Draw uniformly from the eight alternatives: no ties and no rejection loop.
      const draw = 1 + Math.floor(Math.random() * 8), next = draw >= number ? draw + 1 : draw, correct = higher ? next > number : next < number;
      round++; if (correct) current.score++;
      $('guess-feedback').textContent = `${number} → ${next}. ${correct ? 'You got it! +4 coins' : 'A surprise! Better luck next round.'}`;
      number = next; $('guess-number').textContent = number; $('guess-score').textContent = `${current.score} correct`;
      $('higher-btn').disabled = true; $('lower-btn').disabled = true; $('guess-next').hidden = false;
      $('guess-next').textContent = round === 5 ? 'See your result →' : 'Next round →'; $('guess-next').focus(); tone(correct ? 'care' : 'error');
    }
    $('higher-btn').onclick = () => choose(true); $('lower-btn').onclick = () => choose(false);
    $('guess-next').onclick = () => { if (round === 5) { endGame(); return; } $('guess-round').textContent = `Round ${round + 1} / 5`; $('guess-next').hidden = true; $('higher-btn').disabled = false; $('lower-btn').disabled = false; $('guess-feedback').textContent = 'Your guess?'; $('lower-btn').focus(); };
  }
  function guide() {
    openModal('A guide to little lives', `<div class="modal-copy"><p><strong>Your pal is a living little companion.</strong> Food, happiness, energy, and cleanliness slowly fall as pet time passes. Listen to their requests and check in when you can.</p><h3>The everyday things</h3><p>🍚 Free rice fills the tummy. Treats help happiness, but do not replace meals.<br>🎮 Mini-games earn coins and happiness. Match three pairs or make three correct guesses for the daily play goal.<br>🫧 Cleaning removes waste and restores cleanliness.<br>🌙 Sleep restores 6 energy per minute. Wake your pal yourself when they are ready.<br>✚ Medicine is free and cures illness. Keep the room clean and the tummy full to avoid getting ill again.</p><h3>A little time to grow</h3><p>Egg → Baby at 20 seconds → Child at 8 minutes → Teen at 30 minutes → Adult at 90 minutes of pet time. Balanced care with few missed needs grows a Sunny pal; other paths favor meals, games, or a resilient Cloud. Growth is based on time and care, so repeated clicks do not speed it up.</p><h3>Make room for real life</h3><p>The middle device button pauses every need and all growth, including while closed. Otherwise, up to 8 hours pass while away, with health protected at 10 or above. When a visible page is left unattended, health can reach zero. A new egg carries your coins, rooms, accessories, and discoveries forward.</p><h3>Your own little story</h3><p>Progress saves in this browser. Settings lets you export and restore a backup. After two adult hours, you can send your pal on an adventure and welcome the next generation. Daily care goals reset at midnight on your device.</p><p>Inspired by the care and growth of <a href="https://tamagotchi-official.com/us/series/connection/howto/" target="_blank" rel="noopener">Tamagotchi</a> and the mini-games and customization of <a href="https://play.google.com/store/apps/details?id=me.pou.app" target="_blank" rel="noopener">Pou</a>. Pocket Pal uses original characters and its own rules.</p></div>`);
  }
  function rename() {
    openModal('A name for a little friend', `<form id="rename-form"><label class="form-label" for="name-input">Pet name · up to 20 characters</label><input id="name-input" class="name-input" maxlength="20" required autocomplete="off" value="${escape(state.name)}"><div class="dialog-footer"><button type="button" id="rename-cancel" class="secondary-button">Cancel</button><button type="submit" class="primary-button">Save name</button></div></form>`);
    $('name-input').focus(); $('name-input').select(); $('rename-cancel').onclick = closeModal;
    $('rename-form').onsubmit = e => { e.preventDefault(); const name = $('name-input').value.trim(); if (!name) { $('name-input').setCustomValidity('Give your pal a little name.'); $('name-input').reportValidity(); return; } const old = state.name; state.name = name.slice(0, 20); C.log(state, `${old} is now called ${state.name}.`); save(); render(); closeModal(); toast('A lovely name for a lovely friend.'); };
    $('name-input').oninput = () => $('name-input').setCustomValidity('');
  }
  function confirm(title, message, label, callback) {
    openModal(title, `<p class="modal-copy">${message}</p><div class="dialog-footer"><button id="confirm-cancel" class="secondary-button">Cancel</button><button id="confirm-ok" class="primary-button">${label}</button></div>`);
    $('confirm-cancel').onclick = closeModal; $('confirm-ok').onclick = () => { callback(); closeModal(); };
  }
  function newEgg(force = false) {
    confirm(state.dead ? 'A new beginning' : force ? 'Welcome a new egg?' : 'Ready for a new adventure?', `This ends ${escape(state.name)}’s current chapter and starts generation ${state.generation + 1}. Coins, rooms, accessories, today’s goals, and discoveries stay with you. Their name and life stage will be recorded in your album.`, 'Welcome the next egg', () => {
      const next = C.nextGeneration(state, Date.now(), force); if (!next) { toast('Your pal needs a little more adult time first.'); return; } state = next; save(); render(); toast('A little egg. A whole new story.');
    });
  }
  function settings() {
    openModal('The little details', `<div class="setting-row"><span>Pet time<small>Pause needs and growth while life is busy.</small></span><button id="setting-pause" class="secondary-button">${state.paused ? 'Resume' : 'Pause'}</button></div><div class="setting-row"><span>Little sounds<small>Soft notes for care and play.</small></span><button id="setting-sound" class="secondary-button">${state.sound ? 'On' : 'Off'}</button></div><p class="modal-copy">${storageOK ? 'Your progress is saved on this device.' : 'Storage is unavailable. Export a backup before closing.'} A backup keeps your pal safe if you switch browsers or clear website data.</p><div class="backup-controls"><button id="export-btn" class="secondary-button">Export backup ↓</button><button id="import-btn" class="secondary-button">Restore backup ↑</button><input type="file" id="import-file" accept="application/json,.json" hidden></div><p id="import-status" class="modal-copy" role="status"></p><button id="reset-btn" class="text-button danger-button">End this chapter & start a new egg</button>`);
    $('setting-pause').onclick = () => { care('pause'); $('setting-pause').textContent = state.paused ? 'Resume' : 'Pause'; };
    $('setting-sound').onclick = () => { care('sound'); $('setting-sound').textContent = state.sound ? 'On' : 'Off'; };
    $('export-btn').onclick = () => {
      C.advance(state); save();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `pocket-pal-generation-${state.generation}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Your little story has been exported.');
    };
    $('import-btn').onclick = () => $('import-file').click();
    $('import-file').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      const error = message => { if ($('import-status')) $('import-status').textContent = message; };
      if (file.size > 500000) { error('That file is too large. Choose a Pocket Pal JSON backup.'); return; }
      let loaded;
      try { loaded = C.restore(JSON.parse(await file.text())); } catch (_) { loaded = null; }
      if (!loaded) { error('This is not a valid Pocket Pal backup. Your current pal is safe.'); return; }
      confirm('Restore this little story?', `Replace your current progress with ${escape(loaded.name)}, generation ${loaded.generation}? Export your current story first if you want to keep both.`, 'Restore backup', () => { state = loaded; C.advance(state, Date.now(), { away: true }); save(); render(); toast('Your little pal is home again.'); });
    };
    $('reset-btn').onclick = () => newEgg(true);
  }
  $('needs').innerHTML = [['fullness', 'Fullness'], ['happiness', 'Happiness'], ['energy', 'Energy'], ['cleanliness', 'Cleanliness']].map(([key, label]) => `<div class="need ${key}"><div class="need-heading"><span>${label}</span><span class="need-value">100%</span></div><div class="need-track" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div class="need-fill"></div></div></div>`).join('');
  $('feed-btn').onclick = feedMenu; $('play-btn').onclick = gameMenu; $('clean-btn').onclick = () => care('clean'); $('sleep-btn').onclick = () => care('sleep'); $('medicine-btn').onclick = () => care('medicine'); $('pet-btn').onclick = () => care('pet'); $('pause-btn').onclick = () => care('pause'); $('sound-btn').onclick = () => care('sound'); $('claim-btn').onclick = () => { const r = C.claim(state); save(); render(); toast(r.message); tone(r.ok ? 'win' : 'error'); };
  $('guide-btn').onclick = guide; $('footer-guide').onclick = guide; $('rename-btn').onclick = rename; $('settings-btn').onclick = settings; $('generation-btn').onclick = () => newEgg();
  $('shop').onclick = e => { const button = e.target.closest('[data-buy]'); if (!button || button.disabled) return; C.advance(state); const r = C.buy(state, button.dataset.buy); save(); render(); toast(r.message); tone(r.ok ? 'care' : 'error'); };
  const tabs = [...document.querySelectorAll('[data-tab]')];
  function selectTab(button) { tabs.forEach(tab => { const selected = button === tab; tab.setAttribute('aria-selected', selected); tab.tabIndex = selected ? 0 : -1; $(`panel-${tab.dataset.tab}`).hidden = !selected; }); }
  tabs.forEach((tab, i) => { tab.onclick = () => selectTab(tab); tab.onkeydown = e => { let next; if (e.key === 'ArrowRight') next = (i + 1) % tabs.length; if (e.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length; if (e.key === 'Home') next = 0; if (e.key === 'End') next = tabs.length - 1; if (next === undefined) return; e.preventDefault(); selectTab(tabs[next]); tabs[next].focus(); }; });
  let hiddenAt = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { idle?.interrupt(); C.advance(state); hiddenAt = Date.now(); save(); }
    else { C.advance(state, Date.now(), { away: hiddenAt !== null }); hiddenAt = null; save(); render(); }
  });
  window.addEventListener('pagehide', () => { C.advance(state, Date.now(), { away: document.hidden }); save(); });
  window.addEventListener('storage', e => {
    if (e.key !== C.SAVE_KEY || !e.newValue) return;
    let updated; try { updated = C.restore(JSON.parse(e.newValue)); } catch (_) { return; } if (!updated) return;
    if (session) { if (session.timer) clearTimeout(session.timer); session = null; modalCleanup = null; closeModal(); toast('Progress changed in another tab. This game was closed to keep your save in sync.'); }
    idle?.interrupt(); state = updated; render();
  });
  load(); save(); render();
  if (notice) setTimeout(() => toast(notice), 300);
  setInterval(() => {
    if (document.hidden) return;
    const oldStage = state.stage; C.advance(state);
    if (state.stage !== oldStage) { tone('win'); toast(state.stage === 'baby' ? `${state.name} hatched! Say hello to your little pal.` : `${state.name} grew into ${state.form ? C.FORMS[state.form].name : `a ${state.stage}`}!`); }
    if (state.dead && session) { session = null; modalCleanup = null; closeModal(); }
    render(); if (Date.now() - lastSaved > 10000) save();
  }, 1000);
  setInterval(() => { if (!document.hidden) draw(); }, 100);
})();
