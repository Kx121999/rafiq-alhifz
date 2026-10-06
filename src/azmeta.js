// Which adhkar lists have a tab of their own, and which one fits the time of day. No religious text lives here:
// the adhkar themselves come, untouched, from public/adhkar.json (see scripts/check-data.mjs).

/** key: the tab and the progress key; cat: the category id in adhkar.json (sabah and masaa share category 1, which is one list in the source). */
export const AZ_TABS = [
  { key: 'sabah', label: 'الصباح', title: 'أذكار الصباح', icon: 'sunrise', cat: 1 },
  { key: 'masaa', label: 'المساء', title: 'أذكار المساء', icon: 'moon', cat: 1 },
  { key: 'nawm', label: 'النوم', title: 'أذكار النوم', icon: 'bed', cat: 2 },
  { key: 'istiqaz', label: 'الاستيقاظ', title: 'أذكار الاستيقاظ', icon: 'sun', cat: 3 },
  { key: 'salah', label: 'بعد الصلاة', title: 'أذكار بعد الصلاة', icon: 'beads', cat: 27 },
];
export const tabOf = key => AZ_TABS.find(t => t.key === key);

/** The list that suits this hour: morning until noon, evening until nine, then bedtime. */
export function azNow(date = new Date()) {
  const h = date.getHours();
  return h >= 4 && h < 12 ? 'sabah' : h >= 12 && h < 21 ? 'masaa' : 'nawm';
}

/** A few entries state a repeat count in their own words while the source file says 1; these follow the text itself.
    Keys are "<category id>.<entry id>". Only the number of taps changes, never the text. */
export const COUNT_FIX = { '1.9': 7, '49.2': 7, '37.2': 3 };
