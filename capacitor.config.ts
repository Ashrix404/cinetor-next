import type { CapacitorConfig } from '@capacitor/cli';

// webDir points at the mobile bundle; scripts/android-assets.sh moves it into the
// phone flavor and copies dist/tv into the tv flavor (docs/08-updates-and-release.md §Flavors).
const config: CapacitorConfig = {
  appId: 'com.mythbrix.cinetor',
  appName: 'Cinetor',
  webDir: 'dist/mobile',
  backgroundColor: '#050506',
  android: { allowMixedContent: false },
};

export default config;
