# 08 — CI, flavors, multi-ABI, release, in-app updates

Verified action versions (2026-11-20): `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-java@v6`, `android-actions/setup-android@v4`, `gradle/actions/setup-gradle@v6`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `softprops/action-gh-release@v3`, `peaceiris/actions-gh-pages@v4`.
The Capacitor 8 template uses AGP 8.13 and Groovy `build.gradle`; its FileProvider already covers `cache-path "."`.

## Flavors + multi-ABI (`android/app/build.gradle`, edit after the scaffold)

Inside `android { }`:

```groovy
def baseCode = (project.findProperty("baseCode") ?: "1").toString().toInteger()
def verName  = (project.findProperty("versionName") ?: "0.0.0").toString()

defaultConfig { versionCode baseCode * 10; versionName verName }

flavorDimensions "device"
productFlavors {
    phone { dimension "device"; applicationId "com.mythbrix.cinetor" }
    tv    { dimension "device"; applicationId "com.mythbrix.cinetor.tv" }
}

splits {
    abi {
        enable true
        reset()
        include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        universalApk true
    }
}

signingConfigs {
    release {
        def ks = System.getenv("ANDROID_KEYSTORE_FILE")
        if (ks) {
            storeFile file(ks)
            storeType "pkcs12"
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
}
buildTypes { release { signingConfig signingConfigs.release; minifyEnabled false } }
```

At the end of the file (top level, outside `android { }`):

```groovy
def abiCodes = ['armeabi-v7a': 1, 'arm64-v8a': 2, 'x86': 3, 'x86_64': 4]
androidComponents {
    onVariants(selector().all()) { variant ->
        variant.outputs.each { output ->
            def f = output.filters.find { it.filterType == com.android.build.api.variant.FilterConfiguration.FilterType.ABI }
            def base = (project.findProperty("baseCode") ?: "1").toString().toInteger()
            output.versionCode.set(base * 10 + (f ? abiCodes[f.identifier] : 0))
        }
    }
}
```

If AGP produces only the universal APK (the app has no native libs), keep it that way, write it in PROGRESS.md, and tell the user. The updater already falls back to `universal`.

TV manifest overlay `android/app/src/tv/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-feature android:name="android.software.leanback" android:required="false" />
  <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
  <application android:banner="@drawable/banner">
    <activity android:name=".MainActivity" android:screenOrientation="landscape">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
```

`res/drawable/banner.xml` (TV flavor) is a `layer-list`: a solid `#000000` shape plus an inset vector C-mark (`ic_cmark.xml`, a path from the prototype `SV('mark')`). Using vectors means no PNG has to be generated.

Per-flavor web assets: `capacitor.config.ts` has `webDir: 'dist/mobile'`. After `npx cap sync android`, run `scripts/android-assets.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
A=android/app/src
rm -rf "$A/phone/assets/public" "$A/tv/assets/public"
mkdir -p "$A/phone/assets" "$A/tv/assets"
mv "$A/main/assets/public" "$A/phone/assets/public"   # mobile bundle
cp -r dist/tv "$A/tv/assets/public"                   # tv bundle
```

Add `android/app/src/*/assets/public` to `.gitignore`. Each shell's `index.html` has `<html data-shell="mobile|tv|desktop">` so CI can check that the right bundle went into each APK.

`scripts/check-apks.sh <dir>`: finds `aapt2` in `$ANDROID_HOME/build-tools/*/`, runs `aapt2 dump badging` on every APK, asserts there are 10 APKs per build type, that TV APKs contain `leanback-launcher`, and that `unzip -p apk assets/public/index.html` contains the right `data-shell`. It prints a table of file name, package, versionCode, size.

