# Cinetor Next — documentation index

Goal: rebuild the approved HTML prototypes (`prototype/`) as real, light apps for **Android phone (APK)**, **Android TV (APK, ultra light)** and **Web (desktop + mobile browsers, iOS included)**. TMDB supplies the metadata and the video is mock video. All builds happen in GitHub Actions, releases go to a public repo, and the apps update themselves.

The work is done by Antigravity CLI (`agy`, Gemini 3.8 Flash) one task at a time, under the rules in `../AGENTS.md`.

## Read in this order

| # | File | What it decides |
|---|---|---|
| 0 | `../AGENTS.md` | Agent rules: no local builds, verify before use, one task per session |
| 1 | `01-product-spec.md` | Every screen and feature per platform (parity with the prototype) |
| 2 | `02-architecture.md` | Stack, allowed dependencies (verified versions), folder layout, core interfaces, multi-ABI |
| 3 | `03-github-setup.md` | Repos, secrets, signing key, Pages (the user does these steps) |
| 4 | `04-implementation-plan.md` | Tasks T01–T37 with files and acceptance checks |
| 5 | `05-player.md` | Player states, control layout, brightness/volume gestures, PiP, subtitles |
| 6 | `06-media-and-downloads.md` | Mock media build, download engine (native + web), file naming, external downloader |
| 7 | `07-native-plugin.md` | `CinetorNative` Java plugin (brightness, volume, downloads, APK install) |
| 8 | `08-updates-and-release.md` | All workflow YAML, flavors, ABI splits, `latest.json`, in-app updater |
| 9 | `09-performance-budgets.md` | TV low-spec rules and CI size gates |
| 10 | `10-prompts.md` | Exact prompts to paste into agy, starting with Prompt 0 |
| 11 | `11-qa-checklist.md` | Device test list before every release |
| — | `PROGRESS.md` | Live status; agents update it every session |

## The whole flow for the user (Bangla summary below)

1. Do `03-github-setup.md` Steps 1–3 (create repos, add `RELEASE_REPO_TOKEN` and `TMDB_TOKEN`).
2. `cd ~/cinetor-next && agy` → paste **Prompt 0** from `10-prompts.md`. Answer the open questions.
3. For each task T01 → T37: paste the "next task" prompt with the task ID → wait → open the preview link or download the debug APKs → if it is good, merge the PR (`gh pr merge --squash`). If CI is red, paste the "CI is red" prompt.
4. After T03: do `03-github-setup.md` Step 4 (keystore secrets). After the first media/release run: Step 5 (Pages).
5. After T34: ship with `git tag v0.1.0 && git push origin v0.1.0`. Then run `11-qa-checklist.md`.
6. Every later release: tag a new version. Installed apps show the update prompt and install it from inside the app.

## Bangla shar-songkhep

- Prothome `03-github-setup.md`-er Step 1–3 nije koro (repo ar secret).
- Tarpor `agy` khule `10-prompts.md`-er **Prompt 0** paste koro, eta shudhu docs pore proshno likhe, code likhe na.
- Tarpor protibar ekta task (T01, T02, …) er prompt dao. Protita task-e agy branch, PR ar CI chalabe. Tumi preview link ba APK test kore merge korbe.
- Tomar PC-te kono build chalbe na, sob GitHub Actions-e.
- Release: `v0.1.0` tag push korlei public repo `cinetor-releases`-e APK, website ar `latest.json` chole jabe, ar app nije update prompt dekhabe.
