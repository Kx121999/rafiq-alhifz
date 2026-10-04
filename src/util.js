export const $ = id => document.getElementById(id);
export const AR = n => Number(n).toLocaleString('ar-EG');
export const day = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
/** An ISO date shifted by n days (negative = earlier). */
export const shiftDay = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
export const days = n => n === 1 ? 'يوم واحد' : n === 2 ? 'يومين' : n <= 10 ? AR(n) + ' أيام' : AR(n) + ' يومًا';
/** Search form of Arabic text: no tashkeel or Quranic marks, one spelling per letter family. Digits are left alone. */
export const norm = s => s
  .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
  .replace(/[ٱأإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىی]/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').trim();
/** One of the cartoon friends as an <img>. 'rafiq' is the book; the rest live in public/chars/. Tapping one makes it jump (see motion.js). */
export const charSrc = name => import.meta.env.BASE_URL + (name === 'rafiq' ? 'mascot.svg' : 'chars/' + name + '.svg');
export const charImg = (name, cls = '') => {
  const i = document.createElement('img');
  i.className = ('char ' + cls).trim(); i.alt = ''; i.draggable = false; i.width = i.height = 96;
  i.src = charSrc(name);
  return i;
};
export const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e };
export const ayahs = n => n === 1 ? 'آية واحدة' : n === 2 ? 'آيتان' : n <= 10 ? AR(n) + ' آيات' : AR(n) + ' آية';
export const nujum = n => n === 1 ? 'نجمة واحدة' : n === 2 ? 'نجمتان' : n <= 10 ? AR(n) + ' نجوم' : AR(n) + ' نجمة';