## ci.yml

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 26, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
        env:
          TMDB_TOKEN: ${{ secrets.TMDB_TOKEN }}
      - run: npm run build:web
        env:
          VITE_TMDB_TOKEN: ${{ secrets.TMDB_TOKEN }}
          VITE_APP_VERSION: 0.0.0-ci.${{ github.run_number }}
      - run: npm run size
      - uses: actions/upload-artifact@v7
        with: { name: site, path: dist/site, retention-days: 7 }

  android:
    needs: web
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - id: chk
        run: test -f android/app/build.gradle && echo "ok=true" >> "$GITHUB_OUTPUT" || echo "ok=false" >> "$GITHUB_OUTPUT"
      - if: steps.chk.outputs.ok == 'true'
        uses: actions/setup-node@v7
        with: { node-version: 26, cache: npm }
      - if: steps.chk.outputs.ok == 'true'
        uses: actions/setup-java@v6
        with: { distribution: temurin, java-version: 21 }
      - if: steps.chk.outputs.ok == 'true'
        uses: android-actions/setup-android@v4
      - if: steps.chk.outputs.ok == 'true'
        uses: gradle/actions/setup-gradle@v6
      - if: steps.chk.outputs.ok == 'true'
        run: |
          npm ci
          npm run build:mobile
          npm run build:tv
          npx cap sync android
          bash scripts/android-assets.sh
        env:
          VITE_TMDB_TOKEN: ${{ secrets.TMDB_TOKEN }}
          VITE_APP_VERSION: 0.0.0-ci.${{ github.run_number }}
      - if: steps.chk.outputs.ok == 'true'
        working-directory: android
        run: ./gradlew assemblePhoneDebug assembleTvDebug -PbaseCode=1 -PversionName=0.0.0-ci --no-daemon
      - if: steps.chk.outputs.ok == 'true'
        run: bash scripts/check-apks.sh android/app/build/outputs/apk
      - if: steps.chk.outputs.ok == 'true'
        uses: actions/upload-artifact@v7
        with: { name: debug-apks, path: android/app/build/outputs/apk/**/*.apk, retention-days: 7 }

  preview:
    needs: web
    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v8
        with: { name: site, path: site }
      - uses: peaceiris/actions-gh-pages@v4
        with:
          personal_token: ${{ secrets.RELEASE_REPO_TOKEN }}
          external_repository: Ashrix404/cinetor-releases
          publish_branch: gh-pages
          publish_dir: site
          destination_dir: preview/${{ github.head_ref }}
          keep_files: true
```

### Preview

Every PR is published to `https://ashrix404.github.io/cinetor-releases/preview/<branch>/`, so the user can test it on a phone, a desktop, or a TV browser. Debug APKs: `gh run download <run-id> -n debug-apks` (a small download, no build on the PC).

## bootstrap.yml

```yaml
name: bootstrap
on:
  workflow_dispatch:
    inputs:
      task:
        description: "lock = create package-lock.json, android = run cap add android"
        required: true
        type: choice
        options: [lock, android]
permissions:
  contents: write
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 26 }
      - if: inputs.task == 'lock'
        run: npm install --no-audit --no-fund
      - if: inputs.task == 'android'
        run: |
          npm ci
          npm run build:mobile
          npx cap add android
      - run: |
          git config user.name "cinetor-bot"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A package-lock.json android 2>/dev/null || true
          git commit -m "chore(bootstrap): ${{ inputs.task }}" || echo "nothing to commit"
          git push
```

## keystore.yml — DO NOT USE (repo is public; artifacts would leak the key). Kept only as reference.

```yaml
name: keystore
on: workflow_dispatch
permissions:
  contents: read
jobs:
  make:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-java@v6
        with: { distribution: temurin, java-version: 21 }
      - run: |
          set -euo pipefail
          mkdir out
          P=$(openssl rand -hex 16)
          keytool -genkeypair -keystore out/cinetor.jks -storetype PKCS12 -alias cinetor \
            -keyalg RSA -keysize 4096 -validity 36500 -storepass "$P" -keypass "$P" \
            -dname "CN=Cinetor, O=Mythbrix" >/dev/null 2>&1
          base64 -w0 out/cinetor.jks > out/cinetor.jks.b64
          printf 'ANDROID_KEYSTORE_PASSWORD=%s\nANDROID_KEY_ALIAS=cinetor\nANDROID_KEY_PASSWORD=%s\n' "$P" "$P" > out/secrets.txt
      - uses: actions/upload-artifact@v7
        with: { name: cinetor-keystore, path: out/, retention-days: 1 }
```

## release.yml (tag `vX.Y.Z` → everything public)

