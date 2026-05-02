import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(process.cwd(), 'dist')
const indexPath = join(dist, 'index.html')
const notFoundPath = join(dist, '404.html')

if (!existsSync(indexPath)) {
  console.error('חסר dist/index.html — הרץ קודם npm run build')
  process.exit(1)
}

copyFileSync(indexPath, notFoundPath)
console.log('נוצר dist/404.html (נפל ל-SPA ב-GitHub Pages, כולל /admin)')
