export const $ = id => document.getElementById(id);
export const AR = n => Number(n).toLocaleString('ar-EG');
export const day = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
export const days = n => n === 1 ? 'يوم واحد' : n === 2 ? 'يومين' : n <= 10 ? AR(n) + ' أيام' : AR(n) + ' يومًا';
export const norm = s => s.replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
