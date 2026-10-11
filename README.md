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

## PolyRogue: The Hollow Below

Open `PolyRogue.html` directly or through the local server. This standalone, offline roguelike has five procedural floors, three starting origins (Warden, Delver, and Arcanist), equipment and forging, experience, and permanent level-up choices. Defeat the vault guardian, claim the Heart on depth 5, and return to the surface exit on depth 1. Death ends the expedition.

- **Move:** Arrow keys, numpad, or QWE / ASD / ZXC. S, period, or space waits. Click to move or attack; right-click to inspect. Touch movement buttons appear on narrow screens.
- **Explore / rest:** O or R auto-explores; 5 rests and recharges pulse. Danger interrupts automation; any key stops it. Rest advances enemy turns.
- **Combat / interact:** H drinks a healing potion; F pulses and stuns nearby enemies; G or Enter interacts with stairs, loot, fonts, or the Heart. `<` and `>` use stairs in the selected direction. T follows an explored route toward the next stairs (or the Heart on depth 5) and stops for danger.
- **Equipment / help:** Click an equipment or pack slot for its actions. Use the forge when safe. Press `?` for the field guide. Scroll to zoom; Shift + arrows pans the map.
- **Saving:** Living expeditions autosave in this browser. Use Continue on the title screen or Settings → Save & Quit. A new expedition replaces the current expedition save; old prototype saves remain separately stored and cannot be loaded into the rework.

Taking the Heart begins **the Ascent**. Two golden seal wardens guard each floor’s upward exit, and the Heart reveals their locations on the minimap. Each warden defeated restores 4 health and reduces pulse cooldown by 3 turns. Two reinforcement waves per floor announce their rifts 3 turns before pursuers emerge; waves and defeated wardens persist across saves and revisits. The return becomes more dangerous near the surface. Existing expedition saves work, including runs already carrying the Heart.

Recovery fonts heal 12 health and recharge pulse once; the return journey provides a fresh font if the floor’s original one was spent. The vault guardian telegraphs a shatter attack two turns before hitting its marked area. Each depth has its own materials, lighting, and geometric details. The offline ambient score changes with depth, combat, and the Ascent; music and sound-effect volumes remain independently adjustable in Settings.

Run the gameplay regression checks with `node --test tests/polyrogue.test.cjs` (no packages required).

## Storyteller’s Grimoire

