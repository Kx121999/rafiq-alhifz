# رفيق الحفظ

موقع عربي لحفظ القرآن الكريم ومراجعته.

```bash
npm install
npm run dev      # تشغيل محلي
npm test         # الاختبارات الآلية (Vitest)
npm run check    # فحص سلامة البيانات (114 سورة، 6236 آية)
npm run build    # يفحص البيانات ثم يبني dist/ للنشر
```

- `public/quran.json`: نص المصحف بالرسم العثماني (quranenc.com عبر حزمة quran-json). لا يُعدَّل.
- `public/tafsir.json`: التفسير الميسّر (spa5k/tafsir_api). لا يُعدَّل.
- `legacy/index.html`: النسخة الأصلية ذات الملف الواحد، للمرجعية.
- التقدّم محفوظ في `localStorage` بالمفتاح `hifz-progress-v1`.
- يعمل كتطبيق قابل للتثبيت وبدون إنترنت (PWA): `public/sw.js` يُعبَّأ وقت البناء بقائمة الملفات وإصدار الكاش عبر `vite.config.js`.
- `npm run a11y` (بعد `npm run build`): فحص إمكانية الوصول بـ axe-core على كل الصفحات والحالات في الوضعين الفاتح والداكن، مع فحص العرض على 320 بكسل. يحتاج Chrome (اضبط `CHROME_PATH` إن لم يوجد في مكانه المعتاد).
