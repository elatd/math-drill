# Japanese Math Drill

An unofficial English localization of [Dopa Drill (ドパドリル)](https://github.com/grmchn/dopa-drill) by gear_machine.

A math drill where every problem you solve makes the show and the music build up a little more. It runs entirely in the browser.

The mascot, Dopakichi, carries each digit you type into place and celebrates when you get it right. The further you go, the more the screen and the sound pile on, until it turns into a full-blown festival. Mistakes never kill the momentum, and there is no game over.

## Features

- 58 calculation skills for grades 1–6, based on Japan's national curriculum guidelines: addition, subtraction, multiplication and division, entering the working of column methods and long division, decimals, fractions, percentages and more
- "My Level" mode: it starts from a skill check and unlocks the next skills as you master them
- Grade drills, Practice, Review and a Skill Tree
- Solving every problem scores 100 points. With a first-try rate of 80% or more, a timed Extra round lets you go past 100
- All music and sound effects are synthesized with the Web Audio API (no audio files)
- Works on phones in portrait and on PCs. On a PC you can also play with the number keys and Backspace
- The strength of the motion effects can be adjusted in Settings, and sound can be muted
- A round back button at the top left of the play screen returns to the title (after a confirmation)
- English by default, with the original Japanese one tap away in Settings
- Everything is saved on the device (localStorage); nothing is sent anywhere

## Languages

English is the default. The globe menu at the top of **Settings** switches to Japanese (日本語) and back. The choice is remembered on the device, so `/` opens the last language picked.

The Japanese version is the original Dopa Drill (ドパドリル) itself, kept in `app/ja/` exactly as it is in the original repository. The only additions are:

- the language menu
- the back button on the play screen, with slightly tighter spacing in that header row
- fonts rebuilt with the two characters of 言語 added (every other glyph is unchanged)

Both versions share the same save data, so progress carries over when you switch. The language choice is stored apart from the game data, so **Reset everything** leaves it as it is.

`/en/` always opens the English version and `/ja/` always opens the Japanese version. `/?lang=en` and `/?lang=ja` override the saved choice when opening `/`.

## About this localization

- In English mode, all on-screen text, problems, hints, trophies and collection items are in US English, and so are `docs/SPEC.md` and `docs/curriculum.md`.
- Grades follow Japan's curriculum, which does not always match other countries (for example, the times tables are Grade 2).
- Some things were adapted rather than translated word for word:
  - Problems read in English order: "10 is 3 and 7", "1/4 of 12 = 3", "25% of 200 = 50", "GCF of 12 and 18 = 6", "Round 34567 to the nearest 100".
  - Remainders are written "R" (17 ÷ 5 = 3 R 2), and mixed numbers "2 1/3".
  - The Dopa counter counts up with English number names (thousand, million, billion…) instead of the Japanese units 万 and 億.
  - The logo reads "Japanese Math Drill".
  - Big one-line banners shrink to fit narrow screens.
  - The English version has its own font subsets, about a quarter of the size of the Japanese ones.
- The original repository is configured as the `upstream` remote, so later changes can be fetched with `git fetch upstream`.

## Playing locally

No build step is needed. Serve `app/` as static files:

```bash
python3 -m http.server 8000 -d app
```

Then open `http://localhost:8000/en/` in a browser (`http://localhost:8000/ja/` for the Japanese version). The root URL redirects to the saved language, or English by default. The game uses ES modules, so opening the file directly with `file://` does not work.

## Tests

Requires Node.js 20 or later.

```bash
node --test tests/*.test.mjs
```

## Layout

| Path | Contents |
| --- | --- |
| `app/en/` | The game in English (ES modules, no dependencies) |
| `app/ja/` | The original Japanese game, with the language menu and the back button added |
| `docs/SPEC.md` | Specification |
| `docs/curriculum.md` | Skills by grade and the design of the skill tree |
| `docs/dopakichi.svg` | The master drawing of Dopakichi |
| `tests/` | Unit tests |
| `tools/build_fonts.sh` | Regenerates the font subsets of both versions (run it after changing on-screen text) |

## License

- Source code: MIT License
- The character "Dopakichi" and the "Dopa Drill" name and logo are not covered by the MIT License. They may be used freely in non-commercial fan works (see below).
- Fonts (`app/en/fonts/` and `app/ja/fonts/`): SIL Open Font License 1.1

See [LICENSE](LICENSE) for details.

### Fan works with Dopakichi and Dopa Drill

This summarizes the original author's terms. If it differs from the English text in [LICENSE](LICENSE), LICENSE prevails.

For non-commercial purposes, you may use them freely without asking.

- Allowed: fan art, comics, stories, animation, videos, social media posts, and publishing non-commercial forks or modified versions of this game
- Gameplay videos and live streams: free, including on platforms with ad revenue or tipping
- Needs permission first: commercial use, such as selling goods or works or using them in paid products, services or advertising; using them as the name, mascot or brand of another product or service; presenting your work as official
- Not allowed: offensive uses, or uses that harm the reputation of the characters or of this project

When you publish something, make it clear that it is unofficial.
