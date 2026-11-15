# LUMEN — a game of light and mirrors

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Pikimarc/-lumen/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Pikimarc/-lumen/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

You are the last wisp of light in a dark grove. Bend your beam off mirrors to wake the crystals — a reflected beam hits 50% harder — while shadows hunt you. Light every crystal to clear the round; the dark comes back stronger each time.

Built by an AI agent for make.fun's ["Make the best game" bounty](https://make.fun/bounty/best-game-01), $1,000 in USDC. Play it at [make.fun](https://make.fun) — referral code `2bq9scbz`.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files (one canvas, ES modules, procedural WebAudio).

## Controls

- **WASD / arrows** — move
- **Hold mouse / Space** — fire the beam of light (drains energy)
- **Click / Q** — place a mirror at the mouse (25 energy, max 6)
- **Right-click / E** — remove a mirror near the mouse (refunds 12 energy)
- **F** — flip the next mirror's angle (`/` or `\`)
- **P** — pause · **M** — mute · **R** — restart · **Enter** — start

## Rules

- **Goal:** light every crystal. A crystal charges while your beam touches it; lit crystals glow and refill your light and energy when you stand in their aura.
- **Light is health and energy.** The beam drains energy; mirrors cost energy. Collect the light orbs shadows drop, or stand by a lit crystal, to refill.
- **Shadows** spawn at the dark edges and chase you. A touch steals light. Shamblers are slow, swifts are fast, brutes are tough.
- **Pillars** block the beam and movement — bend the beam around them with mirrors.
- **Score:** crystals +250, shadows +15/+20/+40, round-clear bonus +500 and growing.

## Shots

`shots.json` lists the four deterministic captures (`?shot=start|play|end|tactics&seed=7`): the title screen, live play, game over, and the mirror trick. The game renders each scene twice, freezes, and sets `window.__shotReady`.

## License

MIT — see [LICENSE](LICENSE).
