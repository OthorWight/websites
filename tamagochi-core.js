/* Pocket Pal: deterministic, DOM-free virtual-pet rules. Time is in seconds. */
(function (root) {
  'use strict';
  const VERSION = 2, SAVE_KEY = 'pocket-pal-v2', MAX_AWAY = 8 * 3600;
  const STAGES = ['egg', 'baby', 'child', 'teen', 'adult'];
  const THRESHOLDS = [0, 20, 8 * 60, 30 * 60, 90 * 60];
  const FORMS = {
    sunny: { name: 'Sunny', color: '#ebba51', description: 'A bright, bouncy friend. Balanced care and few missed needs bring out this sunny soul.' },
    sprout: { name: 'Sprout', color: '#83ac70', description: 'A gentle little homebody. Shared meals are their favorite thing.' },
    starlit: { name: 'Starlit', color: '#a499d1', description: 'A curious, playful dreamer. Games and affection light up their world.' },
    cloud: { name: 'Cloud', color: '#9fb7c5', description: 'A sleepy, resilient companion. Even a bumpy beginning can lead to a lovely friendship.' }
  };
  const ITEMS = [
    { id: 'meadow', type: 'room', name: 'Meadow', cost: 0, color: '#cedcb7', description: 'A little patch of green.' },
    { id: 'peach', type: 'room', name: 'Peach cottage', cost: 45, color: '#eec9ae', description: 'Warm walls, softer mornings.' },
    { id: 'night', type: 'room', name: 'Stargazer', cost: 75, color: '#abb5d1', description: 'A room full of tiny stars.' },
    { id: 'none', type: 'hat', name: 'Just me', cost: 0, color: '#eadfd5', description: 'Perfect just as you are.' },
    { id: 'bow', type: 'hat', name: 'Cherry bow', cost: 30, color: '#d87c83', description: 'A little something fancy.' },
    { id: 'leaf', type: 'hat', name: 'Lucky leaf', cost: 50, color: '#85a876', description: 'For a friend who loves to grow.' }
  ];
  const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
  const finite = (v, fallback, lo = 0, hi = 1e9) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
  const dayKey = now => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  function fresh(now = Date.now(), previous = null) {
    return { version: VERSION, name: previous?.name || 'Mochi', age: 0, stage: 'egg', form: null, generation: (previous?.generation || 0) + 1,
      fullness: 80, happiness: 80, energy: 90, cleanliness: 100, health: 100, coins: previous?.coins ?? 30,
      sleeping: false, sick: false, dead: false, paused: previous?.paused || false, sound: previous?.sound || false,
      lastUpdate: now, waste: 0, wasteClock: 0, sickClock: 0, neglectClock: 0, neglectNoted: false,
      snackLoad: 0, careTotal: 0, careTime: 0, misses: 0, meals: 0, games: 0, affection: 0, lastPet: -100,
      room: previous?.room || 'meadow', hat: previous?.hat || 'none', owned: previous?.owned.slice() || ['meadow', 'none'],
      discoveries: previous?.discoveries.slice() || [], history: previous?.history.slice() || [],
      goals: previous?.goals ? { ...previous.goals } : { day: dayKey(now), meal: false, clean: false, game: false, claimed: false },
      journal: [{ age: 0, text: `Generation ${(previous?.generation || 0) + 1}: a new little egg arrived.` }] };
  }
  function log(s, text) { s.journal.unshift({ age: Math.floor(s.age), text }); s.journal = s.journal.slice(0, 24); }
  function goals(s, now) { if (s.goals.day !== dayKey(now)) s.goals = { day: dayKey(now), meal: false, clean: false, game: false, claimed: false }; }
  function evolve(s) {
    const index = THRESHOLDS.reduce((n, t, i) => s.age >= t ? i : n, 0), next = STAGES[index];
    if (next === s.stage) return;
    s.stage = next;
    if (next === 'adult') {
      const quality = s.careTime ? s.careTotal / s.careTime : 80;
      s.form = quality >= 65 && s.misses <= 2 ? 'sunny' : quality < 35 || s.misses >= 8 ? 'cloud' : s.games * 2 + s.affection > s.meals ? 'starlit' : 'sprout';
      if (!s.discoveries.includes(s.form)) s.discoveries.push(s.form);
      log(s, `${s.name} grew into ${FORMS[s.form].name}! A new chapter begins.`);
    } else log(s, next === 'baby' ? `${s.name} hatched! Hello, little friend.` : `${s.name} grew into a ${next}.`);
  }
  function advance(s, now = Date.now(), { away = false } = {}) {
    const raw = Math.max(0, (now - s.lastUpdate) / 1000), elapsed = Math.min(raw, MAX_AWAY);
    s.lastUpdate = Math.max(s.lastUpdate, now);
    goals(s, now);
    if (s.paused || s.dead || !elapsed) return { elapsed: 0, capped: raw > MAX_AWAY };
    // Fixed small steps prevent long absences from skipping illness, hatch, or evolution.
    let left = elapsed;
    while (left > 0 && !s.dead) {
      const dt = Math.min(5, left), minutes = dt / 60;
      left -= dt; s.age += dt; evolve(s);
      if (s.stage === 'egg') continue;
      const factor = s.stage === 'baby' ? 1.25 : 1;
      s.fullness = clamp(s.fullness - minutes * (s.sleeping ? 0.25 : 0.9 * factor));
      s.happiness = clamp(s.happiness - minutes * (s.sleeping ? 0.1 : 0.65 * factor));
      s.energy = clamp(s.energy + minutes * (s.sleeping ? 6 : -0.6 * factor));
      s.cleanliness = clamp(s.cleanliness - minutes * (s.sleeping ? 0.15 : 0.35));
      s.snackLoad = Math.max(0, s.snackLoad - minutes / 20);
      if (!s.sleeping) {
        s.wasteClock += dt;
        if (s.wasteClock >= 12 * 60) { s.wasteClock -= 12 * 60; s.waste = Math.min(4, s.waste + 1); s.cleanliness = clamp(s.cleanliness - 12); }
      }
      const atRisk = s.fullness < 10 || s.cleanliness < 25;
      s.sickClock = atRisk ? s.sickClock + dt : 0;
      if (!s.sick && s.sickClock >= 300) { s.sick = true; log(s, `${s.name} feels ill. Clean up, feed them, and give medicine.`); }
      const needy = s.fullness < 20 || s.happiness < 20 || s.energy < 15 || s.cleanliness < 25 || s.sick;
      s.neglectClock = needy ? s.neglectClock + dt : 0;
      if (!needy) s.neglectNoted = false;
      if (s.neglectClock >= 300 && !s.neglectNoted) { s.misses++; s.neglectNoted = true; log(s, 'A need went unanswered for five minutes. A little care will help.'); }
      const drain = (s.fullness < 10 ? 1.2 : 0) + (s.energy < 5 ? 0.7 : 0) + (s.sick ? 1.4 : 0);
      s.health = clamp(s.health + minutes * (drain ? -drain : s.fullness > 40 && s.cleanliness > 40 ? 0.7 : 0), away ? 10 : 0);
      if (s.health === 0) { s.dead = true; s.sleeping = false; log(s, `${s.name}'s journey ended. Their memories will stay with you.`); }
      s.careTotal += ((s.fullness + s.happiness + s.energy + s.cleanliness + s.health) / 5) * dt;
      s.careTime += dt;
    }
    return { elapsed, capped: raw > MAX_AWAY };
  }
  function available(s) {
    if (s.dead) return 'This journey has ended. You can welcome a new egg.';
    if (s.paused) return 'Resume pet time first.';
    if (s.stage === 'egg') return 'Your egg is still hatching. Just a little patience!';
    if (s.sleeping) return 'Your pal is asleep. Wake them before caring for them.';
    return null;
  }
  function act(s, action, now = Date.now()) {
    advance(s, now);
    if (action === 'pause') { s.paused = !s.paused; return { ok: true, message: s.paused ? 'Pet time paused. All needs and growth are on hold.' : 'Welcome back! Pet time resumed.' }; }
    if (action === 'sound') { s.sound = !s.sound; return { ok: true, message: `Sounds ${s.sound ? 'on' : 'off'}.` }; }
    if (action === 'sleep' && s.sleeping && !s.paused && !s.dead) { s.sleeping = false; return { ok: true, message: 'Good morning, little pal!' }; }
    const blocked = available(s); if (blocked) return { ok: false, message: blocked };
    let message;
    if (action === 'meal' || action === 'veggie') {
      if (s.fullness > 85) return { ok: false, message: 'Still full! Save the next meal for later.' };
      if (action === 'veggie' && s.coins < 3) return { ok: false, message: 'You need 3 coins. The rice bowl is always free.' };
      if (action === 'veggie') { s.coins -= 3; s.health = clamp(s.health + 8); }
      s.fullness = clamp(s.fullness + 28); s.happiness = clamp(s.happiness + 3); s.meals++; s.goals.meal = true;
      message = action === 'meal' ? 'A warm rice bowl. A happy little tummy.' : 'Crunchy greens! A little boost for health.';
    } else if (action === 'snack') {
      if (s.coins < 6) return { ok: false, message: 'A berry treat costs 6 coins.' };
      if (s.snackLoad >= 2) return { ok: false, message: 'Enough treats for now. Try a proper meal or a game.' };
      s.coins -= 6; s.happiness = clamp(s.happiness + 20); s.fullness = clamp(s.fullness + 8); s.snackLoad++;
      message = 'A sweet treat! Games are another way to bring a smile.';
    } else if (action === 'clean') {
      if (s.cleanliness > 95 && !s.waste) return { ok: false, message: 'Already sparkling! Check back after a little playtime.' };
      s.cleanliness = 100; s.waste = 0; s.goals.clean = true; message = 'All clean. Home feels lovely again.';
    } else if (action === 'medicine') {
      if (!s.sick) return { ok: false, message: 'Your pal is healthy. No medicine needed.' };
      s.sick = false; s.sickClock = 0; s.health = clamp(s.health + 25); message = 'Feeling better! Keep their tummy full and room clean.';
      log(s, 'A dose of medicine helped them feel better.');
    } else if (action === 'sleep') { s.sleeping = true; message = 'Lights out. Energy recovers gradually, even while you are away.';
    } else if (action === 'pet') {
      if (s.age - s.lastPet < 20) return { ok: false, message: 'Feeling loved. Give them a moment before the next cuddle.' };
      s.lastPet = s.age; s.happiness = clamp(s.happiness + 5); s.affection++; message = 'A tiny cuddle, a big smile. ♡';
    } else return { ok: false, message: 'Unknown care action.' };
    return { ok: true, message };
  }
  function beginGame(s, now = Date.now()) {
    advance(s, now); const blocked = available(s);
    if (blocked) return { ok: false, message: blocked };
    if (s.sick) return { ok: false, message: 'Your pal feels ill. Medicine and a little care come first.' };
    if (s.energy < 15 || s.fullness < 10) return { ok: false, message: 'A meal and a rest first. Playing needs 15 energy and 10 fullness.' };
    s.energy = clamp(s.energy - 8); s.fullness = clamp(s.fullness - 4);
    return { ok: true };
  }
  function rewardGame(s, game, score, now = Date.now()) {
    advance(s, now);
    // The UI owns a one-use session; abandoned games never survive reloads.
    if (s.dead || s.stage === 'egg' || s.paused) return { coins: 0, message: 'Pet time changed. Start a fresh game.' };
    const max = game === 'memory' ? 6 : 5, earned = Math.floor(clamp(score, 0, max)) * 4;
    s.coins += earned; s.happiness = clamp(s.happiness + (earned ? 8 + score * 3 : 2)); s.games++;
    if (score >= Math.ceil(max / 2)) s.goals.game = true;
    log(s, `${game === 'memory' ? 'Memory Garden' : 'Higher or Lower'}: ${score}/${max}, ${earned} coins earned.`);
    return { coins: earned, message: earned ? `Lovely playtime! You earned ${earned} coins.` : 'Good practice! Try another round when you feel ready.' };
  }
  function buy(s, id) {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return { ok: false, message: 'That item is unavailable.' };
    if (!s.owned.includes(id)) {
      if (s.coins < item.cost) return { ok: false, message: `You need ${item.cost} coins for ${item.name}.` };
      s.coins -= item.cost; s.owned.push(id); log(s, `Made home a little sweeter with ${item.name}.`);
    }
    s[item.type] = id; return { ok: true, message: `${item.name} equipped.` };
  }
  function claim(s, now = Date.now()) {
    goals(s, now); const g = s.goals;
    if (g.claimed || !g.meal || !g.clean || !g.game) return { ok: false, message: 'Finish all three little goals first.' };
    g.claimed = true; s.coins += 20; log(s, 'Three little acts of care. Earned the daily 20-coin bonus.');
    return { ok: true, message: 'A lovely day together. +20 coins!' };
  }
  function nextGeneration(s, now = Date.now(), force = false) {
    if (!force && !s.dead && (s.stage !== 'adult' || s.age < THRESHOLDS[4] + 7200)) return null;
    const previous = { ...s, paused: false };
    previous.history = [{ name: s.name, form: s.form, generation: s.generation, age: s.age, dead: s.dead }, ...s.history].slice(0, 12);
    return fresh(now, previous);
  }
  function restore(data, now = Date.now()) {
    if (!data || typeof data !== 'object' || data.version !== VERSION || typeof data.name !== 'string' || typeof data.age !== 'number' || !Number.isFinite(data.age) || typeof data.lastUpdate !== 'number' || !Number.isFinite(data.lastUpdate)) return null;
    const s = fresh(now); s.name = data.name.trim().slice(0, 20) || 'Mochi';
    for (const k of ['fullness', 'happiness', 'energy', 'cleanliness', 'health']) s[k] = finite(data[k], s[k], 0, 100);
    for (const k of ['age', 'coins', 'wasteClock', 'sickClock', 'neglectClock', 'snackLoad', 'careTotal', 'careTime', 'misses', 'meals', 'games', 'affection']) s[k] = finite(data[k], s[k]);
    s.age = finite(data.age, 0, 0, 365 * 86400); s.lastPet = finite(data.lastPet, -100, -100, s.age);
    s.generation = Math.floor(finite(data.generation, 1, 1, 99999)); s.waste = Math.floor(finite(data.waste, 0, 0, 4));
    s.lastUpdate = finite(data.lastUpdate, now, 0, now);
    s.stage = STAGES[THRESHOLDS.reduce((n, t, i) => s.age >= t ? i : n, 0)];
    s.form = s.stage === 'adult' ? (Object.hasOwn(FORMS, data.form) ? data.form : 'cloud') : null;
    for (const k of ['sleeping', 'sick', 'paused', 'sound', 'neglectNoted']) s[k] = data[k] === true;
    s.dead = data.dead === true || s.health === 0;
    if (s.dead || s.stage === 'egg') s.sleeping = false;
    s.owned = Array.isArray(data.owned) ? [...new Set(['meadow', 'none', ...data.owned.filter(id => ITEMS.some(i => i.id === id))])] : ['meadow', 'none'];
    for (const [key, fallback] of [['room', 'meadow'], ['hat', 'none']]) s[key] = s.owned.includes(data[key]) && ITEMS.some(i => i.id === data[key] && i.type === key) ? data[key] : fallback;
    s.discoveries = Array.isArray(data.discoveries) ? [...new Set(data.discoveries.filter(k => Object.hasOwn(FORMS, k)))] : [];
    if (s.form && !s.discoveries.includes(s.form)) s.discoveries.push(s.form);
    s.journal = Array.isArray(data.journal) ? data.journal.filter(j => j && typeof j.text === 'string').slice(0, 24).map(j => ({ age: finite(j.age, 0), text: j.text.slice(0, 200) })) : s.journal;
    s.history = Array.isArray(data.history) ? data.history.filter(h => h && typeof h.name === 'string').slice(0, 12).map(h => ({ name: h.name.slice(0, 20), form: Object.hasOwn(FORMS, h.form) ? h.form : null, generation: Math.floor(finite(h.generation, 1)), age: finite(h.age, 0), dead: h.dead === true })) : [];
    if (data.goals && data.goals.day === dayKey(now)) { s.goals.day = data.goals.day; for (const k of ['meal', 'clean', 'game', 'claimed']) s.goals[k] = data.goals[k] === true; }
    return s;
  }
  root.PocketPal = { VERSION, SAVE_KEY, MAX_AWAY, STAGES, THRESHOLDS, FORMS, ITEMS, fresh, advance, act, beginGame, rewardGame, buy, claim, nextGeneration, restore, log, dayKey, clamp };
})(globalThis);
