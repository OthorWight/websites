(() => {
    'use strict';
    const C = window.SudokuCore;
    const $ = id => document.getElementById(id);
    const KEY = 'sudoku-studio-v2';
    const blank = () => Array(81).fill(0);
    const clone = value => JSON.parse(JSON.stringify(value));
    const cells = [], pad = [];
    let game, selected = 0, generating = false, notesMode = false, editorTool = 'givens';
    let draftCells = new Set(), pendingAction, analysis;
    let cageDrag = null, suppressCageClickUntil = 0;
    let settings = { autoNotes: false, singles: false, conflicts: true };
    let undo = [], redo = [];
    let timerTicks = 0;

    if (!C) {
        message('The Sudoku engine could not load. Keep sudoku-core.js beside this page and reload.', 'error');
        document.querySelectorAll('button, input, select').forEach(control => { control.disabled = true; });
        return;
    }

    function message(text, type = '') { $('status-message').textContent = text; $('status-message').className = type; }
    function save() {
        if (!game) return;
        try {
            localStorage.setItem(KEY, JSON.stringify({ version: 2, game, selected, notesMode, settings, undo: undo.slice(-50), redo: redo.slice(-50) }));
        } catch { $('save-status').textContent = 'Saving is unavailable. Keep this tab open to retain progress.'; }
    }
    function validNotes(notes) { return Array.isArray(notes) && notes.length === 81 && notes.every(n => Number.isInteger(n) && n >= 0 && n <= C.ALL && !(n & ~C.ALL)); }
    function validSnapshot(snapshot, currentGame) {
        return snapshot && C.validBoard(snapshot.values) && validNotes(snapshot.notes) && Array.isArray(snapshot.cages) && !C.validateCages(snapshot.cages, false) &&
            (currentGame.editing || (JSON.stringify(snapshot.cages) === JSON.stringify(currentGame.cages) && currentGame.givens.every((n, i) => !n || snapshot.values[i] === n)));
    }
    function restore() {
        try {
            const stored = JSON.parse(localStorage.getItem(KEY)), g = stored?.game;
            if (stored?.version !== 2 || !g || !['standard', 'killer'].includes(g.mode) || !['easy', 'normal', 'hard', 'expert', 'custom'].includes(g.difficulty) ||
                !C.validBoard(g.givens) || !C.validBoard(g.values) || !validNotes(g.notes) || typeof g.editing !== 'boolean' ||
                !Number.isSafeInteger(g.elapsed) || g.elapsed < 0 || !Array.isArray(g.cages) || C.validateCages(g.cages, g.mode === 'killer' && !g.editing) ||
                (g.mode === 'standard' && g.cages.length)) return false;
            if (!g.editing && (!C.solved(g.solution, g.cages) || g.givens.some((n, i) => n && (g.solution[i] !== n || g.values[i] !== n)))) return false;
            game = g;
            selected = Number.isInteger(stored.selected) && stored.selected >= 0 && stored.selected < 81 ? stored.selected : 0;
            notesMode = stored.notesMode === true;
            for (const key of Object.keys(settings)) if (typeof stored.settings?.[key] === 'boolean') settings[key] = stored.settings[key];
            undo = Array.isArray(stored.undo) ? stored.undo.slice(-50).filter(s => validSnapshot(s, g)) : [];
            redo = Array.isArray(stored.redo) ? stored.redo.slice(-50).filter(s => validSnapshot(s, g)) : [];
            return true;
        } catch { return false; }
    }
    function snapshot() { return { values: [...game.values], notes: [...game.notes], cages: clone(game.cages) }; }
    function record() { undo.push(snapshot()); if (undo.length > 100) undo.shift(); redo = []; }
    function applySnapshot(value) { game.values = value.values; game.notes = value.notes; game.cages = value.cages; draftCells.clear(); render(); save(); }
    function undoMove() {
        if (generating || !undo.length) return;
        redo.push(snapshot()); applySnapshot(undo.pop()); message('Move undone.'); focusCell();
    }
    function redoMove() {
        if (generating || !redo.length) return;
        undo.push(snapshot()); applySnapshot(redo.pop()); message('Move restored.'); focusCell();
    }
    function cageMap() {
        const mapping = Array(81).fill(-1);
        game.cages.forEach((cage, id) => cage.cells.forEach(i => { mapping[i] = id; }));
        return mapping;
    }
    function buildBoard() {
        for (let r = 0; r < 9; r++) {
            const row = document.createElement('div'); row.className = 'grid-row'; row.setAttribute('role', 'row');
            for (let c = 0; c < 9; c++) {
                const index = r * 9 + c;
                const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'cell'; cell.dataset.index = index;
                cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-rowindex', r + 1); cell.setAttribute('aria-colindex', c + 1); cell.tabIndex = index ? -1 : 0;
                cell.innerHTML = '<span class="cage-border" hidden></span><span class="cage-total"></span><span class="value"></span><span class="notes-grid"></span>';
                for (let n = 1; n <= 9; n++) { const note = document.createElement('span'); note.className = 'note'; note.textContent = n; note.hidden = true; cell.lastElementChild.append(note); }
                cell.addEventListener('click', event => selectCell(index, true, event.shiftKey));
                cell.addEventListener('focus', () => { if (game && selected !== index && !generating) selectCell(index, false); });
                row.append(cell); cells.push(cell);
            }
            $('sudoku-grid').append(row);
        }
        for (let n = 1; n <= 9; n++) {
            const button = document.createElement('button'); button.className = 'num-btn'; button.dataset.number = n;
            button.innerHTML = `${n}<small>9 left</small>`;
            button.addEventListener('click', () => { enterDigit(n); focusCell(); });
            $('number-pad').append(button); pad.push(button);
        }
    }
    function focusCell() { if (!generating && game) cells[selected].focus({ preventScroll: true }); }
    function drawingCages() { return game?.editing && game.mode === 'killer' && editorTool === 'cages' && !generating; }
    function beginCageDrag(event) {
        const cell = event.target.closest('.cell');
        if (!drawingCages() || !cell || !event.isPrimary || event.button !== 0 || cageDrag) return;
        event.preventDefault();
        const index = Number(cell.dataset.index);
        cageDrag = { pointerId: event.pointerId, start: index, x: event.clientX, y: event.clientY, moved: false, additive: event.shiftKey, previous: new Set(draftCells), total: $('cage-total').value };
        selectCell(index, true, event.shiftKey);
        // Document listeners also finish drags if pointer capture is unavailable.
        try { $('sudoku-grid').setPointerCapture(event.pointerId); } catch {}
    }
    function moveCageDrag(event) {
        if (!cageDrag || event.pointerId !== cageDrag.pointerId || !drawingCages()) return;
        event.preventDefault();
        const grid = $('sudoku-grid'), size = cells[0].getBoundingClientRect();
        const steps = Math.max(1, Math.ceil(Math.hypot(event.clientX - cageDrag.x, event.clientY - cageDrag.y) / (Math.min(size.width, size.height) / 2)));
        for (let step = 1; step <= steps; step++) {
            const x = cageDrag.x + (event.clientX - cageDrag.x) * step / steps;
            const y = cageDrag.y + (event.clientY - cageDrag.y) * step / steps;
            const cell = document.elementFromPoint(x, y)?.closest('.cell');
            if (!cell || !grid.contains(cell)) continue;
            const index = Number(cell.dataset.index);
            if (index !== cageDrag.start && !cageDrag.moved) {
                cageDrag.moved = true;
                draftCells = new Set(cageDrag.additive ? cageDrag.previous : []);
                draftCells.add(cageDrag.start); $('cage-total').value = '';
            }
            if (cageDrag.moved) draftCells.add(index);
            selected = index;
        }
        cageDrag.x = event.clientX; cageDrag.y = event.clientY;
        render();
    }
    function endCageDrag(event) {
        if (!cageDrag || event.pointerId !== cageDrag.pointerId) return;
        if (event.type === 'pointerup') moveCageDrag(event);
        else { draftCells = cageDrag.previous; $('cage-total').value = cageDrag.total; }
        cageDrag = null;
        suppressCageClickUntil = performance.now() + 400;
        const grid = $('sudoku-grid');
        if (grid.hasPointerCapture(event.pointerId)) grid.releasePointerCapture(event.pointerId);
        render(); save();
        if (event.type === 'pointerup') {
            if (event.pointerType === 'touch' && draftCells.size) { $('cage-total').focus(); $('cage-total').select(); }
            else focusCell();
        }
    }
    function selectCell(index, clicked, additive = false) {
        if (generating || !game) return;
        selected = index;
        if (clicked && game.editing && editorTool === 'cages') {
            if (!additive) { draftCells.clear(); $('cage-total').value = ''; }
            if (!draftCells.size) $('cage-total').value = '';
            const cage = game.cages.find(c => c.cells.includes(index));
            if (cage) { draftCells = new Set(cage.cells); $('cage-total').value = cage.sum; }
            else if (draftCells.has(index)) draftCells.delete(index);
            else draftCells.add(index);
        }
        render(); save();
    }
    function highlightSingles() {
        const singles = Array(81).fill(0);
        if (!settings.singles || !analysis.valid) return singles;
        for (let i = 0; i < 81; i++) if (!game.values[i] && C.digits(analysis.masks[i]).length === 1) singles[i] |= analysis.masks[i];
        for (const unit of C.units) for (let n = 1; n <= 9; n++) {
            if (unit.some(i => game.values[i] === n)) continue;
            const slots = unit.filter(i => !game.values[i] && (analysis.masks[i] & (1 << n)));
            if (slots.length === 1) singles[slots[0]] |= 1 << n;
        }
        return singles;
    }
    function renderBoard() {
        const mapping = cageMap(), currentCage = mapping[selected], singles = highlightSingles();
        const selectedValue = game.values[selected], peers = new Set(C.peers[selected]);
        $('sudoku-grid').classList.toggle('killer', game.mode === 'killer');
        $('sudoku-grid').classList.toggle('drawing-cages', drawingCages());
        $('sudoku-grid').setAttribute('aria-multiselectable', drawingCages() ? 'true' : 'false');
        cells.forEach((cell, i) => {
            const value = game.values[i], given = !game.editing && !!game.givens[i], id = mapping[i], cage = game.cages[id];
            cell.disabled = generating;
            cell.className = 'cell';
            for (const [name, condition] of [['given', given], ['peer', peers.has(i)], ['same', value && value === selectedValue], ['in-cage', id >= 0 && id === currentCage], ['selected', i === selected], ['draft-selected', game.editing && draftCells.has(i)], ['conflict', settings.conflicts && analysis.conflicts.has(i)]]) if (condition) cell.classList.add(name);
            cell.tabIndex = i === selected ? 0 : -1;
            cell.setAttribute('aria-selected', (drawingCages() ? draftCells.has(i) : i === selected) ? 'true' : 'false');
            cell.setAttribute('aria-readonly', given ? 'true' : 'false');
            cell.querySelector('.value').textContent = value || '';
            const border = cell.querySelector('.cage-border'); border.hidden = !cage;
            if (cage) {
                // Extend straight cage edges through adjoining cells, with an inset only at outer corners.
                const top = i >= 9 && mapping[i - 9] === id, bottom = i < 72 && mapping[i + 9] === id;
                const left = i % 9 > 0 && mapping[i - 1] === id, right = i % 9 < 8 && mapping[i + 1] === id;
                border.style.borderTopWidth = top ? '0' : '1px'; border.style.borderBottomWidth = bottom ? '0' : '1px';
                border.style.borderLeftWidth = left ? '0' : '1px'; border.style.borderRightWidth = right ? '0' : '1px';
                border.style.top = top ? '-1px' : ''; border.style.bottom = bottom ? '-1px' : '';
                border.style.left = left ? '-1px' : ''; border.style.right = right ? '-1px' : '';
            }
            cell.querySelector('.cage-total').textContent = cage && i === Math.min(...cage.cells) ? cage.sum : '';
            const notes = settings.autoNotes && !game.editing ? analysis.masks[i] : game.notes[i];
            cell.querySelectorAll('.note').forEach((note, k) => { note.hidden = !!value || !(notes & (1 << (k + 1))); note.classList.toggle('single', !!(singles[i] & (1 << (k + 1)))); });
            cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${value || 'empty'}${given ? ', given' : ''}${cage ? ', cage total ' + cage.sum : ''}${analysis.conflicts.has(i) && settings.conflicts ? ', conflict' : ''}${!value && notes ? ', notes ' + C.digits(notes).join(', ') : ''}`);
        });
    }
    function renderCagePanel() {
        $('cage-panel').hidden = game.mode !== 'killer' || game.editing;
        if (game.mode !== 'killer' || game.editing) return;
        const id = cageMap()[selected], cage = game.cages[id];
        $('cage-combinations').replaceChildren();
        if (!cage) { $('cage-detail').textContent = 'Select a cell to inspect its cage.'; $('cage-progress').textContent = ''; return; }
        const total = cage.cells.reduce((n, i) => n + game.values[i], 0), remaining = cage.cells.filter(i => !game.values[i]).length;
        $('cage-title').textContent = `${cage.sum} in ${cage.cells.length} ${cage.cells.length === 1 ? 'cell' : 'cells'}`;
        $('cage-detail').textContent = remaining ? `${total} entered · ${cage.sum - total} remaining across ${remaining} empty ${remaining === 1 ? 'cell' : 'cells'}.` : total === cage.sum && !analysis.conflicts.size ? 'Cage complete.' : `Total entered: ${total}.`;
        const options = analysis.cageOptions[id] || [];
        $('cage-progress').textContent = options.length ? `${options.length} possible digit ${options.length === 1 ? 'combination' : 'combinations'}${options.length > 40 ? ' · first 40 shown' : ''}` : 'No combination fits. Check this cage and nearby entries.';
        options.slice(0, 40).forEach(mask => { const span = document.createElement('span'); span.className = 'combination'; span.textContent = C.digits(mask).join(' + '); $('cage-combinations').append(span); });
    }
    function renderEditor() {
        $('editor-panel').hidden = !game.editing;
        $('editor-cage-tools').hidden = game.mode !== 'killer';
        $('editor-instructions').textContent = game.mode === 'killer' ? 'Enter printed digits, then draw cages to match your puzzle.' : 'Enter the printed digits. Empty cells stay editable when play begins.';
        $('edit-givens').setAttribute('aria-pressed', editorTool === 'givens'); $('edit-cages').setAttribute('aria-pressed', editorTool === 'cages');
        $('cage-selection').textContent = draftCells.size ? `${draftCells.size} ${draftCells.size === 1 ? 'cell' : 'cells'} selected · type the total, then Enter.` : 'Drag across connected cells, type the total, then press Enter. Shift-click adds individual cells.';
        const covered = game.cages.reduce((n, cage) => n + cage.cells.length, 0);
        $('cage-coverage').textContent = `${covered} / 81 cells in cages · ${81 - covered} uncovered`;
    }
    function render() {
        if (!game) return;
        analysis = C.analyze(game.values, game.cages);
        renderBoard(); renderCagePanel(); renderEditor();
        const complete = !game.editing && C.solved(game.values, game.cages);
        $('filled-count').textContent = `${game.values.filter(Boolean).length} / 81`;
        $('timer').textContent = `${Math.floor(game.elapsed / 60).toString().padStart(2, '0')}:${(game.elapsed % 60).toString().padStart(2, '0')}`;
        $('puzzle-label').textContent = `${game.mode === 'killer' ? 'Killer' : 'Standard'} · ${game.editing ? 'Editor' : game.difficulty === 'custom' ? 'Your puzzle' : game.difficulty[0].toUpperCase() + game.difficulty.slice(1)}${complete ? ' · Solved' : ''}`;
        $('mode-guide').textContent = game.mode === 'killer' ? 'Each dashed cage adds up to its total with no repeated digits. Every row, column, and 3×3 box uses 1–9 once.' : 'Every row, column, and 3×3 box contains the digits 1–9 once.';
        $('standard-mode').setAttribute('aria-pressed', game.mode === 'standard'); $('killer-mode').setAttribute('aria-pressed', game.mode === 'killer');
        for (const [id, key] of [['auto-notes-toggle', 'autoNotes'], ['bold-hidden-singles-toggle', 'singles'], ['show-conflicts-toggle', 'conflicts']]) $(id).checked = settings[key];
        $('notes-btn').setAttribute('aria-pressed', notesMode);
        for (const id of ['new-game-btn', 'standard-mode', 'killer-mode', 'difficulty', 'enter-puzzle-btn', 'validate-puzzle', 'edit-givens', 'edit-cages', 'add-cage', 'remove-cage', 'clear-cage-selection', 'cage-total']) $(id).disabled = generating;
        for (const id of ['hint-btn', 'check-btn']) $(id).disabled = generating || game.editing || complete;
        $('undo-btn').disabled = generating || !undo.length; $('redo-btn').disabled = generating || !redo.length;
        $('notes-btn').disabled = generating || game.editing || complete; $('erase-btn').disabled = generating || (game.editing && editorTool === 'cages');
        pad.forEach((button, k) => { const n = k + 1, remaining = Math.max(0, 9 - game.values.filter(v => v === n).length); button.querySelector('small').textContent = `${remaining} left`; button.disabled = generating || complete || (game.editing && editorTool === 'cages'); button.setAttribute('aria-label', `Enter ${n}, ${remaining} remaining`); });
    }
    function enterDigit(n) {
        if (!game || generating || (game.editing && editorTool === 'cages')) return;
        if (!game.editing && game.givens[selected]) return message('This digit is a fixed given.');
        if (!game.editing && C.solved(game.values, game.cages)) return;
        if (!game.editing && notesMode && n) {
            if (game.values[selected]) return message('Erase the digit before adding pencil notes.');
            if (settings.autoNotes) return message('Turn off Auto notes to edit your own pencil notes.');
            record(); game.notes[selected] ^= 1 << n;
        } else {
            const value = n && game.values[selected] === n ? 0 : n;
            if (value === game.values[selected] && !game.notes[selected]) return;
            record(); game.values[selected] = value; game.notes[selected] = 0;
            // Preserve manual notes elsewhere so undo and later corrections do not lose them.
        }
        render(); save();
        if (!game.editing && C.solved(game.values, game.cages)) message(`Solved! Active time ${$('timer').textContent}.`, 'success');
        else if (settings.conflicts && analysis.conflicts.size) message('There is a repeated digit or a cage that cannot reach its total.', 'error');
        else message(game.editing ? 'Enter the puzzle, then Validate & play.' : notesMode ? 'Pencil notes are on.' : '');
    }
    function toggleNotes() { if (generating || game?.editing) return; notesMode = !notesMode; render(); save(); message(notesMode ? 'Pencil notes are on.' : 'Digit entry is on.'); focusCell(); }
    function replacement(action) {
        if (generating) return;
        const changed = game && (game.editing || game.values.some((n, i) => n !== game.givens[i]) || game.notes.some(Boolean));
        if (changed && (game.editing || !C.solved(game.values, game.cages))) { pendingAction = action; $('confirm-dialog').showModal(); }
        else action();
    }
    async function newPuzzle(mode = game?.mode || 'standard', difficulty = $('difficulty').value) {
        if (generating) return;
        generating = true; draftCells.clear();
        if (game) render();
        message(`Preparing ${mode === 'killer' ? 'Killer' : 'Standard'} puzzle…`);
        try {
            const puzzle = await C.generate(mode, difficulty, { progress: text => message(text) });
            game = { ...puzzle, values: [...puzzle.givens], notes: blank(), elapsed: 0, editing: false };
            undo = []; redo = []; notesMode = false; selected = game.values.findIndex(n => !n); if (selected < 0) selected = 0;
            generating = false; render(); save(); focusCell();
            message(`One solution verified. ${mode === 'killer' ? game.givens.filter(Boolean).length + ' givens · ' + game.cages.length + ' cages · select a cage to inspect its combinations.' : 'Select an empty cell to begin.'}`);
        } catch (error) { generating = false; if (game) render(); message('Could not generate this puzzle. Try New puzzle again.', 'error'); console.error(error); }
    }
    function startEditor() {
        const mode = game?.mode || 'standard';
        game = { mode, difficulty: 'custom', givens: blank(), values: blank(), notes: blank(), cages: [], solution: [], elapsed: 0, editing: true };
        selected = 0; notesMode = false; editorTool = 'givens'; draftCells.clear(); undo = []; redo = [];
        render(); save(); focusCell(); message(mode === 'killer' ? 'Enter printed digits, then choose Draw cages.' : 'Enter the printed digits, then Validate & play.');
    }
    function editorMode(tool) { if (!game?.editing || generating) return; editorTool = tool; draftCells.clear(); render(); focusCell(); }
    function addCage() {
        if (!game?.editing || generating || game.mode !== 'killer') return;
        const cage = { sum: Number($('cage-total').value), cells: [...draftCells].sort((a, b) => a - b) };
        const error = C.validateCages([...game.cages, cage], false);
        if (error) return message(error, 'error');
        record(); game.cages.push(cage); draftCells.clear(); $('cage-total').value = '';
        render(); save(); message('Cage added. Drag across the next cage, type its total, then Enter.'); focusCell();
    }
    function removeCage() {
        if (!game?.editing || generating) return;
        const ids = game.cages.map((cage, id) => cage.cells.some(i => draftCells.has(i)) ? id : -1).filter(id => id >= 0);
        if (!ids.length) return message('Select a cell in an existing cage first.');
        record(); game.cages = game.cages.filter((_, id) => !ids.includes(id)); draftCells.clear(); $('cage-total').value = ''; render(); save(); message('Cage removed.'); focusCell();
    }
    async function validatePuzzle() {
        if (!game?.editing || generating) return;
        if (game.mode === 'killer') { const error = C.validateCages(game.cages); if (error) return message(error, 'error'); }
        if (!C.analyze(game.values, game.cages).valid) return message('These givens or cage totals conflict. Correct them before starting.', 'error');
        generating = true; render(); message('Checking the puzzle for exactly one solution…');
        await new Promise(resolve => setTimeout(resolve, 20));
        const result = C.solve(game.values, game.cages, { maxNodes: 150000, timeout: 1800 });
        generating = false;
        if (result.exhausted) { render(); return message('Uniqueness could not be verified within the time limit. Add more givens or smaller cages.', 'error'); }
        if (result.count !== 1) { render(); return message(result.count ? 'This puzzle has multiple solutions. Add more givens or tighter cages.' : 'This puzzle has no solution. Check the givens and cage totals.', 'error'); }
        game.solution = result.solution; game.givens = [...game.values]; game.editing = false; game.notes = blank(); game.elapsed = 0;
        undo = []; redo = []; draftCells.clear(); editorTool = 'givens';
        selected = game.values.findIndex(n => !n); if (selected < 0) selected = 0;
        render(); save(); focusCell(); message('One solution verified. Your puzzle is ready.', 'success');
    }
    function checkPuzzle() {
        if (!game || game.editing || generating) return;
        const wrong = game.values.map((n, i) => n && n !== game.solution[i] ? i : -1).filter(i => i >= 0);
        if (wrong.length) { selected = wrong[0]; render(); focusCell(); message(`${wrong.length} ${wrong.length === 1 ? 'entry differs' : 'entries differ'} from the solution. First incorrect cell selected.`, 'error'); }
        else message(C.solved(game.values, game.cages) ? 'Puzzle solved!' : 'All entered digits are correct so far.', 'success');
    }
    function hint() {
        if (!game || game.editing || generating || C.solved(game.values, game.cages)) return;
        const wrong = game.values.findIndex((n, i) => n && n !== game.solution[i]);
        if (wrong >= 0) { selected = wrong; render(); focusCell(); return message('Correct this entry before using a hint.', 'error'); }
        const logical = C.singleHint(game.values, analysis);
        const index = logical ? logical.index : !game.values[selected] ? selected : game.values.findIndex(n => !n);
        record(); selected = index; game.values[index] = logical ? logical.digit : game.solution[index]; game.notes[index] = 0;
        render(); save(); focusCell(); message(C.solved(game.values, game.cages) ? 'Solved! You can undo this hint.' : logical ? logical.reason + ' Digit filled; Undo reverses the hint.' : 'No single-step hint was available. One solution digit revealed; Undo reverses it.', 'success');
    }

    buildBoard();
    $('sudoku-grid').addEventListener('pointerdown', beginCageDrag);
    document.addEventListener('pointermove', moveCageDrag, { passive: false });
    document.addEventListener('pointerup', endCageDrag);
    document.addEventListener('pointercancel', endCageDrag);
    $('sudoku-grid').addEventListener('lostpointercapture', event => { if (cageDrag) endCageDrag(event); });
    $('sudoku-grid').addEventListener('click', event => {
        if (event.detail && performance.now() < suppressCageClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    $('new-game-btn').addEventListener('click', () => replacement(() => newPuzzle()));
    $('standard-mode').addEventListener('click', () => { if (game?.mode !== 'standard') replacement(() => newPuzzle('standard')); });
    $('killer-mode').addEventListener('click', () => { if (game?.mode !== 'killer') replacement(() => newPuzzle('killer')); });
    $('enter-puzzle-btn').addEventListener('click', () => replacement(startEditor));
    $('notes-btn').addEventListener('click', toggleNotes);
    $('erase-btn').addEventListener('click', () => { enterDigit(0); focusCell(); });
    $('undo-btn').addEventListener('click', undoMove); $('redo-btn').addEventListener('click', redoMove);
    $('hint-btn').addEventListener('click', hint); $('check-btn').addEventListener('click', checkPuzzle);
    $('edit-givens').addEventListener('click', () => editorMode('givens')); $('edit-cages').addEventListener('click', () => editorMode('cages'));
    $('add-cage').addEventListener('click', addCage); $('remove-cage').addEventListener('click', removeCage);
    $('clear-cage-selection').addEventListener('click', () => { draftCells.clear(); $('cage-total').value = ''; render(); focusCell(); });
    $('validate-puzzle').addEventListener('click', validatePuzzle);
    for (const [id, key] of [['auto-notes-toggle', 'autoNotes'], ['bold-hidden-singles-toggle', 'singles'], ['show-conflicts-toggle', 'conflicts']]) $(id).addEventListener('change', () => { settings[key] = $(id).checked; render(); save(); });
    $('help-button').addEventListener('click', () => $('help-dialog').showModal()); $('close-help').addEventListener('click', () => $('help-dialog').close());
    $('cancel-action').addEventListener('click', () => $('confirm-dialog').close());
    $('confirm-dialog').addEventListener('close', () => { pendingAction = undefined; });
    $('confirm-action').addEventListener('click', () => { const action = pendingAction; pendingAction = undefined; $('confirm-dialog').close(); action?.(); });
    document.addEventListener('keydown', event => {
        if (!game || generating || event.isComposing || $('help-dialog').open || $('confirm-dialog').open) return;
        if (drawingCages() && event.target === $('cage-total') && event.key === 'Enter') { event.preventDefault(); addCage(); return; }
        if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redoMove() : undoMove(); return; }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redoMove(); return; }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (drawingCages() && event.target.closest('.cell')) {
            if (/^[0-9]$/.test(event.key) || ['Backspace', 'Delete', 'Enter', 'Escape'].includes(event.key)) {
                event.preventDefault();
                if (event.key === 'Escape') { draftCells.clear(); $('cage-total').value = ''; render(); }
                else if (!draftCells.size) message('Select cage cells first.', 'error');
                else if (event.key === 'Enter') addCage();
                else if (event.key === 'Backspace') $('cage-total').value = $('cage-total').value.slice(0, -1);
                else if (event.key === 'Delete') removeCage();
                else if ($('cage-total').value.length < 2) $('cage-total').value += event.key;
                return;
            }
        }
        if (event.key.startsWith('Arrow')) {
            const r = Math.floor(selected / 9), c = selected % 9;
            const changes = { ArrowUp: Math.max(0, r - 1) * 9 + c, ArrowDown: Math.min(8, r + 1) * 9 + c, ArrowLeft: r * 9 + Math.max(0, c - 1), ArrowRight: r * 9 + Math.min(8, c + 1) };
            if (event.key in changes) { event.preventDefault(); selectCell(changes[event.key], false); focusCell(); }
        } else if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enterDigit(Number(event.key)); focusCell(); }
        else if (['Backspace', 'Delete', '0'].includes(event.key)) { event.preventDefault(); enterDigit(0); focusCell(); }
        else if (event.key.toLowerCase() === 'n') { event.preventDefault(); toggleNotes(); }
    });
    window.addEventListener('pagehide', save);
    setInterval(() => {
        if (!game || generating || game.editing || C.solved(game.values, game.cages) || document.hidden || $('help-dialog').open || $('confirm-dialog').open) return;
        game.elapsed++; timerTicks++;
        $('timer').textContent = `${Math.floor(game.elapsed / 60).toString().padStart(2, '0')}:${(game.elapsed % 60).toString().padStart(2, '0')}`;
        if (timerTicks % 5 === 0) save();
    }, 1000);
    if (restore()) { if (game.difficulty !== 'custom') $('difficulty').value = game.difficulty; render(); message(game.editing ? 'Your puzzle editor is restored.' : C.solved(game.values, game.cages) ? 'Your completed puzzle is saved.' : 'Your progress is restored. Keep going!'); }
    else newPuzzle('standard');
})();
