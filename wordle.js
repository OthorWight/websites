/* Unlimited practice: all state stays on this device. No daily-puzzle dependency. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const storageKey = 'wordle-practice-v2';
    const statuses = ['correct', 'present', 'absent'];
    const statusLabels = { correct: 'right spot', present: 'wrong spot', absent: 'no unused copy' };
    const priority = { absent: 1, present: 2, correct: 3 };
    const rows = [];
    const keys = {};
    let dictionary;
    let game;
    let stats = { played: 0, won: 0, streak: 0 };
    let isRevealing = false;
    let pendingAction;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function message(text, type = '') {
        $('message-area').textContent = text;
        $('message-area').className = type;
    }
    function history() {
        return game.guesses.map(guess => ({ guess, result: WordleCore.score(guess, game.answer) }));
    }
    function save() {
        try {
            localStorage.setItem(storageKey, JSON.stringify({ dictionaryVersion: WORDLE_WORDS.version, game, stats }));
        } catch {
            $('save-status').textContent = 'Saving is unavailable in this browser. Keep this tab open to retain progress.';
        }
    }
    function restore() {
        try {
            const stored = JSON.parse(localStorage.getItem(storageKey));
            if (!stored || stored.dictionaryVersion !== WORDLE_WORDS.version) return;
            const s = stored.stats;
            if (s && ['played', 'won', 'streak'].every(key => Number.isSafeInteger(s[key]) && s[key] >= 0) &&
                s.won <= s.played && s.streak <= s.won) stats = s;
            const g = stored.game;
            if (!g || !dictionary.answers.includes(g.answer) || !Array.isArray(g.guesses) || g.guesses.length > 6 ||
                g.guesses.some(guess => !dictionary.allowed.has(guess)) || typeof g.input !== 'string' ||
                !/^[A-Z]{0,5}$/.test(g.input) || !['playing', 'won', 'lost', 'revealed'].includes(g.status)) return;
            // Reject inconsistent/corrupt saves instead of restoring an unplayable board.
            if (g.guesses.slice(0, -1).includes(g.answer)) return;
            const won = g.guesses.at(-1) === g.answer;
            const expected = won ? 'won' : g.guesses.length === 6 ? 'lost' : 'playing';
            if (g.status !== expected && !(expected === 'playing' && g.status === 'revealed')) return;
            if (g.status !== 'playing' && g.input !== '') return;
            game = { answer: g.answer, guesses: g.guesses, input: g.input, status: g.status };
        } catch {
            // Unavailable storage and invalid JSON must not prevent playing.
        }
    }
    function newGame() {
        const pool = dictionary.answers;
        // Avoid immediately repeating the previous puzzle without biasing other choices.
        const choices = game ? pool.filter(answer => answer !== game.answer) : pool;
        game = { answer: choices[Math.floor(Math.random() * choices.length)], guesses: [], input: '', status: 'playing' };
        hideHints();
        $('share-fallback').hidden = true;
        save();
        render();
        message('Find the five-letter word.');
    }
    function buildBoard() {
        for (let i = 0; i < 6; i++) {
            const row = document.createElement('div');
            row.className = 'grid-row';
            row.setAttribute('role', 'group');
            row.setAttribute('aria-label', `Guess ${i + 1}`);
            const cells = [];
            for (let j = 0; j < 5; j++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.setAttribute('role', 'img');
                cell.setAttribute('aria-label', `Letter ${j + 1}, empty`);
                row.append(cell);
                cells.push(cell);
            }
            $('grid-container').append(row);
            rows.push(cells);
        }
        ['QWERTYUIOP', 'ASDFGHJKL', ['ENTER', ...'ZXCVBNM', 'BACKSPACE']].forEach(letters => {
            const row = document.createElement('div');
            row.className = 'keyboard-row';
            for (const letter of letters) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'key';
                button.textContent = letter === 'BACKSPACE' ? '⌫' : letter;
                button.setAttribute('aria-label', letter === 'BACKSPACE' ? 'Delete letter' : letter === 'ENTER' ? 'Submit guess' : letter);
                button.dataset.key = letter;
                if (letter.length > 1) button.classList.add('functional');
                button.disabled = true;
                button.addEventListener('click', () => handleKey(letter));
                keys[letter] = button;
                row.append(button);
            }
            $('keyboard-container').append(row);
        });
    }
    function styleCell(cell, letter, status, position) {
        cell.textContent = letter;
        cell.className = 'grid-cell' + (letter ? ' filled' : '') + (status ? ` ${status}` : '');
        cell.setAttribute('aria-label', `Letter ${position + 1}, ${letter || 'empty'}${status ? ', ' + statusLabels[status] : ''}`);
    }
    function renderInput() {
        if (!game || game.status !== 'playing') return;
        rows[game.guesses.length].forEach((cell, i) => {
            styleCell(cell, game.input[i] || '', null, i);
            if (!isRevealing && i === game.input.length) cell.classList.add('active');
        });
    }
    function renderKeyboard() {
        const best = {};
        history().forEach(entry => entry.result.forEach((status, i) => {
            const letter = entry.guess[i];
            if (!best[letter] || priority[status] > priority[best[letter]]) best[letter] = status;
        }));
        for (const [letter, button] of Object.entries(keys)) {
            button.classList.remove(...statuses);
            if (best[letter]) button.classList.add(best[letter]);
            if (letter.length === 1) button.setAttribute('aria-label', `${letter}${best[letter] ? ', ' + statusLabels[best[letter]] : ''}`);
        }
    }
    function renderStats() {
        $('stat-played').textContent = stats.played;
        $('stat-win-rate').textContent = `${stats.played ? Math.round(stats.won / stats.played * 100) : 0}%`;
        $('stat-streak').textContent = stats.streak;
    }
    function updateControls() {
        const playing = game && game.status === 'playing' && !isRevealing;
        for (const button of Object.values(keys)) button.disabled = !playing;
        $('give-up-button').disabled = !playing;
        $('show-possible-button').disabled = !playing;
        $('restart-button').disabled = !dictionary || isRevealing;
        $('guess-counter').textContent = !game || game.status === 'playing'
            ? `Guess ${Math.min((game?.guesses.length || 0) + 1, 6)} of 6` : 'Puzzle complete';
    }
    function renderResult() {
        $('result-container').hidden = game.status === 'playing';
        if (game.status === 'won') $('result-text').textContent = `Solved in ${game.guesses.length} ${game.guesses.length === 1 ? 'guess' : 'guesses'}! The word was ${game.answer}.`;
        else if (game.status !== 'playing') $('result-text').textContent = `The word was ${game.answer}. Try another puzzle!`;
    }
    function render() {
        const entries = history();
        rows.forEach((cells, r) => cells.forEach((cell, c) => styleCell(cell, entries[r]?.guess[c] || '', entries[r]?.result[c], c)));
        renderInput();
        renderKeyboard();
        renderStats();
        renderResult();
        updateControls();
    }
    function countResult() {
        stats.played++;
        if (game.status === 'won') {
            stats.won++;
            stats.streak++;
        } else stats.streak = 0;
    }
    function showOutcome() {
        if (game.status === 'won') message(`You found it: ${game.answer}!`, 'success');
        else if (game.status === 'lost') message(`Out of guesses. The word was ${game.answer}.`);
        else if (game.status === 'revealed') message(`The word was ${game.answer}.`);
        else message('Keep going — use the feedback below.');
    }
    function invalidGuess(text) {
        message(text, 'error');
        const row = rows[game.guesses.length][0].parentElement;
        row.classList.remove('shake');
        void row.offsetWidth;
        row.classList.add('shake');
    }
    function submitGuess() {
        if (game.input.length !== 5) return invalidGuess('Enter five letters.');
        if (!dictionary.allowed.has(game.input)) return invalidGuess('Not in the NYT guess dictionary.');
        const guess = game.input;
        const rowIndex = game.guesses.length;
        const result = WordleCore.score(guess, game.answer);
        isRevealing = true; // Lock input and controls before starting any timers.
        game.guesses.push(guess);
        game.input = '';
        if (guess === game.answer) game.status = 'won';
        else if (game.guesses.length === 6) game.status = 'lost';
        if (game.status !== 'playing') countResult();
        // Save one atomic snapshot, including statistics, before the visual reveal.
        save();
        hideHints();
        updateControls();
        rows[rowIndex].forEach(cell => cell.classList.remove('active'));
        message('Checking your guess…');
        const stagger = reducedMotion ? 0 : 140;
        result.forEach((status, i) => setTimeout(() => {
            const cell = rows[rowIndex][i];
            styleCell(cell, guess[i], status, i);
            cell.classList.add('reveal');
        }, i * stagger));
        setTimeout(() => {
            isRevealing = false;
            render();
            showOutcome();
        }, reducedMotion ? 0 : 4 * stagger + 360);
    }
    function handleKey(key) {
        if (!dictionary || !game || game.status !== 'playing' || isRevealing || $('help-dialog').open || $('confirm-dialog').open) return;
        if (key === 'ENTER') return submitGuess();
        if (key === 'BACKSPACE') game.input = game.input.slice(0, -1);
        else if (/^[A-Z]$/.test(key) && game.input.length < 5) game.input += key;
        else return;
        message('');
        renderInput();
        if (key !== 'BACKSPACE' && game.input.length) rows[game.guesses.length][game.input.length - 1].classList.add('pop');
        save();
    }
    function hideHints() {
        $('possible-words-container').hidden = true;
        $('show-possible-button').textContent = 'Show hints';
        $('show-possible-button').setAttribute('aria-expanded', 'false');
        $('hint-words').replaceChildren();
    }
    function showHints() {
        if (!game || game.status !== 'playing' || isRevealing) return;
        if (!$('possible-words-container').hidden) return hideHints();
        const candidates = WordleCore.candidates(dictionary.answers, history());
        const displayed = candidates.slice(0, 100);
        $('hint-summary').textContent = `${candidates.length} possible ${candidates.length === 1 ? 'answer' : 'answers'}${candidates.length > 100 ? ' · first 100 shown' : ''}. Tap a word to fill your guess.`;
        $('hint-words').replaceChildren();
        displayed.forEach(word => {
            const button = document.createElement('button');
            button.className = 'hint-word';
            button.textContent = word;
            button.setAttribute('aria-label', `Fill guess with ${word}`);
            button.addEventListener('click', () => {
                if (isRevealing || game.status !== 'playing') return;
                game.input = word;
                renderInput();
                message('Press Enter to submit your guess.');
                save();
                hideHints();
                keys.ENTER.focus();
            });
            $('hint-words').append(button);
        });
        $('possible-words-container').hidden = false;
        $('show-possible-button').textContent = 'Hide hints';
        $('show-possible-button').setAttribute('aria-expanded', 'true');
    }
    function confirmAction(action, title, description, label) {
        pendingAction = action;
        $('confirm-title').textContent = title;
        $('confirm-description').textContent = description;
        $('confirm-action').textContent = label;
        $('confirm-dialog').showModal();
    }
    function revealWord() {
        if (!game || game.status !== 'playing' || isRevealing) return;
        game.status = 'revealed';
        game.input = '';
        countResult();
        hideHints();
        save();
        render();
        showOutcome();
    }
    async function shareResult() {
        if (!game || game.status === 'playing') return;
        const symbols = { correct: '🟩', present: '🟨', absent: '⬛' };
        const text = `Wordle Practice ${game.status === 'won' ? game.guesses.length : 'X'}/6${game.status === 'revealed' ? ' (revealed)' : ''}\n\n` +
            history().map(entry => entry.result.map(status => symbols[status]).join('')).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            message('Result copied!', 'success');
        } catch {
            $('share-fallback').value = text;
            $('share-fallback').hidden = false;
            $('share-fallback').focus();
            $('share-fallback').select();
            message('Select and copy your result below.');
        }
    }

    buildBoard();
    $('help-button').addEventListener('click', () => $('help-dialog').showModal());
    $('close-help').addEventListener('click', () => $('help-dialog').close());
    $('cancel-action').addEventListener('click', () => $('confirm-dialog').close());
    $('confirm-dialog').addEventListener('close', () => { pendingAction = undefined; });
    $('confirm-action').addEventListener('click', () => {
        const action = pendingAction;
        pendingAction = undefined;
        $('confirm-dialog').close();
        action?.();
    });
    $('restart-button').addEventListener('click', () => {
        if (!dictionary || isRevealing) return;
        if (game.status === 'playing' && (game.guesses.length || game.input.length)) {
            confirmAction(newGame, 'Start a new puzzle?', 'Your current puzzle will be replaced. It will not count toward your statistics.', 'New game');
        } else newGame();
    });
    $('give-up-button').addEventListener('click', () => {
        if (game?.status === 'playing' && !isRevealing) confirmAction(revealWord, 'Reveal the answer?', 'This ends the puzzle and counts as a loss.', 'Reveal word');
    });
    $('show-possible-button').addEventListener('click', showHints);
    $('share-button').addEventListener('click', shareResult);
    document.addEventListener('keydown', event => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing ||
            event.target.closest('input, textarea, select, [contenteditable="true"]') ||
            $('help-dialog').open || $('confirm-dialog').open) return;
        const key = event.key.toUpperCase();
        if (!/^[A-Z]$/.test(key) && key !== 'ENTER' && key !== 'BACKSPACE') return;
        // Preserve Enter/Space activation on focused controls. On letter keys Enter submits.
        if (key === 'ENTER' && event.target.closest('button') && !event.target.classList.contains('key')) return;
        event.preventDefault();
        handleKey(key);
    });
    try {
        dictionary = WordleCore.dictionary(window.WORDLE_WORDS);
        $('dictionary-count').textContent = `${dictionary.answers.length.toLocaleString('en-US')} practice answers / ${dictionary.allowed.size.toLocaleString('en-US')} guesses`;
        restore();
        if (game) {
            render();
            if (game.status === 'playing') message('Your puzzle is saved. Keep going!');
            else showOutcome();
        } else newGame();
    } catch (error) {
        console.error('Wordle dictionary failed validation:', error);
        message('Dictionary unavailable. Reload the page to try again.', 'error');
        $('save-status').textContent = 'The full dictionary is required to play.';
        dictionary = undefined;
        updateControls();
    }
})();
