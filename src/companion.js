// The companion: the child's cartoon friend waits at the top of every page (in the row of the children's names, where there
// is always free room, so it never covers a button) and says one short, friendly line about what the page is for. It talks the
// first time a page opens in a visit, goes quiet after a few seconds or a tap, and tells another tip when tapped.
// The lines are about using the site only; there is no religious text in them. Parents can turn it off in the parent corner.
import { $, el, charImg } from './util.js';
import { activeKid, friendOf, friendsFor } from './state.js';

const KEY = 'hifz-companion-v1';
export const companionOn = () => { try { return localStorage.getItem(KEY) !== '0' } catch (e) { return true } };
export function setCompanion(on) { try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, '0') } catch (e) {} refreshCompanion() }

/** Pages that are mainly paper (they are printed), so the friend stays out of them. */
const QUIET = new Set(['certificate', 'report', 'family']);

export const TIPS = {
  home: ['أهلًا بك! هل نبدأ الحفظ معًا اليوم؟', 'اضغط «ابدأ الحفظ» وسنمشي خطوة بخطوة.'],
  dashboard: ['هنا ترى ما أنجزتَ اليوم وما ينتظرك.', 'كل آية جديدة تقرّبك من هدفك اليومي!'],
  mushaf: ['اختر سورة تحب أن تحفظها.', 'ابدأ بسورة قصيرة، ثم زد شيئًا فشيئًا.'],
  search: ['اكتب كلمة وسأبحث لك عن الآيات.', 'لا يهم التشكيل ولا شكل الهمزة.'],
  review: ['المراجعة في موعدها تثبّت الحفظ.', 'راجع سورة اليوم ثم قيّم نفسك بصدق.'],
  plan: ['الخطة الصغيرة المنتظمة أفضل من جهد كبير ثم توقّف.', 'اختر خطة تناسب وقتك.'],
  games: ['اختر لعبة واجمع النجوم!', 'الألعاب تثبّت ما حفظتَ وتجعله ممتعًا.'],
  achievements: ['هذه نجومك وأوسمتك، ما شاء الله!', 'أي وسام جديد ينتظرك؟'],
  adhkar: ['اضغط الزر لتعدّ مرات الذكر.', 'يمكنك إضافة ما تحبه إلى «المفضلة».'],
  shop: ['اصرف نجوم الألعاب على أصدقاء وألوان جديدة!', 'اشترِ شيئًا جميلًا وجرّبه فورًا.'],
  challenge: ['هدف صغير كل أسبوع وجائزة في نهايته!', 'تعبان؟ يمكنك أخذ يوم راحة واحد في الأسبوع.'],
  share: ['احفظ بطاقتك وشاركها مع أهلك.', 'البطاقة تُرسم على جهازك فقط.'],
  ramadan: ['املأ لوحة رمضان بنشاط واحد كل يوم!', 'آية أو مراجعة أو أذكار أو لعبة: أي واحدة تكفي لليوم.'],
  check: ['هيا نتأكد أن كل شيء يعمل جيدًا على جهازك.'],
};

/** One tip for a page; n picks which one (so the same page does not always say the same thing). */
export function tipFor(page, n = 0) {
  const list = TIPS[page] && TIPS[page].length ? TIPS[page] : TIPS.home;
  return list[Math.abs(n) % list.length];
}

let current = '', count = 0, timer = 0;

function nameOfFriend() {
  const k = activeKid(), id = friendOf();
  const f = friendsFor(k).find(x => x.id === id) || { name: 'رفيق' };
  return f.name;
}

function hide() { const b = $('cBubble'); if (b) { b.hidden = true; b.setAttribute('aria-hidden', 'true') } }

function say(text, spoken) {
  const b = $('cBubble'); if (!b) return;
  clearTimeout(timer);
  b.textContent = nameOfFriend() + ': ' + text; b.hidden = false;
  // a tip the child asked for is announced to screen readers; the one shown on its own is not
  if (spoken) { b.removeAttribute('aria-hidden'); b.setAttribute('role', 'status') } else { b.setAttribute('aria-hidden', 'true'); b.removeAttribute('role') }
  timer = setTimeout(hide, 7000);
}

/** Puts the current friend's picture on the button (call again when the child picks another friend). */
export function refreshCompanion() {
  const box = $('companion'), btn = $('cBtn'); if (!box || !btn) return;
  box.hidden = !companionOn() || QUIET.has(current) || !activeKid();
  btn.textContent = ''; btn.appendChild(charImg(friendOf()));
  btn.setAttribute('aria-label', 'صديقك ' + nameOfFriend() + ': اضغط ليقول لك نصيحة');
}

/** A page opened: show it (unless it is a quiet one) and let the friend say hello. */
export function companionPage(page) {
  const same = page === current;
  current = page; refreshCompanion();
  if (same) return;                      // the router can show the same page twice while the Quran loads: say hello only once
  count = 0;
  const visible = $('companion') && !$('companion').hidden;
  if (visible && firstVisit(page)) say(tipFor(page, 0), false); else hide();
}

/** True the first time a page is opened in this visit (the friend does not repeat itself on every return). */
function firstVisit(page) {
  try {
    const seen = JSON.parse(sessionStorage.getItem('hifz-cseen') || '[]');
    if (seen.includes(page)) return false;
    sessionStorage.setItem('hifz-cseen', JSON.stringify([...seen, page])); return true;
  } catch (e) { return true }
}

export function initCompanion() {
  if ($('companion')) return;
  const box = el('div', 'companion'), bubble = el('p', 'cbubble'), btn = el('button', 'cchar');
  box.id = 'companion'; bubble.id = 'cBubble'; bubble.hidden = true; btn.id = 'cBtn'; btn.type = 'button'; box.hidden = true;
  box.append(bubble, btn);
  (document.querySelector('.kidbar') || document.querySelector('.wrap')).appendChild(box);
  btn.addEventListener('click', () => { count++; say(tipFor(current, count), true) });
  bubble.addEventListener('click', hide);   // tap the bubble to dismiss it
}
