# לפני יציאה לפרודקשן (SHLISHUK)

מסמך זה ריכוז הפעולות שיש לבצע לפני שהדף עובר משלב פיתוח / בדיקות לשלב פרודקשן עם לקוחות אמיתיים.

---

## 1. הגנת סיסמה ל־`/admin` (Supabase Auth)

נכון לעכשיו, הגישה ל־`/admin` פתוחה לכל מי שיש לו את הקישור והמפתח `anon` נמצא בבנדל הציבורי. זה היה מתאים לשלב הפיתוח כדי שכמה אדמינים יוכלו לבדוק במקביל. **לפני פרודקשן** יש להחליף את המודל ולהפעיל אימות אמיתי.

### צעדים מומלצים

1. **Authentication → Providers**: הפעלת Email + סיסמה ב־Supabase.
2. **Authentication → Users**: יצירת משתמש אדמין לעסק (עם סיסמה חזקה / קוד SMS / OTP לפי בחירה).
3. **RLS**: להסיר את הפוליסות ל־`anon` מטבלת `public.shlishuk_draft` ולהשאיר רק את הפוליסות ל־`authenticated` (כבר קיימות בקובץ `setup/supabase.sql`).
   - מה למחוק: `shlishuk_draft_anon_insert`, `shlishuk_draft_anon_update`.
   - מה להשאיר: `shlishuk_draft_select_public` (קריאה ציבורית כדי שהדף יעבוד), `shlishuk_draft_write_authenticated`, `shlishuk_draft_update_authenticated`.
4. **Storage RLS**: באותו הגיון לטבלת `storage.objects` של ה־bucket `shlishuk-images` — לאפשר `select` ל־`anon` (כדי שהציבורי יראה את התמונות), אבל `insert/update/delete` רק ל־`authenticated`.
5. **קוד הקליינט**: להחזיר ל־`/admin` מסך התחברות (Email + סיסמה) שמשתמש ב־`@supabase/supabase-js` לאימות. החל מהשלב הזה, אוטוסייב יעבוד רק כשיש session.
6. **URL Configuration ב־Supabase**: להוסיף לכתובות ה־redirect את הדומיין הסופי (לא רק `localhost`).

### בדיקות חובה לאחר השינוי

- ללא התחברות: ה־`/admin` מציג טופס סיסמה ולא ניתן לבצע upsert.
- עם משתמש אדמין: כל הפעולות (העלאה, מחיקה, שמירה) עובדות.
- הדף הציבורי: לא נשבר, ממשיך לקרוא את ה־`payload` ואת התמונות.

---

## 2. דומיין מותאם אישית (במקום `github.io`)

`rordan-ai.github.io/SHLISHUK/` מתאים לבדיקות אבל לא לקמפיין שיווקי ללקוחות. יש שתי אפשרויות פשוטות:

### א. GitHub Pages עם CNAME

1. רוכשים דומיין (לדוגמה `markolit.co.il` או תת־דומיין `mivtzaim.markolit.co.il`).
2. הוספת רשומת DNS:
   - תת־דומיין: `CNAME` → `rordan-ai.github.io`.
   - דומיין שורש: 4 רשומות `A` של GitHub Pages (185.199.108.153, 109, 110, 111).
3. ב־`Repo → Settings → Pages → Custom domain`: להגדיר את הדומיין; להפעיל **Enforce HTTPS** אחרי שאישור התעודה מתפרסם (כמה דקות).
4. בקובץ `vite.config.ts`: כשמשתמשים בדומיין שלם בלי קידומת `/SHLISHUK/`, לשנות את `base` ל־`'/'` ולעדכן את ה־workflow כך שלא יקבע `/SHLISHUK/` יותר. (לחילופין, לשמר את ה־base לתת־דומיין שעובד גם תחת `/SHLISHUK/`.)
5. עדכון ה־Secrets ב־GitHub: `VITE_PUBLIC_SITE_URL` לדומיין החדש, `VERIFY_PAGES_URL` בהתאם.
6. עדכון ה־`.env.local` בערך החדש.

### ב. Cloudflare Pages (מומלץ למהירות)

1. חיבור ה־repo ל־Cloudflare Pages, build command `npm run build`, output `dist`.
2. הגדרת Environment Variables ב־Cloudflare: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL` (לפי הדומיין הסופי).
3. הגדרת `_redirects`: `\/* /index.html 200` כדי לתמוך ב־SPA (אין צורך ב־`404.html` כמו ב־GitHub Pages).
4. Cloudflare מטמין סטטי גלובלי ומספק SSL/HTTP3 בחינם.

---

## 3. אופטימיזציות מומלצות לפרודקשן

- **הגדרת Rate Limit ב־Supabase**: כדי למנוע ניצול לרעה של ה־anon (אם נשאר חלקית).
- **Logs/Alerts**: לבדוק ב־Supabase Logs את כמות הבקשות וזמני התגובה; להגדיר התראה על שגיאות.
- **Sentry / Logging בקליינט**: להוסיף שירות לוגים שיתפוס שגיאות מהדפדפן (העלאות, שמירות).
- **Analytics**: GA4 / Plausible / Cloudflare Analytics לפי הצורך.

---

## 4. בדיקות סוף לפני שחרור

| תחום | בדיקה | סטטוס |
|------|--------|-------|
| ציבורי | טעינה < 1.5s ב־Cellular 4G ראשונה | ⬜ |
| ציבורי | טעינה < 0.4s ב־רענון (cache) | ⬜ |
| ציבורי | כל התמונות נטענות ב־WebP, <300KB כל אחת | ⬜ |
| אדמין | התחברות עם משתמש אדמין מצליחה | ⬜ |
| אדמין | העלאת לוגו + ראשית + משנית + מבצעים — שמירה תוך < 2s | ⬜ |
| אדמין | רענון אדמין — מציג תמונות מיידית מהמטמון המקומי | ⬜ |
| אדמין | לחיצה «שמור עכשיו» לא נתקעת; חוזר ל־"✓ נשמר" | ⬜ |
| אבטחה | ניסיון upsert עם anon לאחר הוצאת ה־RLS — נכשל ב־403 | ⬜ |
| אבטחה | Storage `delete` ב־anon — נכשל ב־403 | ⬜ |
| מובייל | iPhone Safari + Android Chrome — תמונות חדות, layout תקין | ⬜ |
| SEO | `<title>`, `lang="he"`, `dir="rtl"` קיימים | ✅ |

---

## 5. גיבוי לפני שחרור

- **DB Snapshot**: ב־Supabase → Database → Backups, לוודא שיש גיבוי טרי.
- **Storage Snapshot**: ייצוא של תוכן ה־bucket `shlishuk-images` למיקום בטוח (S3/Drive) פעם בשבוע (ידני או cron).
- **Git tag**: יצירת tag כמו `v1.0.0-prod` לפני השחרור הציבורי.

---

## 6. תזכורת חשובה — סיבוב מפתחות

לפני המעבר לפרודקשן וגם בכל גילוי דליפה:
- **Supabase → Settings → API → Reset anon/service_role keys**.
- עדכון `.env.local`, GitHub Secrets, ו־Cloudflare/Pages env בהתאם.
- דחיפה חדשה כדי שה־bundle הציבורי יישא את המפתחות החדשים בלבד.

---

> כל פעולה במסמך זה דורשת אישור המשתמש לפני ביצוע, בהתאם להנחיות המסגרת.
