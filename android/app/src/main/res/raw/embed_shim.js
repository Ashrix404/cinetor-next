/* Cinetor embed guard. Injected at document start into every frame of the app WebView
 * (MainActivity, androidx.webkit addDocumentStartJavaScript) and into every frame of the CI
 * stream probe (scripts/stream-probe/probe.mjs, mode "apk"). It does nothing in the app's own page.
 * 1. Hides that this is an Android WebView: vidsrc.su shows "In-App Browser Detected ... Open in
 *    External Browser" when navigator.userAgent has "; wv)" or "Version/x.y ... Chrome/", or when
 *    navigator.userAgentData.brands has "Android WebView" (read in its bundle on 2026-11-20).
 *    MainActivity already cleans the UA string natively; this covers the JS side and old WebViews.
 * 2. window.open (ad pop-ups / pop-unders on the first tap) returns a dummy window, so the page does
 *    not navigate its own frame to the ad and goes on to start the video.
 * 3. Links with target=_blank (ad overlays) are not followed.
 * 4. Reports to the app (window.top.postMessage) when a real video plays, or when the page says it
 *    refuses to play here, so the app can stop its loader or move to the next server at once.
 * ES5 only: old Android TV WebViews (Chrome 61). */
(function () {
  try {
    var h = location.hostname;
    if (!h || h === 'localhost' || location.protocol === 'file:') return;
    if (window.__cinetorGuard) return;
    window.__cinetorGuard = 1;
  } catch (e) {
    return;
  }
  var nav = navigator;
  var clean = function (ua) {
    return String(ua || '').replace(/; wv\)/, ')').replace(/\bVersion\/\d+(\.\d+)* /, '');
  };
  function define(obj, key, getter) {
    try {
      Object.defineProperty(obj, key, { get: getter, configurable: true });
    } catch (e) {}
  }
  try {
    var ua = clean(nav.userAgent);
    if (ua !== nav.userAgent) {
      define(Navigator.prototype, 'userAgent', function () { return ua; });
      define(Navigator.prototype, 'appVersion', function () { return ua.replace(/^Mozilla\//, ''); });
    }
  } catch (e) {}
  try {
    var uad = nav.userAgentData;
    var fix = function (list) {
      if (!list || !list.map) return list;
      return list.map(function (b) {
        return b && b.brand === 'Android WebView' ? { brand: 'Google Chrome', version: b.version } : b;
      });
    };
    if (uad && uad.brands && uad.brands.some(function (b) { return b.brand === 'Android WebView'; })) {
      var fake = {
        brands: fix(uad.brands),
        mobile: uad.mobile,
        platform: uad.platform,
        getHighEntropyValues: function (hints) {
          return uad.getHighEntropyValues(hints).then(function (v) {
            v.brands = fix(v.brands);
            if (v.fullVersionList) v.fullVersionList = fix(v.fullVersionList);
            return v;
          });
        },
        toJSON: function () { return { brands: fake.brands, mobile: fake.mobile, platform: fake.platform }; }
      };
      define(Navigator.prototype, 'userAgentData', function () { return fake; });
    }
  } catch (e) {}

  function report(ev) {
    try {
      window.top.postMessage({ __cinetor: 'embed', ev: ev, host: location.hostname }, '*');
    } catch (e) {}
  }

  try {
    var dummy = {
      closed: false, opener: null, name: '', length: 0,
      close: function () { dummy.closed = true; }, focus: function () {}, blur: function () {}, postMessage: function () {},
      location: { href: 'about:blank', replace: function () {}, assign: function () {} },
      document: { write: function () {}, writeln: function () {}, open: function () {}, close: function () {} }
    };
    window.open = function () { return dummy; };
  } catch (e) {}

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[target]') : null;
    var t = a ? String(a.getAttribute('target') || '').toLowerCase() : '';
    if (t && t !== '_self') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // first sign of life of the player page itself (not of its ads): the app drops its loader
  document.addEventListener('DOMContentLoaded', function () {
    try {
      if (window.parent === window.top) report('ready');
    } catch (e) {}
  });

  var played = false;
  document.addEventListener('playing', function (e) {
    var v = e.target;
    if (played || !v || v.tagName !== 'VIDEO') return;
    // pre-roll ads are short clips; a title (or a live stream: Infinity) is long
    var d = v.duration;
    if (d && isFinite(d) && d < 90) return;
    played = true;
    report('playing');
  }, true);

  var BLOCKED = /In-App Browser Detected|Open in External Browser|Sandbox not allowed|does not work inside embedded browsers/i;
  var checks = 0;
  var timer = setInterval(function () {
    checks++;
    var t = document.body ? document.body.innerText || '' : '';
    if (BLOCKED.test(t)) {
      clearInterval(timer);
      report('blocked');
    } else if (checks > 20 || played) clearInterval(timer);
  }, 1000);
})();
