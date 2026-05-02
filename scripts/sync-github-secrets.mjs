/**
 * מעלה ל-GitHub Actions Secrets את ערכי הסנכרון מ-.env.local (לא מתווסף ל-git).
 * דורש: gh CLI מאומת, מריץ מתיקיית הפרויקט.
 *
 * להעברת ערך ל־stdin (לא משתמשים ב־`-f`: זה הקצאת dotenv מתוך gh).
 */
import { readFileSync } from 'node:fs'
import { spawnSync, execFileSync } from 'node:child_process'

function parseEnv(contents) {
  const map = {}
  for (let line of contents.split(/\r?\n/)) {
    // Strip BOM on first logical line only
    if (line.charCodeAt(0) === 0xfeff) line = line.slice(1)
    line = line.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    let k = line.slice(0, eq).trim()
    if (k.charCodeAt(0) === 0xfeff) k = k.slice(1).trim()
    let v = line.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    map[k] = v
  }
  return map
}

function repoFromRemote(url) {
  const trimmed = url.trim()
  const m =
    trimmed.match(/github\.com[/:]([^/]+?)\/(.+?)(?:\.git)?\/?$/i) ||
    trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i)
  if (!m) throw new Error('לא פרסתי את git remote ל־owner/repo')
  return { owner: m[1], repo: m[2] }
}

const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
  encoding: 'utf8',
}).trim()

const { owner, repo } = repoFromRemote(remote)
const repoSlug = `${owner}/${repo}`
const pagesBase =
  repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner}.github.io/`
    : `https://${owner}.github.io/${repo}/`

const envPath = '.env.local'
let map = {}
try {
  map = parseEnv(readFileSync(envPath, 'utf8'))
} catch {
  console.error(`חסר ${envPath}`)
  process.exit(1)
}

function ghSecretSet(name, body) {
  const result = spawnSync(
    'gh',
    ['secret', 'set', name, '-R', repoSlug],
    {
      input: body,
      encoding: 'utf8',
    },
  )
  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `gh secret set ${name} נכשל`,
    )
  }
}

const supUrl = map.VITE_SUPABASE_URL
const supAnon = map.VITE_SUPABASE_ANON_KEY
if (!(supUrl && supAnon)) {
  console.error(
    'חובה ב-.env.local: VITE_SUPABASE_URL וגם VITE_SUPABASE_ANON_KEY',
  )
  process.exit(1)
}

ghSecretSet('VITE_SUPABASE_URL', supUrl)
ghSecretSet('VITE_SUPABASE_ANON_KEY', supAnon)
ghSecretSet('VITE_PUBLIC_SITE_URL', pagesBase)

console.log('✓ Secrets עודכנו לריפו', repoSlug)
console.log('  דף ציבורי:', pagesBase)
console.log('  אדמין:', `${pagesBase.replace(/\/$/, '')}/admin`)
console.log(
  '',
  'לאחר פריסה: אימות מול האתר החי (אופציונלי):\n',
  `  $env:VERIFY_PAGES_URL='${pagesBase.replace(/\/$/, '')}'; npm run verify:pages`,
)
