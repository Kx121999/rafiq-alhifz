import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() });

async function setup() {
  today('2026-05-12');
  const { state, Q } = await boot();
  vi.stubGlobal('Audio', class { addEventListener() {} removeEventListener() {} pause() {} load() {} });
  memoriseAll(state, Q, 112); state.bump(4);
  state.addGameStars(3);
  const rc = await import('../src/reportcard.js');
  return { state, rc };
}

describe('what is printed on the picture', () => {
  it('is the same numbers as the weekly report', async () => {
    const { rc } = await setup();
    const d = rc.reportCardData(0);
    expect(d.name).toBe('طفلي');
    expect(d.tiles.map(t => t[0])).toEqual(['آيات جديدة', 'مراجعات للسور', 'آيات تم تثبيتها', 'أيام النشاط', 'نجوم الألعاب']);
    expect(d.tiles[0][1]).toBe('٤'); expect(d.tiles[4][1]).toBe('٣'); expect(d.tiles[3][1]).toBe('١ من ٧');
    expect(d.days).toHaveLength(7); expect(d.days.at(-1).a).toBe(4);          // today is the last bar
    expect(d.standing[0][1]).toBe('٤ من ٦٬٢٣٦');
    expect(d.standing[1][1]).toBe('١ من ١١٤');
  });
  it('can show last week instead', async () => {
    const { rc } = await setup();
    expect(rc.reportCardData(1).tiles[0][1]).toBe('٠');
  });
});

describe('sharing it', () => {
  const blob = () => new Blob(['png'], { type: 'image/png' });
  const doc = () => { const clicks = []; return { clicks, createElement: () => ({ click() { clicks.push(1) }, remove() {} }), body: { appendChild() {} } } };
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }));

  it('opens the share sheet with the picture when the phone can', async () => {
    const { rc } = await setup();
    const share = vi.fn(async () => {}), d = doc();
    const r = await rc.shareReport(0, { draw: async () => blob(), nav: { canShare: () => true, share }, doc: d });
    expect(r).toBe('shared'); expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0]; expect(arg.files[0].type).toBe('image/png'); expect(arg.files[0].name).toMatch(/^rafiq-report-\d{4}-\d{2}-\d{2}\.png$/);
    expect(d.clicks).toHaveLength(0);
  });
  it('saves the picture when sharing files is not possible', async () => {
    const { rc } = await setup(); const d = doc();
    expect(await rc.shareReport(0, { draw: async () => blob(), nav: {}, doc: d })).toBe('saved');
    expect(d.clicks).toHaveLength(1);
  });
  it('does nothing more when the parent closes the share sheet, and saves if the share fails for another reason', async () => {
    const { rc } = await setup(); let d = doc();
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    expect(await rc.shareReport(0, { draw: async () => blob(), nav: { canShare: () => true, share: async () => { throw abort } }, doc: d })).toBe('cancelled');
    expect(d.clicks).toHaveLength(0);
    d = doc();
    expect(await rc.shareReport(0, { draw: async () => blob(), nav: { canShare: () => true, share: async () => { throw new Error('boom') } }, doc: d })).toBe('saved');
    expect(d.clicks).toHaveLength(1);
  });
  it('says so when the browser cannot draw', async () => {
    const { rc } = await setup();
    expect(await rc.shareReport(0, { draw: async () => null })).toBe('unsupported');
    expect(await rc.drawReportCard(document.createElement('canvas'))).toBeNull();   // jsdom has no canvas
  });
});
