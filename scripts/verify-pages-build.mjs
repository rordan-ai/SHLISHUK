/**
 * בדיקות אחרי build ל-GitHub Pages.
 * ב-CI מריצים עם GITHUB_PAGES=1 (כמו ב-job).
 * אופציונלי: VERIFY_PAGES_URL עם כתובת האתר לאימות HTTP.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(process.cwd(), 'dist')
const errs = []
const warn = []

function must(cond, msg) {
  if (!cond) errs.push(msg)
}

must(existsSync(join(dist, 'index.html')), 'חסר dist/index.html')
must(existsSync(join(dist, '404.html')), 'חסר dist/404.html — הרץ node scripts/copy-index-to-404.mjs אחרי ה-build')

const assetsDir = join(dist, 'assets')
must(existsSync(assetsDir), 'חסר dist/assets/')
const assets = readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
must(assets.length > 0, 'אין קבצי JS ב-dist/assets/')

if (existsSync(join(dist, 'index.html')) && existsSync(join(dist, '404.html'))) {
  const idx = readFileSync(join(dist, 'index.html'), 'utf8')
  const e404 = readFileSync(join(dist, '404.html'), 'utf8')
  must(idx === e404, '404.html חייב להיות עותק זהה של index.html עבור GitHub Pages SPA')
}

if (process.env.GITHUB_PAGES === '1') {
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  // אתר משתמש (rordan-ai.github.io) מוגש מהשורש — base /
  must(
    html.includes('src="/assets/') || html.includes("src='/assets/"),
    'index.html לא משתמש ב-base / — בנה עם GITHUB_PAGES=1',
  )
}

let sawSupabaseHint = false
for (const f of assets) {
  const chunk = readFileSync(join(assetsDir, f), 'utf8')
  if (chunk.includes('supabase.co') || chunk.includes('supabase')) {
    sawSupabaseHint = true
    break
  }
}
if (!sawSupabaseHint) {
  warn.push('בקבצי JS לא זוהתה מחרוזת supabase טיפוסית — אולי Secrets לא סופקו ב-build')
}

async function probeRemote(base) {
  const root = base.replace(/\/$/, '')
  const paths = [root, `${root}/admin`]
  for (const url of paths) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'shlishuk-verify-pages/1' },
      })
      const html = await res.text()
      const hasRoot =
        html.includes('id="root"') ||
        html.includes('id=&quot;root&quot;')
      if (!hasRoot) {
        errs.push(`${url}: התגובה לא מכילה #root (${res.status})`)
        continue
      }
      // GitHub Pages לעיתים מחזירים 404 לנתיבי SPA אבל מגישים את אותו דף
      if (!res.ok && res.status !== 404) {
        warn.push(`${url}: סטטוס ${res.status} אבל נראה SPA — בדוק ידנית`)
      }
    } catch (e) {
      errs.push(`${url}: ${e.message}`)
    }
  }
}

const remote = process.env.VERIFY_PAGES_URL?.trim()
if (remote) await probeRemote(remote)

if (errs.length) {
  console.error('❌ שגיאות אימות פריסה:')
  for (const e of errs) console.error(`  - ${e}`)
  process.exit(1)
}

if (warn.length) {
  console.warn('⚠️ אזהרות:')
  for (const w of warn) console.warn(`  - ${w}`)
}

console.log('✓ אימות build ל-GitHub Pages עבר')
