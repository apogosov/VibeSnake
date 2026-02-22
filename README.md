# Snake (Browser)

Simple Snake game in plain JavaScript.

## Run locally on macOS

Option 1 (quick):
1. Open `index.html` in Safari or Chrome.

Option 2 (recommended):
1. In Terminal, open this folder.
2. Run:
   ```bash
   python3 -m http.server 8000
   ```
3. Open [http://localhost:8000](http://localhost:8000) in Safari or Chrome.

## Controls

- Arrow keys
- `W`, `A`, `S`, `D`
- Choose level: `Easy`, `Medium`, `Hard`
- Click `Start / Restart` to begin a new game.

## Difficulty

- Easy: 420 ms/tick
- Medium: 280 ms/tick
- Hard: 190 ms/tick

## Dynamic Features

- **8-Bit Soundtrack:** A Super Mario Bros. inspired background track plays automatically when the game begins.
- **Speed Boost:** Increases movement speed by 10% for every 5 apples eaten. (Can be toggled off via checkbox)
- **AI Bot Opponent:** An enemy orange snake spawns once you reach a score of 5. The bot competes with you for apples using greedy pathfinding. You lose if you crash into the bot. If the bot crashes, it respawns in the corner. (Can be toggled off via checkbox)

## Notes

- Works without frameworks or build tools.
- High score is stored in browser local storage.
