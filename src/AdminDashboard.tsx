import { memo } from 'react'

import { BRANCHES, type BranchConfig } from './branches'

type AdminDashboardProps = {
  buildPublicUrlForBranch: (branch: BranchConfig) => string
  buildAdminUrlForBranch: (branch: BranchConfig) => string
}

export default memo(function AdminDashboard({
  buildPublicUrlForBranch,
  buildAdminUrlForBranch,
}: AdminDashboardProps) {
  return (
    <main className="admin-page" dir="rtl">
      <section className="admin-panel" aria-labelledby="admin-dashboard-title">
        <div className="panel-heading">
          <p className="eyebrow">SHLISHUK Back Office</p>
          <h1 id="admin-dashboard-title">בחירת סניף לעריכה</h1>
          <p>
            כל סניף הוא דף מבצעים נפרד עם כתובת ציבורית משלו. ערוך את התוכן של הסניף
            הרלוונטי — השמירה חלה אך ורק עליו.
          </p>
        </div>

        <div className="branch-grid">
          {BRANCHES.map((branch) => (
            <article key={branch.rowId} className="branch-card">
              <header>
                <h2>{branch.label}</h2>
                {branch.subtitle ? <p>{branch.subtitle}</p> : null}
              </header>

              <div className="branch-card-actions">
                <a
                  className="upload-button"
                  href={buildAdminUrlForBranch(branch)}
                >
                  ניהול הדף
                </a>
                <a
                  className="ghost-button"
                  href={buildPublicUrlForBranch(branch)}
                  target="_blank"
                  rel="noreferrer"
                >
                  פתיחת דף שלישוק הציבורי
                </a>
              </div>

              <p className="branch-card-urls">
                <span>כתובת ציבורית:</span>
                <code>{buildPublicUrlForBranch(branch)}</code>
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
})
