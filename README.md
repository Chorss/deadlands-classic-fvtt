# Deadlands Classic — Community Edition

[![Foundry VTT Compatible](https://img.shields.io/badge/Foundry%20VTT-V14-informational?style=flat-square)](https://foundryvtt.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/Chorss/deadlands-classic-fvtt?style=flat-square)](https://github.com/Chorss/deadlands-classic-fvtt/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/Chorss/deadlands-classic-fvtt?style=flat-square)](https://github.com/Chorss/deadlands-classic-fvtt/issues)

> *"There's a reason they call it the Weird West, amigo. The Devil's been real busy since Gettysburg — and someone's gotta stop him."*

A community-maintained Foundry VTT game system for **Deadlands Classic** (Weird West, 1876). Born from the ashes of two abandoned projects, this Community Edition rebuilds the full Classic experience on modern Foundry VTT V14+ APIs.

> **Scope note (v1):** This release targets **Deadlands Classic only**. *Hell on Earth Classic* and *Lost Colony Classic* are deferred to v2+ and will ship as companion modules rather than folded into core.

---

## Features

- **Exploding Dice (Aces)** — Roll maximum on any die? Pick it up and roll again, partner.
- **Dice Pools with Take-Highest** — Trait rolls keep the single best exploded die, not a sum.
- **Poker-Card Initiative** — Draw from a 54-card Action Deck (52 + 2 Jokers) for dramatic, unpredictable turn order. Suit tiebreakers, Red Joker bonus, Black Joker backlash.
- **Fate Chips (White / Red / Blue / Legend)** — Four-color chip economy drawn blind from a shared Fate Pot. Legend chips are the only way to reroll a Bust.
- **Location-Based Wounds** — 8 hit locations (Noggin, Upper/Lower Guts, Gizzards, both Arms, both Legs) rolled on 1d20 with 5 severity tiers (Light → Maimed).
- **Wind** — Secondary stamina pool driving fatigue, fear and non-lethal damage.
- **Arcane Backgrounds:**
  - **Huckster** — hexslingers drawing power from the Hunting Grounds via poker-hand resolution
  - **Shaman** — walking the spirit path, bargaining for favors with fetishes
  - **Blessed** — faith powers, Conviction-driven miracles
  - **Mad Scientist** — theory → blueprint → construction, with reliability checks on use
- **Harrowed Overlay** — Any PC can come back from the dead. Harrowed is an overlay applicable to *any* archetype, not a separate actor type.
- **Full Actor Support** — Cowboys, Hucksters, Shamans, Blessed, Mad Scientists, NPCs and Mooks.
- **Core Item Types** — Weapons, Armor, Gear, Edges, Hindrances, Ammo. (Archetype-specific items — Hexes, Miracles, Favors, Gizmos — registered by their archetype modules.)
- **Localization** — English and Polish supported from v0.1.

---

## Screenshots

> *Screenshots coming soon. Want to help? Submit a PR with a screenshot of the system in action!*

---

## Installation

### Method 1: Foundry Package Browser (Recommended)

1. Open Foundry VTT and navigate to **Game Systems**.
2. Click **Install System**.
3. In the **Manifest URL** field, paste:
   ```
   https://github.com/Chorss/deadlands-classic-fvtt/releases/latest/download/system.json
   ```
4. Click **Install** and wait for completion.

### Method 2: Manual Installation

1. Download the latest release `.zip` from the [Releases page](https://github.com/Chorss/deadlands-classic-fvtt/releases).
2. Extract the archive into your Foundry VTT `Data/systems/` directory.
3. The folder must be named `deadlands-classic`.
4. Restart Foundry VTT.

---

## Compatibility

| Foundry VTT Version | Status        |
|---------------------|---------------|
| V14                 | Supported     |
| V13                 | Not supported |
| V12 and below       | Not supported |

V14 requires **Node.js 24**. No backwards-compatibility shims are shipped for earlier versions — V13→V14 breaking changes (ApplicationV2, `documentTypes`, typed `ActiveEffect` fields) make a dual-target system impractical.

---

## Acknowledgements

This project stands on the shoulders of giants. Deep gratitude to:

- **[Dulux-Oz](https://github.com/Dulux-Oz)** — Author of the original [DeadlandsClassic](https://github.com/Dulux-Oz/DeadlandsClassic) system. This project would not exist without their foundational work.
- **[RhombusWeasel](https://github.com/RhombusWeasel)** — Author of the alternative [Deadlands-Classic](https://github.com/RhombusWeasel/Deadlands-Classic) implementation and inspiration for several mechanics.
- All original contributors to both upstream projects.
- The Foundry VTT developer community for documentation and support.

---

## Contributing

We welcome contributions of all kinds — code, bug reports, documentation, translations, and playtesting feedback.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full details on how to get involved.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for the full text.

Deadlands Classic, Hell on Earth Classic, and Lost Colony Classic are trademarks of [Pinnacle Entertainment Group](https://peginc.com/). This is an unofficial, fan-made project and is not affiliated with or endorsed by Pinnacle Entertainment Group.
