// Mobile shell root (prototype `render`): screen by route, nav bar, overlays.
import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { applyTheme } from '../shared/theme';
import { useStore } from './ui/hooks';
import { adult, cur, hardwareBack, library, on, router, TABS, theme, ui } from './state';
import { Drawer, NavBar, PinDialog, Splash, Toast } from './frame';
import { screens } from './screens';
import { closePlayerForBack, pl } from './player/store';
import { Pip } from './player/pip';
import { isNative } from '../../core/platform';
import { createStore } from '../../core/store';

export function App() {
  useStore(ui);
  useStore(on);
  useStore(theme);
  useStore(library.store);
  useStore(adult.store);
  useStore(pl);
  useStore(routerVersion);
  const route = cur();
  const S = screens[route.name] || screens.home;
  const def = S as FunctionComponent & { land?: boolean; bare?: boolean; tab?: string | null };
  useEffect(() => applyTheme(theme.get().seed), [theme.get().seed]);
  useEffect(() => void document.documentElement.classList.toggle('lg', !!on.get().lg), [on.get().lg]);
  const root = router.stack()[0].name;
  const tab = def.tab !== undefined ? def.tab : TABS.includes(root) ? root : null;
  return (
    <div id="app" class={def.land ? 'land' : ''}>
      <div class="scr"><S key={router.stack().length + route.name} /></div>
      {!def.bare && <NavBar tab={tab} />}
      <Toast />
      {!def.land && <Pip />}
      <Drawer />
      <PinDialog />
      <Splash />
    </div>
  );
}

const routerVersion = createStore('rv', { v: 0 }, false);
router.subscribe(() => routerVersion.set({ v: routerVersion.get().v + 1 }));

/** Android back gesture / browser back → hardwareBack; native APK uses @capacitor/app. */
export function installBack() {
  const doBack = () => hardwareBack(closePlayerForBack);
  if (isNative()) {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => {
        if (!doBack()) App.exitApp();
      });
    });
    return;
  }
  history.pushState({ cinetor: 1 }, '');
  addEventListener('popstate', () => {
    if (doBack()) history.pushState({ cinetor: 1 }, '');
    else history.back();
  });
}
