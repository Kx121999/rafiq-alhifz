import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installGuide } from '../src/pwa.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]',
  iphoneWhatsApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; SM-S911B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
};

describe('how to install, per phone', () => {
  const kind = (ua, env) => installGuide(ua, env).kind;
  it('knows every common phone and browser', () => {
    expect(kind(UA.iphoneSafari)).toBe('ios');
    expect(kind(UA.iphoneChrome)).toBe('ios-other');                  // on iPhone only Safari can install
    expect(kind(UA.androidChrome)).toBe('android');
    expect(kind(UA.samsung)).toBe('samsung');
    expect(kind(UA.firefoxAndroid)).toBe('firefox');
    expect(kind(UA.desktopChrome)).toBe('desktop');
    expect(kind(UA.ipadDesktopMode, { touch: 5 })).toBe('ios');       // an iPad that pretends to be a Mac
    expect(kind(UA.ipadDesktopMode, { touch: 0 })).toBe('desktop');   // a real Mac
  });
  it('tells people in the WhatsApp / Facebook browser to open the link in a real browser first', () => {
    expect(kind(UA.androidWebView)).toBe('inapp');
    expect(kind(UA.iphoneFacebook)).toBe('inapp');
    expect(kind(UA.iphoneWhatsApp)).toBe('inapp');                    // no "Safari" in its identity: a web view inside an app
    const g = installGuide(UA.androidWebView);
    expect(g.title).toContain('المتصفح'); expect(g.steps.join(' ')).toContain('فتح في المتصفح');
  });
  it('always gives short numbered steps in Arabic', () => {
    for (const ua of Object.values(UA)) { const g = installGuide(ua, { touch: 5 }); expect(g.steps.length).toBeGreaterThanOrEqual(3); expect(g.steps.every(s => /[؀-ۿ]/.test(s))).toBe(true) }
    expect(installGuide('').kind).toBe('desktop');                     // no user agent at all: still an answer
  });
});

describe('the install button', () => {
  let prompt;
  const open = vi.fn();
  beforeEach(async () => {
    vi.resetModules(); open.mockClear(); prompt = vi.fn();
    HTMLDialogElement.prototype.showModal = function () { open(); this.setAttribute('open', '') };
    document.body.innerHTML = '<button id="installBtn" hidden>x</button><button data-install></button><dialog id="installDlg"><h2 id="installT"></h2><ol id="installSteps"></ol></dialog><p id="netNote"></p><button id="updateReload"></button><div id="updateBar"></div>';
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
  });

  it('is visible from the start and, when the browser cannot install in one tap, opens the guide', async () => {
    const { initPwa } = await import('../src/pwa.js');
    initPwa();
    const btn = document.getElementById('installBtn');
    expect(btn.hidden).toBe(false);                                    // before: hidden until the browser sent a signal that never came
    btn.click();
    expect(open).toHaveBeenCalledTimes(1);
    expect(document.getElementById('installT').textContent.length).toBeGreaterThan(3);
    expect(document.querySelectorAll('#installSteps li').length).toBeGreaterThanOrEqual(3);
  });

  it('installs in one tap when the browser offers it', async () => {
    const { initPwa } = await import('../src/pwa.js');
    initPwa();
    const ev = new Event('beforeinstallprompt'); ev.prompt = prompt; ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(ev);
    document.getElementById('installBtn').click();
    expect(prompt).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
  });

  it('is hidden when the app is already installed, and the "how do I install" link on the about page uses the same button', async () => {
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    const { initPwa } = await import('../src/pwa.js');
    initPwa();
    expect(document.getElementById('installBtn').hidden).toBe(true);
    document.querySelector('[data-install]').click();
    expect(open).toHaveBeenCalledTimes(1);
  });
});