```yaml
name: release
on:
  push:
    tags: ['v*']
permissions:
  contents: read
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - id: v
        run: |
          V="${GITHUB_REF_NAME#v}"; IFS=. read -r MA MI PA <<< "$V"
          echo "version=$V" >> "$GITHUB_OUTPUT"
          echo "base=$((MA*10000 + MI*100 + PA))" >> "$GITHUB_OUTPUT"
      - uses: actions/setup-node@v7
        with: { node-version: 26, cache: npm }
      - uses: actions/setup-java@v6
        with: { distribution: temurin, java-version: 21 }
      - uses: android-actions/setup-android@v4
      - uses: gradle/actions/setup-gradle@v6
      - run: npm ci && npm run build:web && npm run build:mobile && npm run build:tv
        env:
          VITE_TMDB_TOKEN: ${{ secrets.TMDB_TOKEN }}
          VITE_APP_VERSION: ${{ steps.v.outputs.version }}
          VITE_APP_CODE: ${{ steps.v.outputs.base }}
      - run: npx cap sync android && bash scripts/android-assets.sh
      - run: echo "${{ secrets.ANDROID_KEYSTORE_B64 }}" | base64 -d > "$RUNNER_TEMP/cinetor.jks"
      - working-directory: android
        run: ./gradlew assemblePhoneRelease assembleTvRelease -PbaseCode=${{ steps.v.outputs.base }} -PversionName=${{ steps.v.outputs.version }} --no-daemon
        env:
          ANDROID_KEYSTORE_FILE: ${{ runner.temp }}/cinetor.jks
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
      - run: bash scripts/check-apks.sh android/app/build/outputs/apk
      - run: node scripts/collect-release.mjs "${{ steps.v.outputs.version }}" "${{ steps.v.outputs.base }}"
        # copies APKs to out/apk/cinetor-<flavor>-<abi>-v<ver>.apk, writes out/latest.json (sha256, size, urls)
        # and copies latest.json + version.json into dist/site/
      - uses: softprops/action-gh-release@v3
        with:
          repository: Ashrix404/cinetor-releases
          token: ${{ secrets.RELEASE_REPO_TOKEN }}
          tag_name: ${{ github.ref_name }}
          name: Cinetor ${{ steps.v.outputs.version }}
          body_path: out/RELEASE_NOTES.md
          files: |
            out/apk/*.apk
            out/latest.json
      - uses: peaceiris/actions-gh-pages@v4
        with:
          personal_token: ${{ secrets.RELEASE_REPO_TOKEN }}
          external_repository: Ashrix404/cinetor-releases
          publish_branch: gh-pages
          publish_dir: dist/site
          keep_files: true
      - run: rm -f "$RUNNER_TEMP/cinetor.jks"
        if: always()
```

Release notes: `scripts/collect-release.mjs` writes `out/RELEASE_NOTES.md` from the git log since the previous tag (only `feat:` and `fix:` lines).

How the user ships a version (light commands only):
```bash
git checkout main && git pull
git tag v0.1.0 && git push origin v0.1.0
gh run watch --repo Ashrix404/cinetor-next
```

## latest.json (served at `https://ashrix404.github.io/cinetor-releases/latest.json`)

```json
{
  "version": "0.2.0",
  "versionCode": 200,
  "minVersionCode": 100,
  "notes": "New: ...",
  "publishedAt": "2026-12-01T10:00:00Z",
  "apk": {
    "phone": {
      "arm64-v8a":   { "url": "https://github.com/Ashrix404/cinetor-releases/releases/download/v0.2.0/cinetor-phone-arm64-v8a-v0.2.0.apk", "sha256": "...", "size": 4200000 },
      "armeabi-v7a": { "url": "...", "sha256": "...", "size": 0 },
      "x86":         { "url": "...", "sha256": "...", "size": 0 },
      "x86_64":      { "url": "...", "sha256": "...", "size": 0 },
      "universal":   { "url": "...", "sha256": "...", "size": 0 }
    },
    "tv": { "...same five keys...": {} }
  },
  "web": { "version": "0.2.0" }
}
```
`versionCode` here is the BASE code (without the ABI digit). `minVersionCode`: if the installed base code is lower than it, the update is mandatory (no "Later" button).

## Updater (T32)

App side (`src/core/updater.ts` + shell dialogs):
1. When: on app start (after 5 s) and every 6 h while open; also Settings › About › "Check for updates" (shows "You are up to date" when nothing is new).
2. Fetch `latest.json` with `cache: 'no-store'`. On network error, stay silent (manual check shows "Could not check, try again").
3. Current base code = `floor(deviceInfo().versionCode / 10)`. Show the dialog when `latest.versionCode > current`.
4. Dialog (mobile + TV, focusable with the D-pad): "Update available · v0.2.0", notes, size, [Update now] [Later] ([Later] hidden when mandatory). Later snoozes this version for 24 h.
5. Update now → `pickApk(manifest, flavor, deviceInfo().abis)` → `CinetorNative.updateDownload` with a progress bar → `updateInstall`. If it needs permission, explain "Allow Cinetor to install updates" and retry when the user returns.
6. Settings "Auto install updates": when on, downloads in the background as soon as the app finds an update, then shows "Ready to install". Android always shows its own install confirmation; that cannot be skipped without root.
7. Unit tests: `isNewer`, `pickApk` (exact ABI, fallback to universal, unknown ABI), the mandatory rule, the snooze rule.

Web side:
- `sw.js` caches the app shell with a cache name that includes `__VERSION__` (replaced at build). When a new service worker is `waiting`, show the toast "New version available · Reload". Clicking it posts `SKIP_WAITING`, then reloads on `controllerchange`.
- Also poll `version.json` every hour and on `visibilitychange`.
