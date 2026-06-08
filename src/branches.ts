/**
 * הגדרת סניפים. כל סניף = שורה ב-public.shlishuk_draft (id = rowId), תיקייה
 * ב-Storage לפי slug, וניתוב URL נפרד.
 *
 * הוספת סניף חדש: שורה חדשה כאן + insert ב-DB. השאר אוטומטי.
 */
export type BranchConfig = {
  /** מזהה השורה ב-public.shlishuk_draft.id */
  rowId: string
  /** חלק ה-URL אחרי ה-base. ריק = סניף ברירת מחדל ('/'). */
  slug: string
  /** שם להצגה ב-UI ובכותרת */
  label: string
  /** תיאור משני */
  subtitle?: string
}

export const BRANCHES: BranchConfig[] = [
  {
    rowId: 'default',
    slug: '',
    label: 'מרכולית שילשוק (שאר הסניפים)',
    subtitle: 'הדף הוותיק — דף הבית של האתר',
  },
  {
    rowId: 'ZICHRON_GADA',
    slug: 'zg',
    label: 'מרכולית שילשוק — זכרון יעקב / גבעת עדה',
    subtitle: 'סניף זכרון יעקב / גבעת עדה',
  },
  {
    rowId: 'MIVTZAIM',
    slug: 'mivtzaim',
    label: 'דף מבצעים',
  },
]

export const DEFAULT_BRANCH = BRANCHES[0]

/**
 * דאוט מתוך הנתיב את הסניף.
 * - לדף ציבורי: /shlishuk/ → DEFAULT, /shlishuk/ZICHRON_GADA → matching slug.
 * - לאדמין: /admin or /admin/ZICHRON_GADA.
 */
export function findBranchBySlug(slug: string | null | undefined): BranchConfig | null {
  if (!slug) return DEFAULT_BRANCH
  const normalized = slug.replace(/\/+$/, '').replace(/^\/+/, '')
  if (normalized === '') return DEFAULT_BRANCH
  // תאימות: /admin/default מפנה לסניף ברירת המחדל
  if (normalized.toLowerCase() === 'default') return DEFAULT_BRANCH
  // תאימות לאחור: הסלאג הישן ZICHRON_GADA יפנה לסלאג החדש
  const lower = normalized.toLowerCase()
  if (lower === 'zichron_gada' || lower === 'zichron-gada') {
    return BRANCHES.find((b) => b.rowId === 'ZICHRON_GADA') ?? null
  }
  return (
    BRANCHES.find((b) => b.slug.toLowerCase() === lower) ?? null
  )
}
