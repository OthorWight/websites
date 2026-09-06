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
