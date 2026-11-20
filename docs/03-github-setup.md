# 03 — GitHub setup (done once, mostly by the user)

Names used everywhere in these docs (change them here only, then search-replace in docs):

| Name | Value |
|---|---|
| `OWNER` | `Ashrix404` |
| `SOURCE_REPO` | `cinetor-next` (PUBLIC, all code; public so GitHub Actions minutes are free) |
| `RELEASE_REPO` | `cinetor-releases` (public, only APKs, website, media, `latest.json`) |
| Phone app id | `com.mythbrix.cinetor` |
| TV app id | `com.mythbrix.cinetor.tv` |
| Website URL | `https://ashrix404.github.io/cinetor-releases/` |
| Update manifest | `https://ashrix404.github.io/cinetor-releases/latest.json` |

Do NOT reuse `cinetor-v2` or `cinetor-app`.

## Step 1 — Create both repos — DONE 2026-11-20 (setup by Claude)

```bash
cd ~/cinetor-next
git init -b main
git add AGENTS.md docs prototype
git commit -m "docs: add plan, rules and approved prototypes"
gh repo create Ashrix404/cinetor-next --private --source . --push
gh repo create Ashrix404/cinetor-releases --public --description "Cinetor builds: APKs, web app, media" --add-readme
```

## Step 2 — Fine-grained token so CI can publish to the public repo

1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate.
2. Repository access: only `Ashrix404/cinetor-releases`.
3. Permissions: **Contents: Read and write**, **Pages: Read and write**, Metadata: Read.
4. Expiry: 1 year. Copy the token.
5. Save it into the SOURCE repo:

```bash
gh secret set RELEASE_REPO_TOKEN --repo Ashrix404/cinetor-next   # paste token when asked
```

## Step 3 — TMDB token — DONE (secret set; still rotate it in the TMDB dashboard and update the secret)

Rotate the old token first (it was shared in chat). Then:

```bash
gh secret set TMDB_TOKEN --repo Ashrix404/cinetor-next   # paste the v4 read access token
```

## Step 4 — Android signing key — DONE (generated locally with openssl, PKCS12)

The keystore was generated on the user's PC with openssl (light command), NOT in CI, because this repo is public and workflow artifacts of public repos can be downloaded by anyone. Files: `~/cinetor-keys/` (`cinetor.p12`, `cinetor.p12.b64`, `cert.pem`, `secrets.txt`). The 4 `ANDROID_*` secrets are set. Store type is PKCS12, alias `cinetor`, store password = key password.

Old instructions below are kept for reference only. NEVER generate or upload a keystore as a workflow artifact in this public repo.

The key must never change. If it is lost, users cannot update in place and must uninstall.

1. Wait until the agent has added `.github/workflows/keystore.yml` (plan task T03).
2. Run it: `gh workflow run keystore.yml --repo Ashrix404/cinetor-next`
3. Download the artifact: `gh run download --repo Ashrix404/cinetor-next -n cinetor-keystore -D ~/cinetor-keys`
4. The folder has `cinetor.jks`, `cinetor.jks.b64` and `secrets.txt` (passwords).
5. Set the secrets:

```bash
cd ~/cinetor-keys
gh secret set ANDROID_KEYSTORE_B64 --repo Ashrix404/cinetor-next < cinetor.jks.b64
gh secret set ANDROID_KEYSTORE_PASSWORD --repo Ashrix404/cinetor-next   # value from secrets.txt
gh secret set ANDROID_KEY_ALIAS --repo Ashrix404/cinetor-next          # value: cinetor
gh secret set ANDROID_KEY_PASSWORD --repo Ashrix404/cinetor-next       # value from secrets.txt
```

6. Back up `~/cinetor-keys` to two safe places (for example an encrypted USB stick and a password manager). Then delete the workflow run so the artifact is gone: `gh run delete <run-id> --repo Ashrix404/cinetor-next`.

## Step 5 — GitHub Pages on the release repo — DONE (gh-pages branch, https://ashrix404.github.io/cinetor-releases/)

After the first `mock-media.yml` or `release.yml` run has created the `gh-pages` branch in `cinetor-releases`:

```bash
gh api -X POST repos/Ashrix404/cinetor-releases/pages -f "source[branch]=gh-pages" -f "source[path]=/"
```

## Step 6 — Branch protection (optional, recommended)

```bash
gh api -X PUT repos/Ashrix404/cinetor-next/branches/main/protection \
  -F required_status_checks[strict]=true -F "required_status_checks[contexts][]=ci" \
  -F enforce_admins=false -F required_pull_request_reviews=null -F restrictions=null
```

## Secrets summary (source repo)

| Secret | Used by |
|---|---|
| `TMDB_TOKEN` | ci.yml (contract test), release.yml (build) |
| `RELEASE_REPO_TOKEN` | release.yml, mock-media.yml |
| `ANDROID_KEYSTORE_B64` | release.yml |
| `ANDROID_KEYSTORE_PASSWORD` | release.yml |
| `ANDROID_KEY_ALIAS` | release.yml |
| `ANDROID_KEY_PASSWORD` | release.yml |