Open `BOTC-StorytellersGrimoire.html` directly, or use the local server above. The Grimoire works offline and includes a September 6, 2026 snapshot of 181 characters, night order, reminder labels, and 131 jinxes from the [official Blood on the Clocktower script tool](https://script.bloodontheclocktower.com/).

- Choose from 11 bundled scripts: the three base editions and all eight scripts linked from the publisher’s current featured, recommended, and Teensyville collections (September 6, 2026 snapshot).
- Use **Browse scripts → Community database** to search the live [BOTC Scripts database](https://www.botcscripts.com/), filter by format, browse result pages, and optionally show all versions. **Use & save script** adds a compatible script to your selector and saves it for offline use. The live catalog requires internet; publisher and previously saved scripts work offline. Homebrew character definitions are listed with a source link but cannot be played in this Grimoire.
- Community scripts retain authors, versions, Bootlegger rules, and custom night orders in game backups and script exports. Switching scripts keeps seated players and updates the listed Fabled/Loric special rules. You can also build a custom script or import a script JSON file.
- Click an empty seat to assign a character, or drag a character from the library. Add Travellers separately; Fabled and Loric characters belong under Special rules.
- Use **Manage** for alignment, seat order, conditions, private notes, and shown or gained characters. Changing an assigned character preserves its alignment; adjust alignment explicitly when needed.
- Click a character’s reminder to choose its target, or drag it onto a seat. Click a placed reminder to remove it.
- Track deaths, remaining dead votes, phases, and night actions. Setup counts show the base distribution before character modifiers. Conditional actions and rules remain the Storyteller’s responsibility.
- Changes save in this browser. Use **Save game** for a JSON backup and **Import** to restore it. **Undo** reverses recent changes; **Hide grimoire** covers the table when sharing a screen.

Run the Grimoire regression checks with `node --test tests/botc-grimoire.test.cjs` (no packages required).

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

## Sudoku Studio

Open `Sudoku.html` directly or through the local server. Keep `sudoku.css`, `sudoku-core.js`, and `sudoku.js` beside it. Standard and Killer Sudoku work offline, with generated puzzles checked for exactly one solution. Difficulty presets adjust clue counts or cage sizes; they are approximate rather than formal technique ratings.

- Choose **Standard** or **Killer**, a difficulty, then **New puzzle**. Killer puzzles start with 24 fixed digits on Easy, 16 on Normal, 10 on Hard, and 5 on Expert. Killer cages use distinct digits that add up to the displayed total, alongside the usual row, column, and box rules. Select a cage to inspect its remaining sum and possible digit combinations.
- Select a cell and type or tap 1–9. Arrow keys move; Delete erases. **Notes** or N toggles pencil marks. **Auto notes** accounts for both Standard constraints and Killer cages; **Highlight singles** emphasizes forced candidates.
- **Undo/Redo** also reverses notes, hints, and cage edits. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes. **Check** reports incorrect entries; **Hint** fills a logical single or reveals one solution digit when no single is available.
- **Enter your own puzzle** supports transcribing Standard or Killer puzzles, including those from an Android game. Enter printed givens; for Killer, use **Draw cages**, drag across connected cells, type the total, and press **Enter**. Clicking a cell starts a fresh selection; Shift-click adds or removes individual cells. You can also use **Add cage**. Backspace corrects the total; Escape clears the selection. **Delete** removes the selected cage; **Undo** restores it. Every cell must belong to one cage. **Validate & play** checks the rules and uniqueness before locking the givens. Select and remove a cage to redraw it.
- Progress, notes, editor work, settings, and recent undo history save in this browser. The timer counts visible play, pausing during editing, generation, and dialogs. There is no mistake limit.

Run the engine and browser regressions with `python3 tests/check_sudoku.py`. This uses Python 3 and installed Chrome or Chromium, without additional packages. It checks uniqueness at every difficulty in both modes, cage candidates against an independent enumeration, custom puzzle validation, keyboard and touch controls, notes, undo, persistence, error recovery, and layouts down to 320 pixels wide.


## Pocket Pal (Tamagochi)

Open `Tamagochi.html` from the index or directly in your browser. Keep `tamagochi.css`, `tamagochi-core.js`, `tamagochi-animations.js`, and `tamagochi.js` beside it. The game works offline without packages or external assets.

Raise an original virtual pet through an egg, baby, child, teen, and adult life. Inspired by [Tamagotchi’s care and growth](https://tamagotchi-official.com/us/series/connection/howto/) and [Pou’s mini-games and customization](https://play.google.com/store/apps/details?id=me.pou.app), it focuses on a living companion rather than incremental upgrades.

- **Care:** Free rice bowls restore fullness. Mini-games and affection improve happiness. Clean the room to remove waste. Sleep gradually restores energy; wake your pal when rested. Medicine is free when illness appears.
- **Play:** Memory Garden has six matching pairs, no timer, and pays 4 coins per pair. Higher or Lower has five rounds using numbers 1–9, no ties, and pays 4 coins per correct guess. Games cost 8 energy and 4 fullness. Closing a game keeps rewards for completed matches or guesses. Coins buy rooms and accessories; there are no passive coin generators.
- **Growth:** Hatch at 20 seconds of pet time, become a child at 8 minutes, a teen at 30 minutes, and an adult at 90 minutes. Care history determines one of four adult forms. Balanced care favors Sunny; other histories favor meals, play, or a resilient Cloud. Five minutes of an unanswered critical need counts as one missed-care episode. Severe neglect while the page is visible can end a pet’s journey.
- **Little performances:** Healthy, awake pals spontaneously wave, hop, dance, tumble, watch a butterfly, or stretch and yawn. An idle performance starts after 20–45 seconds of uninterrupted room time and lasts about 4–8 seconds. Performances stop for care, dialogs, unmet needs, sleep, or pause. Reduced motion uses still poses. The rare “tiny overlord” joke has a 1-in-1,000 chance per performance (at most once per page session), with a theatrical dusk, horns, levitation, and a rice-bowl punchline. All performances are cosmetic and never change health, coins, or care history.
- **Away / pause:** The middle device button pauses needs, growth, and sleep recovery until resumed. Otherwise, time passes while the game is hidden or closed, capped at eight hours per return, with health protected at 10 or above. Sleep restores 6 energy per minute and continues until you wake your pal.
- **Generations:** After two adult hours, send your pal on an adventure and hatch the next egg. After a death, welcome a new egg immediately. Coins, rooms, accessories, discoveries, and today’s goals carry forward, with earlier companions recorded in the album. Settings also allows an explicitly confirmed early restart.
- **Saving:** Progress autosaves in this browser. Settings exports and restores validated JSON backups. If storage is blocked, the current session remains playable and backups can still be exported. The old `tamagochiGameState` save is kept unchanged; the first launch carries its name and between 30 and 200 starting coins into the new game. A malformed new save is copied to `pocket-pal-recovery` before starting fresh.
- **Daily goals:** Share a meal, clean the room, and match at least three pairs or correctly guess at least three rounds. Claim the 20-coin bonus once per device-local calendar day.

Run engine and browser regressions with `python3 tests/check_tamagochi.py`. This needs Python 3 and installed Chrome or Chromium; it uses a temporary localhost server and isolated browser profile with no additional packages. Checks cover care, evolution, illness, death, offline protection, games and rewards, purchases, persistence, invalid saves, blocked storage, keyboard tabs, and layouts down to 320 pixels. The animation checks also verify scheduling, rare-event odds, distinct rendered poses, automatic cleanup, care-state interruptions, and reduced motion. Add `--preview` to capture all seven performances as PNGs in `/tmp`.
