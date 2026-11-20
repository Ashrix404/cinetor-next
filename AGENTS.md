# AGENTS.md — rules for any coding agent working on Cinetor Next

These rules are mandatory. Read them at the start of every session. If a rule conflicts with a prompt, the rule wins; stop and ask the user.

## 0. What this project is

Cinetor Next is a streaming-style app for three platforms, built from ONE TypeScript codebase:

| Platform | Output | Shell |
|---|---|---|
| Android phone | APK (Capacitor WebView) | `mobile` shell |
| Android TV | separate APK (Capacitor WebView, Leanback) | `tv` shell (ultra light) |
| Web (desktop + mobile browsers, iOS included) | static site / PWA | `desktop` shell on wide screens, `mobile` shell on phones |

Content metadata comes from TMDB. Video is MOCK video only (generated in CI). There are no real streams, no scraping, no providers.

The approved UI and behavior live in `prototype/`. That folder is the single source of truth for every screen, string, color, size and interaction. See `docs/01-product-spec.md`.

## 1. Hard rules (never break)

1. **Never run heavy commands on this machine.** Forbidden locally: `npm install`, `npm run`, `npx`, `vite`, `tsc`, `gradle`, `./gradlew`, Android SDK tools, emulators, Docker, ffmpeg. This PC has no Node, no JDK, no Android SDK on purpose. Everything builds and tests in GitHub Actions.
2. **Allowed locally:** `git`, `gh`, `curl`, `python3` for small text/JSON checks, reading and writing files.
3. **Verify, never guess.** Before you import any package, call any API, or use any GitHub Action, verify it exists:
   - npm package: `curl -s https://registry.npmjs.org/<name>/latest | python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"`
   - Google Maven artifact: `curl -s https://dl.google.com/android/maven2/<group/path>/<artifact>/maven-metadata.xml`
   - GitHub Action: `curl -s https://api.github.com/repos/<owner>/<repo>/releases/latest`
   - TMDB endpoint: check https://developer.themoviedb.org/reference and test it in CI, never invent fields.
   If the check fails, do NOT use it. Write "UNVERIFIED: <thing>" in `docs/PROGRESS.md` and ask the user.
4. **Only use dependencies listed in `docs/02-architecture.md` §Dependencies.** Adding anything else needs the user's written OK.
5. **Never commit secrets.** No TMDB token, keystore, password or PAT in any file. Secrets come from GitHub Actions secrets only (`docs/03-github-setup.md`).
6. **Never invent features, screens, strings or settings** that are not in `prototype/` or `docs/01-product-spec.md`. If something is unclear, ask.
7. **Never touch** the old repos `Ashrix404/cinetor-v2` and `Ashrix404/cinetor-app`.
8. **One task at a time.** Do exactly the task named in the prompt from `docs/04-implementation-plan.md`. Do not start the next task.
9. **Small commits** on a branch named `task/<id>-<slug>`. Never commit to `main` directly. Never force-push `main`.
10. **A task is done only when CI is green** (see §3) and the task's acceptance checks are ticked in `docs/PROGRESS.md`.

## 2. How to work on a task (every time, in this order)

1. Read `AGENTS.md`, `docs/PROGRESS.md`, and the task section in `docs/04-implementation-plan.md`.
2. Open the matching part of `prototype/` and read the exact markup/CSS/JS you are porting. Quote the prototype file and function names in your plan.
3. Write a short plan (files to create/modify, functions with signatures) into `docs/PROGRESS.md` under the task.
4. Create branch `task/<id>-<slug>` from latest `main`.
5. Write the code. Keep files small (one responsibility per file, aim < 300 lines).
6. Write unit tests (Vitest) for every pure function you add in `src/core/`.
7. Commit, push, open a draft PR with `gh pr create --draft`.
8. Wait for CI: `gh run watch` (or `gh run list --branch <branch> --limit 1`).
9. If CI fails: `gh run view <id> --log-failed`, read the real error, fix the real cause, push again. Never "fix" by deleting tests or disabling checks.
10. When green: tick acceptance boxes in `docs/PROGRESS.md`, push, mark PR ready, tell the user the PR link and stop.

## 3. What "green" means

Workflow `ci.yml` passes on the PR: typecheck, unit tests, lint-free build of all three shells, size budgets (`docs/09-performance-budgets.md`), and (for tasks that touch Android) the debug APK build.

## 4. Anti-hallucination checklist (run before every commit)

- [ ] Every import resolves to a file in this repo or to a dependency in the allowed list.
- [ ] Every Capacitor / Android API I used is from the verified list in `docs/07-native-plugin.md` or I verified it today with a link I wrote in PROGRESS.md.
- [ ] Every TMDB field I read exists in a real response (CI test `tmdb.contract.test.ts` covers it).
- [ ] I did not change files outside the task's "Files" list without writing why in PROGRESS.md.
- [ ] No secret, token or password is in the diff (`git diff --cached | grep -iE "eyJ|token|password|keystore"` shows nothing secret).
- [ ] UI matches the prototype screen I was told to port (same text, order, icons, spacing).

## 5. Language and style

- Code, comments, commit messages, docs: US English.
- TypeScript strict mode. No `any` unless commented why.
- Commit messages: `type(scope): summary` (feat, fix, chore, ci, docs, test, refactor).
- CSS: plain CSS files, design tokens as CSS custom properties, no CSS framework.

## 6. Skills to load (Antigravity skills folder)

Load these skills when the task matches; they live in `~/.gemini/config/skills/`:

| When | Skill |
|---|---|
| Every coding task | `zero-hallucination-coder`, `karpathy-coder`, `surgical-patch` |
| Before claiming done | `verification-before-completion`, `verify-and-stop` |
| CI failure / bug | `systematic-debugging`, `investigate-first` |
| GitHub Actions work | `ci-cd-pipeline-builder`, `github-actions-sparen` |
| Pure logic in src/core | `tdd`, `red-green-proof` |
| UI port work | `senior-frontend`, `accessibility` |
| Secrets / signing | `env-secrets-manager`, `security-audit` |
| Release / versioning | `mobile-release` |
| TV performance | `performance-profiler`, `lean-build` |
| Adding a dependency | `dependency-auditor` |
