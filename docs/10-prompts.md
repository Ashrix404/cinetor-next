# 10 — Prompts for Antigravity CLI (`agy`)

Paste one prompt per session. Start every session inside the project folder:

```bash
cd ~/cinetor-next
agy            # pick the Gemini 3.8 Flash model with /model if needed (list: agy models)
```

Gemini Flash can hallucinate. Every prompt below pins the task, the files, the proof, and the stop point. Do not merge two tasks into one prompt.

---

## Prompt 0 — FIRST PROMPT (orientation, no code)

```
You are working in ~/cinetor-next. Read these files completely, in this order:
AGENTS.md, docs/README.md, docs/01-product-spec.md, docs/02-architecture.md,
docs/03-github-setup.md, docs/04-implementation-plan.md, docs/05-player.md,
docs/06-media-and-downloads.md, docs/07-native-plugin.md,
docs/08-updates-and-release.md, docs/09-performance-budgets.md,
docs/11-qa-checklist.md. Then skim prototype/android/index.html,
prototype/tv/index.html and prototype/web/index.html.

Load the skills zero-hallucination-coder and karpathy-coder.

Do NOT write any code. Do NOT run npm, npx, node, gradle or any build. Only:
1. Update docs/PROGRESS.md: fill in the "Status" table with every task T01–T37 as "todo".
2. Under "Open questions", list anything in the docs that is unclear, contradictory,
   or that you could not verify. Verify the dependency versions in
   docs/02-architecture.md with the curl command from AGENTS.md rule 3 and write the
   results under "Verification log".
3. Check that the repo Ashrix404/cinetor-next exists and that the secrets
   TMDB_TOKEN and RELEASE_REPO_TOKEN are set: run `gh secret list --repo Ashrix404/cinetor-next`
   (it shows names only). Write what is missing.
4. Commit only docs/PROGRESS.md on branch task/T00-orientation, push, open a draft PR.
Then STOP and show me the open questions.
```

## Prompt — next task (use for T01 … T37, change only the ID)

```
Do task T__ from docs/04-implementation-plan.md and nothing else.
Follow AGENTS.md §2 step by step. Load skills: zero-hallucination-coder,
karpathy-coder, surgical-patch, verification-before-completion
(+ the extra skills AGENTS.md §6 lists for this kind of task).

Rules for this session:
- No local builds. Prove everything through CI on branch task/T__-<slug>.
- Port UI 1:1 from the prototype function(s) named in the task; quote the
  prototype function names in docs/PROGRESS.md before writing code.
- Use only the allowed dependencies. Verify any API you are not 100% sure about
  and log it in PROGRESS.md "Verification log".
- When CI is green: tick the task's acceptance boxes in PROGRESS.md, push,
  mark the PR ready, and give me (1) the PR link, (2) the preview link
  https://ashrix404.github.io/cinetor-releases/preview/<branch>/ and
  (3) for Android tasks the command `gh run download <id> -n debug-apks`.
Then STOP. Do not start the next task.
```

## Prompt — CI is red

```
CI failed on the current branch. Load skills systematic-debugging and investigate-first.
1. Run: gh run list --branch "$(git branch --show-current)" --limit 1
2. Run: gh run view <id> --log-failed   and read the FIRST real error.
3. Write in PROGRESS.md: the error line, the root cause, the fix you plan.
4. Fix the root cause only. Do not delete tests, lower budgets, add `|| true`,
   or skip steps to make it pass.
5. Push and wait for CI again. Stop when green, or after 3 failed attempts
   write a summary and ask me.
```

## Prompt — hallucination reset (use when the agent invents things)

```
Stop. Re-read AGENTS.md. For every import, API, Gradle setting, GitHub Action
and TMDB field in your last diff, show proof that it exists: a curl result,
a file path in this repo, or a line in docs/. Remove anything without proof.
List what you removed. Do not add replacements until I answer.
```

## Prompt — review before merge

```
Load skills code-review-and-quality and verification-before-completion.
Review the PR for task T__ against docs/01-product-spec.md and the prototype.
List mismatches (text, order, icons, sizes, behavior) and anything that breaks
docs/09-performance-budgets.md. Fix only the mismatches, push, wait for CI. Stop.
```

## Prompt — release

```
Make a release. Steps: make sure main is green in CI; update docs/PROGRESS.md
"Releases" with the version; then tell me to run these commands myself
(do not run them): git tag vX.Y.Z && git push origin vX.Y.Z
After I confirm, watch the release run with gh run watch and report the
release URL and the latest.json URL. Stop.
```
