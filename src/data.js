// Quran text and tafsir are loaded from public/ as-is; nothing here alters them.
const BASE = import.meta.env.BASE_URL;
const getJSON = f => fetch(BASE + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json() });

/** Surahs: [{n: name, t: 0 Makki / 1 Madani, v: [ayah text]}] */
export const Q = [];
export const loadQuran = () => getJSON('quran.json').then(d => { Q.push(...d); return Q });

let TP = null;
/** Tafsir is large, so it is fetched once on first use. */
export const loadTafsir = () => TP || (TP = getJSON('tafsir.json').catch(e => { TP = null; throw e }));

let AZ = null;
/** The adhkar (Hisn al-Muslim, public/adhkar.json) are fetched once on first use and shown exactly as they are in the file. */
export const loadAdhkar = () => AZ || (AZ = getJSON('adhkar.json').catch(e => { AZ = null; throw e }));
