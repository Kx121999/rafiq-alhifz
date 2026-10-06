// "المزيد": every page that has no tab of its own, grouped by what it is for. The same list the side menu shows on a wide screen.
import { $, el, icon } from './util.js';

export const MORE = [
  { title: 'للتعلّم', items: [
    ['#/adhkar', 'beads', 'الأذكار', 'صباح ومساء ونوم وغيرها'],
    ['#/plan', 'target', 'خطة الحفظ', 'أهداف جاهزة وورد يومي'],
    ['#/search', 'search', 'البحث في المصحف', 'ابحث بكلمة أو جزء من آية'],
    ['#/games', 'gamepad', 'الألعاب', 'تثبّت الحفظ بمرح'],
  ] },
  { title: 'التحفيز', items: [
    ['#/challenge', 'flag', 'تحدّي الأسبوع', 'هدف صغير كل أسبوع'],
    ['#/ramadan', 'moon', 'رمضان معنا', 'نشاط واحد كل يوم'],
    ['#/shop', 'bag', 'متجر النجوم', 'بنجوم الألعاب داخل التطبيق، لا بالمال'],
  ] },
  { title: 'للأهل', items: [
    ['#/parents', 'shield', 'ركن الأهل', 'الأطفال والمتابعة والإعدادات والبيانات'],
    ['#/report', 'chart', 'التقرير الأسبوعي', 'أرقام حقيقية، قابل للطباعة'],
    ['#/family', 'users', 'تقرير العائلة', 'كل الأطفال في ورقة واحدة'],
    ['#/share', 'share', 'بطاقة الإنجاز', 'صورة تشاركها مع الأهل'],
  ] },
  { title: 'عن التطبيق', items: [
    ['#/about', 'info', 'عن المنصة والمصادر', 'من أين النصوص والتلاوات'],
    ['#/check', 'phone', 'فحص الجهاز', 'هل كل شيء يعمل على هذا الجهاز؟'],
  ] },
];

export function renderMore() {
  const box = $('moreList'); if (!box || box.childElementCount) return;
  for (const g of MORE) {
    const sec = el('section', 'moregroup'); sec.appendChild(el('h2', '', g.title));
    for (const [href, ic, name, sub] of g.items) {
      const a = el('a'); a.href = href;
      const t = el('span'); t.append(el('b', '', name), el('small', '', sub));
      a.append(icon(ic), t, icon('chevleft', 'chev')); sec.appendChild(a);
    }
    box.appendChild(sec);
  }
}
