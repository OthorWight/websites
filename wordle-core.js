/* Shared, pure Wordle rules. UI and regression checks use the same engine. */
window.WordleCore = Object.freeze({
    score(guess, answer) {
        const result = Array(5).fill('absent');
        const remaining = {};
        for (let i = 0; i < 5; i++) {
            if (guess[i] === answer[i]) result[i] = 'correct';
            else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
        }
        for (let i = 0; i < 5; i++) {
            if (result[i] !== 'correct' && remaining[guess[i]] > 0) {
                result[i] = 'present';
                remaining[guess[i]]--;
            }
        }
        return result;
    },
    candidates(answers, history) {
        // Replaying feedback also enforces maximum duplicate counts and gray positions.
        return answers.filter(answer => history.every(entry =>
            this.score(entry.guess, answer).every((status, i) => status === entry.result[i])
        ));
    },
    dictionary(data) {
        if (!data || data.version !== 'nyt-2026-10-11-v1') throw new Error('Missing dictionary');
        for (const [name, count] of [['answers', 3209], ['guesses', 14855]]) {
            const list = data[name];
            if (!Array.isArray(list) || list.length !== count || new Set(list).size !== count ||
                list.some(word => !/^[A-Z]{5}$/.test(word))) throw new Error('Invalid dictionary');
        }
        const allowed = new Set(data.guesses);
        if (data.answers.some(answer => !allowed.has(answer))) throw new Error('Answer missing from guess dictionary');
        return { answers: data.answers, allowed };
    }
});
