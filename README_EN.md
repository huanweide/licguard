**中文** · [README.md](./README.md)

> [!WARNING]
> **⚠️ This axis has been merged into the [doctors](https://github.com/huanweide/doctors) family monorepo and is no longer maintained here.**
>
> The source now lives at [`doctors/packages/licguard/`](https://github.com/huanweide/doctors/tree/main/packages/licguard). Inside doctors it runs as the `doctors lic` subcommand (or `node packages/licguard/index.js`). This repository no longer accepts changes — please use <https://github.com/huanweide/doctors>.

<!-- badges -->
[![License](https://img.shields.io/github/license/huanweide/licguard)](LICENSE)
[![Stars](https://img.shields.io/github/stars/huanweide/licguard)](https://github.com/huanweide/licguard/stargazers)
[![Engineering Health Family](https://img.shields.io/badge/Engineering%20Health%20Family-18%20axes-22c55e)](https://github.com/huanweide/family-showcase)
<!-- /badges -->

**🔧 Part of the [Engineering Health Family](https://github.com/huanweide/family-showcase)** (18 zero-dependency checkup axes). Standalone tool — see [doctors](https://github.com/huanweide/doctors) (monorepo) and [enghealth](https://github.com/huanweide/enghealth) (unified runner).

> English: not yet provided

# licguard

Zero-dependency Node CLI: scans dependency licenses, identifies **GPL/AGPL strong copyleft** and unknown licenses, and can gate CI as a compliance check.

## Who should use this

- Teams shipping proprietary/closed-source software that must avoid strong-copyleft contamination.
- Anyone who wants a one-command license inventory with a CI compliance gate.
- Projects that want to know "how many viral licenses am I carrying" before release.

## Who should not use this

- If you already run a full SBOM / license tool (e.g. license-checker with full policy) and its output is enough.
- Note: this repo is deprecated — prefer `doctors lic` for new setups.

## Why you need it

The hundreds of packages you installed with one `npm install` may hide a **GPL/AGPL landmine** — once your project is judged a derivative work, you may be forced to open-source all your source. `licguard` turns "how many contagious licenses does my project have" into one command and a colorful table — like [`idiot-index`](https://github.com/huanweide/idiot-index) weighs dependency bloat, it weighs your dependencies' "legal weight".

## Install and run

```bash
git clone https://github.com/huanweide/licguard
cd licguard
node index.js .          # zero dependencies: no npm install needed
```

> Requires Node 18+.

## Usage

```bash
node index.js .                     # scan current project deps, colorful table
node index.js . --json                # JSON output for CI parsing
node index.js . --fail-on strong      # exit 2 on any GPL/AGPL (CI gate)
node index.js . --max 0               # zero tolerance for any high-risk / unknown license
node index.js . --no-color            # disable color, pipe-friendly
node index.js . --allow-missing       # allow deps that are "declared but not installed"
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | scan basis complete, and no gate hit |
| 2 | gate hit / parameter error / target dir unusable |
| 3 | **scan basis incomplete**: the root `package.json` declared deps but they aren't installed, so no trustworthy conclusion can be drawn |

## Why exit code 3 exists

Old versions only scanned `node_modules`. In a clean CI clone, `node_modules` doesn't exist at all, so it scanned **0 packages**, the summary was all zeros, **exit code 0** — a loud "compliance passed" that actually checked nothing.

Now `licguard` also reads the four dependency fields of the root `package.json`:

```
dependencies / devDependencies / optionalDependencies / peerDependencies
```

Packages that are declared but not present are listed as `not installed`, counted as `unknown` in the summary, and make the process exit `3`. The fix is simple: **run `npm ci` first**, or explicitly add `--allow-missing` to accept that blind spot.

Sources like `workspace:` / `file:` / `link:` / `git+` / `github:` are not counted as "not installed".

## More tools by the same author

> The author builds a series of open-source productivity tools; a star to support is welcome:

- 📚 Long-form writing — AI novel workshop, local rule engine, zero-dependency: [visit](https://github.com/huanweide/novel-smith)
- 🎓 Course assistant — auto play/resume/AI-answer for Zhihuishu: [visit](https://github.com/huanweide/zhihuishu-helper)
- 🎬 Subtitles/video — one-click Bilibili subtitle extraction (zero-key official subtitles): [visit](https://github.com/huanweide/bili-subtitle-universal)
- 📺 Live subtitles — real-time subtitles for live/meetings: [visit](https://github.com/huanweide/live-subtitle)
- ✂️ Video summary — one-click long-video summarization: [visit](https://github.com/huanweide/video-brief)
- 🖥️ Overview — all the author's open-source projects: [visit](https://github.com/huanweide/family-showcase)
- 🩺 Code health — zero-dependency multi-axis static checkup: [visit](https://github.com/huanweide/doctors)

## License categories

| Category | Meaning | Examples |
|---|---|---|
| permissive | safe | MIT / ISC / Apache / BSD |
| weak | caution | LGPL / MPL / EPL |
| strong | high risk (may require open-sourcing the whole) | GPL / AGPL / EUPL |
| unknown | needs human confirmation | no license / UNLICENSED / private / declared-but-not-installed |

SPDX expressions (`MIT OR Apache-2.0`, `(MIT) AND GPL-3.0`) take the **strictest** token for classification — compliance-conservative. LGPL must be matched before GPL (`LGPL-3.0` is weak, not strong); this ordering in the classifier must not be reversed.

## JSON output

```json
{
  "scanned": 2,
  "installed": 1,
  "notInstalled": 1,
  "basisComplete": false,
  "summary": { "permissive": 1, "weak": 0, "strong": 0, "unknown": 1 },
  "packages": [ ... ]
}
```

`basisComplete` is the switch for CI to judge "can this conclusion be trusted?".

## CI integration

```yaml
- run: npm ci                    # key: install deps first
- run: node licguard/index.js . --fail-on strong
```

## Relationship with idiot-index

`idiot-index` checks whether dependencies are "fat" (redundant / over-engineered); `licguard` checks whether dependencies are "clean" (legal contagion risk) — together they're the **dependency-checkup twins**.

## Develop

```bash
node --test test.js         # unit tests
node scripts/smoke-cli.js   # end-to-end smoke (real subprocess + exit-code contract)
```

## License

MIT, see [LICENSE](LICENSE).

## Author

Maintained by **huanweide** · [GitHub](https://github.com/huanweide)
