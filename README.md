# Websites Collection

This project contains several HTML games and tools.  
To easily access them, run the included Python script (`serve_and_open.py`).  
The script will start a local web server and open the main website in your browser, where you can navigate to all the other pages.

## How to Use

Visit https://othorwight.github.io/websites/

Or

1. Make sure you have Python installed.
2. Run: python serve_and_open.py
3. Your default browser will open the main page automatically.

Enjoy!

## Wordle Practice

Open `Wordle.html` from the index, or open it directly in a browser. Keep its companion `wordle.css`, `wordle.js`, `wordle-core.js`, and `wordle-words.js` files alongside it. The game works without fetching a remote dictionary. It offers unlimited random puzzles, saved progress and statistics on this device, optional hints, and shareable results.

The accepted-guess dictionary contains **14,855 words from the current NYT Wordle game bundle, verified October 11, 2026**. It also exactly matches [cfreshman’s published March 6, 2026 snapshot](https://gist.github.com/cfreshman/8b92bc418b43096094cf5d1b0eea8f84). Words newer than the original dictionary, such as `AAPAS` and `ADORB`, are accepted.

The **3,209 practice answers** come from the current [WordleBot candidate list mirrored by Wordle Tools](https://wordletools.azurewebsites.net/weightedbottles), fetched October 11, 2026. These are modern potential-answer candidates, including `AIOLI` and `PSHAW`; they are not a complete official future NYT answer schedule. Practice chooses uniformly from this pool. Hints use only this same pool, and every practice answer is present in the accepted-guess dictionary. The shared `words.txt` is preserved for the other games.

`wordle-dictionary.json` records both source URLs, snapshot dates, raw-source hashes, and normalized word-list SHA-256 checksums. The bundled lists match those checksums exactly. Normalization sorts lowercase words alphabetically and joins them with newlines, with no final newline. No hand-picked additions or silent fallback list is used. The clone works offline with this dated snapshot; it does not silently update at runtime or claim to follow the NYT daily puzzle. To refresh it, retrieve both sources, verify five-letter ASCII entries, uniqueness and answer inclusion, regenerate the bundled lists and metadata, update the version/count expectations in the core and checks, then run the regression suite.

Run dictionary integrity and browser regressions with:

```sh
python3 tests/check_wordle.py
```

This needs Python 3 and an installed Chromium or Chrome browser, with no npm or third-party Python dependencies. It uses an isolated temporary browser profile and a temporary localhost server. It verifies every dictionary entry against the pinned source checksums, checks repeated-letter feedback against 20,000 independent reference evaluations, and exercises hints, invalid guesses, rapid input, saved progress, wins, losses, reveal/restart dialogs, and result copying.
