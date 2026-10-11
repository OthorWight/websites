/* Pure Sudoku constraints, bounded solver, and uniquely solvable puzzle generation. */
(() => {
    'use strict';
    const ALL = 0x3fe;
    const digits = mask => Array.from({ length: 9 }, (_, i) => i + 1).filter(n => mask & (1 << n));
    const count = mask => { let n = 0; for (; mask; mask &= mask - 1) n++; return n; };
    const sum = mask => digits(mask).reduce((a, b) => a + b, 0);
    const sums = Array.from({ length: 1024 }, (_, mask) => sum(mask));
    const units = [];
    for (let n = 0; n < 9; n++) {
        units.push(Array.from({ length: 9 }, (_, c) => n * 9 + c));
        units.push(Array.from({ length: 9 }, (_, r) => r * 9 + n));
        units.push(Array.from({ length: 9 }, (_, k) => (Math.floor(n / 3) * 3 + Math.floor(k / 3)) * 9 + n % 3 * 3 + k % 3));
    }
    const peers = Array.from({ length: 81 }, (_, i) => [...new Set(units.filter(unit => unit.includes(i)).flat())].filter(j => j !== i));
    const neighbors = i => [i - 9, i + 9, ...(i % 9 ? [i - 1] : []), ...(i % 9 < 8 ? [i + 1] : [])].filter(j => j >= 0 && j < 81);
    const validBoard = board => Array.isArray(board) && board.length === 81 && board.every(n => Number.isInteger(n) && n >= 0 && n <= 9);
    function connected(cells) {
        const allowed = new Set(cells), reached = new Set([cells[0]]), queue = [cells[0]];
        for (let k = 0; k < queue.length; k++) for (const i of neighbors(queue[k])) if (allowed.has(i) && !reached.has(i)) { reached.add(i); queue.push(i); }
        return reached.size === allowed.size;
    }
    const combinationCache = new Map();
    function combinations(size, total) {
        const key = `${size},${total}`;
        if (!combinationCache.has(key)) combinationCache.set(key, Array.from({ length: 512 }, (_, mask) => mask << 1).filter(mask => count(mask) === size && sums[mask] === total));
        return combinationCache.get(key);
    }
    function validateCages(cages, requireCoverage = true) {
        if (!Array.isArray(cages) || cages.length > 81) return 'Invalid cage list.';
        const used = new Set();
        for (const cage of cages) {
            if (!cage || !Array.isArray(cage.cells) || cage.cells.length < 1 || cage.cells.length > 9 ||
                cage.cells.some(i => !Number.isInteger(i) || i < 0 || i >= 81) || new Set(cage.cells).size !== cage.cells.length) return 'A cage must have 1–9 different cells.';
            if (!connected(cage.cells)) return 'Cage cells must connect along their edges.';
            if (cage.cells.some(i => used.has(i))) return 'Cages cannot overlap.';
            if (!Number.isInteger(cage.sum) || !combinations(cage.cells.length, cage.sum).length) return 'That total cannot be made with distinct digits in this cage.';
            cage.cells.forEach(i => used.add(i));
        }
        if (requireCoverage && used.size !== 81) return `Add cages for the ${81 - used.size} uncovered cells.`;
        return '';
    }
    function analyze(board, cages = []) {
        const masks = Array(81).fill(0), conflicts = new Set(), cageOptions = [];
        if (!validBoard(board)) return { masks, conflicts, cageOptions, valid: false };
        for (const unit of units) {
            const locations = {};
            for (const i of unit) if (board[i]) (locations[board[i]] ||= []).push(i);
            for (const list of Object.values(locations)) if (list.length > 1) list.forEach(i => conflicts.add(i));
        }
        for (let i = 0; i < 81; i++) if (!board[i]) {
            let used = 0;
            for (const j of peers[i]) if (board[j]) used |= 1 << board[j];
            masks[i] = ALL & ~used;
        }
        for (const cage of cages) {
            let used = 0, remaining = cage.sum, duplicate = false;
            const empty = [];
            for (const i of cage.cells) {
                if (!board[i]) empty.push(i);
                else { const bit = 1 << board[i]; duplicate ||= !!(used & bit); used |= bit; remaining -= board[i]; }
            }
            // Dynamic programming over digit subsets. This handles 9-cell cages without enumerating 9! permutations.
            const prefix = [new Set([0])];
            for (const i of empty) {
                const next = new Set();
                for (const mask of prefix.at(-1)) for (const n of digits(masks[i] & ~used & ~mask)) {
                    const combined = mask | (1 << n);
                    if (sums[combined] <= remaining) next.add(combined);
                }
                prefix.push(next);
            }
            let viable = new Set([...prefix.at(-1)].filter(mask => sums[mask] === remaining));
            cageOptions.push(duplicate ? [] : [...viable].map(mask => mask | used));
            if (duplicate || !viable.size) {
                cage.cells.forEach(i => conflicts.add(i));
                empty.forEach(i => { masks[i] = 0; });
                continue;
            }
            for (let k = empty.length - 1; k >= 0; k--) {
                const previous = new Set();
                let supported = 0;
                for (const mask of prefix[k]) for (const n of digits(masks[empty[k]] & ~used & ~mask)) {
                    if (viable.has(mask | (1 << n))) { supported |= 1 << n; previous.add(mask); }
                }
                masks[empty[k]] &= supported;
                viable = previous;
            }
        }
        const valid = conflicts.size === 0 && board.every((n, i) => n || masks[i]);
        return { masks, conflicts, cageOptions, valid };
    }
    function singleHint(board, analysis) {
        for (let i = 0; i < 81; i++) if (!board[i] && count(analysis.masks[i]) === 1) return { index: i, digit: digits(analysis.masks[i])[0], reason: 'Only one digit fits this cell.' };
        for (const unit of units) for (let n = 1; n <= 9; n++) {
            if (unit.some(i => board[i] === n)) continue;
            const slots = unit.filter(i => !board[i] && (analysis.masks[i] & (1 << n)));
            if (slots.length === 1) return { index: slots[0], digit: n, reason: `This is the only place for ${n} in its row, column, or box.` };
        }
        return null;
    }
    function solve(input, cages = [], { limit = 2, maxNodes = 100000, timeout = 1500 } = {}) {
        if (!validBoard(input) || (cages.length && validateCages(cages))) return { count: 0, solution: null, exhausted: false, nodes: 0 };
        let found = 0, solution = null, nodes = 0, exhausted = false;
        const deadline = performance.now() + timeout;
        function search(board) {
            if (found >= limit || exhausted) return;
            if (++nodes > maxNodes || performance.now() > deadline) { exhausted = true; return; }
            let analysis;
            for (;;) {
                analysis = analyze(board, cages);
                if (!analysis.valid) return;
                const hint = singleHint(board, analysis);
                if (!hint) break;
                board[hint.index] = hint.digit;
                if (performance.now() > deadline) { exhausted = true; return; }
            }
            let best = -1, fewest = 10;
            for (let i = 0; i < 81; i++) if (!board[i] && count(analysis.masks[i]) < fewest) { best = i; fewest = count(analysis.masks[i]); }
            if (best === -1) { found++; solution ||= [...board]; return; }
            for (const n of digits(analysis.masks[best])) {
                const branch = [...board]; branch[best] = n; search(branch);
                if (found >= limit || exhausted) return;
            }
        }
        search([...input]);
        return { count: found, solution, exhausted, nodes };
    }
    function shuffle(values, random = Math.random) {
        const array = [...values];
        for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
        return array;
    }
    function fullGrid(random = Math.random) {
        const order = () => shuffle([0, 1, 2], random).flatMap(band => shuffle([0, 1, 2], random).map(i => band * 3 + i));
        const rows = order(), cols = order(), numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
        return rows.flatMap(r => cols.map(c => numbers[(r * 3 + Math.floor(r / 3) + c) % 9]));
    }
    async function generate(mode, difficulty, { random = Math.random, progress = () => {}, budget = 4500 } = {}) {
        if (!['standard', 'killer'].includes(mode) || !['easy', 'normal', 'hard', 'expert'].includes(difficulty)) throw new Error('Invalid puzzle settings');
        const solution = fullGrid(random), started = performance.now();
        const pause = () => new Promise(resolve => setTimeout(resolve, 0));
        if (mode === 'standard') {
            const target = { easy: 45, normal: 36, hard: 29, expert: 25 }[difficulty];
            const givens = [...solution];
            for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k), random)) {
                if (givens.filter(Boolean).length <= target || performance.now() - started > budget) break;
                const value = givens[i]; givens[i] = 0;
                const result = solve(givens, [], { timeout: 50, maxNodes: 5000 });
                if (result.count !== 1 || result.exhausted) givens[i] = value;
                progress(`${givens.filter(Boolean).length} clues · checking uniqueness`);
                await pause();
            }
            return { mode, difficulty, solution, givens, cages: [] };
        }
        let cages = solution.map((n, i) => ({ sum: n, cells: [i] }));
        const target = { easy: 44, normal: 36, hard: 30, expert: 27 }[difficulty];
        const maxSize = { easy: 3, normal: 4, hard: 5, expert: 6 }[difficulty];
        const empty = Array(81).fill(0);
        const declined = new Set();
        for (let attempt = 0; attempt < 180 && cages.length > target && performance.now() - started < budget; attempt++) {
            const mapping = Array(81);
            cages.forEach((cage, id) => cage.cells.forEach(i => { mapping[i] = id; }));
            const pairs = new Map();
            for (let i = 0; i < 81; i++) for (const j of neighbors(i)) {
                const a = Math.min(mapping[i], mapping[j]), b = Math.max(mapping[i], mapping[j]);
                if (a !== b) pairs.set(`${a},${b}`, [a, b]);
            }
            const choices = shuffle([...pairs.values()], random).filter(([a, b]) => {
                const cells = [...cages[a].cells, ...cages[b].cells];
                return cells.length <= maxSize && new Set(cells.map(i => solution[i])).size === cells.length && !declined.has([...cells].sort((x, y) => x - y).join(','));
            }).sort(([a, b], [c, d]) => cages[a].cells.length + cages[b].cells.length - cages[c].cells.length - cages[d].cells.length);
            if (!choices.length) break;
            const [a, b] = choices[0];
            const merged = { sum: cages[a].sum + cages[b].sum, cells: [...cages[a].cells, ...cages[b].cells].sort((x, y) => x - y) };
            const candidate = cages.filter((_, id) => id !== a && id !== b).concat([merged]);
            const result = solve(empty, candidate, { timeout: 50, maxNodes: 1500 });
            if (result.count === 1 && !result.exhausted) cages = candidate;
            else declined.add(merged.cells.join(','));
            progress(`${cages.length} cages · checking uniqueness`);
            await pause();
        }
        cages.sort((a, b) => a.cells[0] - b.cells[0]);
        const clueCount = { easy: 24, normal: 16, hard: 10, expert: 5 }[difficulty];
        // Prefer clues in larger cages: a one-cell cage already reveals its digit.
        const clueCells = [
            ...shuffle(cages.filter(cage => cage.cells.length > 1).flatMap(cage => cage.cells), random),
            ...shuffle(cages.filter(cage => cage.cells.length === 1).flatMap(cage => cage.cells), random)
        ].slice(0, clueCount);
        const givens = Array(81).fill(0);
        clueCells.forEach(i => { givens[i] = solution[i]; });
        return { mode, difficulty, solution, givens, cages };
    }
    function solved(board, cages = []) { return validBoard(board) && board.every(Boolean) && analyze(board, cages).valid; }
    window.SudokuCore = Object.freeze({ ALL, digits, units, peers, neighbors, validBoard, validateCages, combinations, analyze, singleHint, solve, fullGrid, generate, solved });
})();
