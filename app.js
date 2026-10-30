// Fills the total, the job bars and the gift count from the published Google Sheet (row 2: montant, dons, date).
// The values baked into <body data-last-total data-last-count data-last-date> show first and stay if the sheet fails.

// "1.234,50 €" | "1 234" | "1234.5" | "€1,234" → 1234 (whole euros; 1–2 digits after the last separator are cents)
export function euros(text) {
  const t = String(text).replace(/[^\d.,]/g, '')
  const cents = t.match(/^(.*)[.,]\d{1,2}$/)
  return parseInt((cents ? cents[1] : t).replace(/[.,]/g, ''), 10) || 0
}

function cells(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

export function readSheet(csv) {
  const [montant = '', dons = '', date = ''] = cells(String(csv).trim().split(/\r?\n/)[1] || '')
  return { total: euros(montant), count: euros(dons), date: date.trim() }
}

// Money fills the jobs in order: roof first, then door, then walls.
export function fill(total, goals) {
  return goals.map(goal => {
    const part = Math.min(Math.max(total, 0), goal)
    total -= goal
    return part
  })
}

function render({ total, count, date }) {
  const lang = document.documentElement.lang
  const money = new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' })
  const goal = Number(document.body.dataset.goal)
  const text = (sel, value) => document.querySelectorAll(sel).forEach(el => { el.textContent = value })
  const bar = (el, ratio) => el && el.style.setProperty('--p', Math.min(1, ratio).toFixed(4))

  const eur = n => money.format(n).replace(/ /g, ' ') // the narrow space draws almost invisibly in Newsreader
  text('[data-total]', eur(total))
  text('[data-count]', new Intl.NumberFormat(lang).format(count))
  text('[data-updated]', date)
  document.querySelectorAll('[data-count]').forEach(el => { el.hidden = count === 0 })
  document.querySelectorAll('[data-count-label]').forEach(el => {
    el.textContent = count === 0 ? el.dataset.zero : count === 1 ? el.dataset.one : el.dataset.many
  })

  document.querySelectorAll('[data-bar]').forEach(el => {
    bar(el, total / goal)
    el.setAttribute('aria-valuenow', String(Math.min(total, goal)))
  })

  const jobs = [...document.querySelectorAll('[data-job]')]
  fill(total, jobs.map(j => Number(j.dataset.job))).forEach((part, i) => {
    bar(jobs[i], part / Number(jobs[i].dataset.job))
    jobs[i].querySelectorAll('[data-raised]').forEach(el => { el.textContent = eur(part) })
  })
}

function init() {
  const b = document.body.dataset
  const baked = { total: Number(b.lastTotal) || 0, count: Number(b.lastCount) || 0, date: b.lastDate || '' }
  // #demo previews the page with sample numbers; nothing else reads it.
  const demo = location.hash === '#demo'
  render(demo ? { total: 6460, count: 38, date: '' } : baked)

  if (b.sheet && !demo) {
    fetch(b.sheet, { cache: 'no-store', signal: AbortSignal.timeout(6000) })
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(csv => {
        const live = readSheet(csv)
        // Totals only grow: a cleared or mistyped row never makes the page go backwards.
        if (live.total >= baked.total && live.count >= baked.count && live.total < 1e6) render(live)
      })
      .catch(() => {})
  }

  document.querySelectorAll('[data-copy]').forEach(btn => {
    const label = btn.textContent
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy)
      } catch {
        return
      }
      btn.textContent = btn.dataset.done
      btn.dataset.copied = ''
      setTimeout(() => { btn.textContent = label; delete btn.dataset.copied }, 2000)
    })
  })
}

if (typeof document !== 'undefined') init()
