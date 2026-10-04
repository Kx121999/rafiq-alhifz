export const $ = id => document.getElementById(id);
export const AR = n => Number(n).toLocaleString('ar-EG');
export const day = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
export const days = n => n === 1 ? 'يوم واحد' : n === 2 ? 'يومين' : n <= 10 ? AR(n) + ' أيام' : AR(n) + ' يومًا';
export const norm = s => s.replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
export const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e };
export const ayahs = n => n === 1 ? 'آية واحدة' : n === 2 ? 'آيتان' : n <= 10 ? AR(n) + ' آيات' : AR(n) + ' آية';
export const nujum = n => n === 1 ? 'نجمة واحدة' : n === 2 ? 'نجمتان' : n <= 10 ? AR(n) + ' نجوم' : AR(n) + ' نجمة';
