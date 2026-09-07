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
