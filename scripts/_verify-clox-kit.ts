/**
 * End-to-end check of clox_kit inside a real Vercel Sandbox, booted exactly
 * like a chat sandbox (snapshot when SANDBOX_SKILLS_SNAPSHOT_ID is set).
 * Builds a deck over two separate python runs (like two tool calls), a PDF
 * report and a workbook from a messy CSV, then downloads them to /tmp/clox-e2e.
 *
 *   pnpm exec tsx scripts/_verify-clox-kit.ts
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { Sandbox } from '@vercel/sandbox'
import { installKit } from '../src/lib/sandbox/kit'

const OUT = '/tmp/clox-e2e'
const SNAP = process.env.SANDBOX_SKILLS_SNAPSHOT_ID

const CSV = ['Order ID;Order Date;Region;Product;Revenue;Margin']
for (let i = 0; i < 400; i++) {
  const m = String((i % 12) + 1).padStart(2, '0')
  const region = ['North', 'South', 'East', 'West'][i % 4]
  const product = ['Starter', 'Pro', 'Enterprise'][i % 3]
  CSV.push(`A-${1000 + i};2026-${m}-${String((i % 27) + 1).padStart(2, '0')};${region};${product};$${(120 + ((i * 37) % 900)).toLocaleString('en-US')}.50;${18 + (i % 40)}%`)
}

const STEP_1 = `
from clox_kit import Deck
d = Deck("e2e-deck", theme="electric", title="E2E check", brand="Clox", new=True)
d.cover("Clox kit runs in the sandbox", "End-to-end check", kicker="Verification")
d.kpis("Numbers", [("$4.2M", "Revenue", "+38%"), ("1,240", "Customers", "+212"), ("96%", "Retention", "-1pt")], notes="KPIs.")
`
const STEP_2 = `
from clox_kit import Deck
d = Deck("e2e-deck")
d.chart("Revenue by quarter", "bar", ["Q1","Q2","Q3","Q4"], {"2025": [1.1,1.4,1.6,2.0], "2026": [1.5,1.9,2.6,3.1]}, fmt="money", takeaway="Q4 doubled.", notes="Chart.")
d.closing("Thank you", "Questions?")
d.check(); d.pdf()
`
const STEP_3 = `
from clox_kit import data, Book, Report
df = data.load("/mnt/user-data/uploads/orders.csv")
data.profile(df, "orders")
by = data.summarize(df, by="Region", values="Revenue")
print(data.md(by, fmt={"Revenue": "money", "share": "pct"}))
mon = data.by_period(df, "Order Date", "Revenue", "M")
b = Book("e2e-book", theme="studio", title="Orders", new=True)
b.table(df, sheet="Orders", fmt={"Revenue": "money", "Margin": "pct"}, totals=["Revenue"], bars=["Revenue"])
b.table(by, sheet="By region", fmt={"Revenue": "money", "share": "pct"}, chart=("bar", "Region", ["Revenue"]))
b.summary([("Total revenue", f"=SUM({b.col('Orders','Revenue')})", "money"), ("Orders", len(df), "int")])
r = Report("e2e-report", theme="editorial", title="Orders brief", author="Clox", new=True)
r.cover(kicker="Check")
r.h1("Summary"); r.kpis([(data.money(df.Revenue.sum()), "Revenue"), (f"{len(df):,}", "Orders")])
r.chart("line", mon.period, {"Revenue": mon.Revenue}, fmt="money", title="By month")
r.table(["Region", "Revenue", "Share"], by[["Region", "Revenue", "share"]], fmt={"Revenue": "money", "Share": "pct"})
`
const STEP_4 = `
from clox_kit import charts
print(charts.png("donut", ["A","B","C"], [5,3,2], "/mnt/user-data/outputs/e2e-chart.png", theme="midnight"))
`

async function run(sb: Sandbox, label: string, code: string) {
  const path = `/tmp/${label}.py`
  await sb.writeFiles([{ path, content: Buffer.from(code) }])
  const t = Date.now()
  const r = await sb.runCommand({ cmd: 'python3', args: [path], signal: AbortSignal.timeout(180_000) })
  const out = (await r.stdout()) + (await r.stderr())
  console.log(`\n── ${label} · exit ${r.exitCode} · ${Date.now() - t}ms\n${out.trim()}`)
  if (r.exitCode !== 0) throw new Error(`${label} failed`)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const t0 = Date.now()
  const sb = SNAP
    ? await Sandbox.create({ source: { type: 'snapshot', snapshotId: SNAP }, timeout: 10 * 60_000 })
    : await Sandbox.create({ runtime: 'python3.13', timeout: 10 * 60_000 })
  console.log(`sandbox ${sb.sandboxId} (${SNAP ? 'snapshot' : 'blank'}) in ${Date.now() - t0}ms`)
  try {
    await sb.runCommand('mkdir', ['-p', '/mnt/user-data/uploads', '/mnt/user-data/outputs'])
    if (!SNAP) {
      await sb.runCommand({ cmd: 'sh', args: ['-lc', 'python3 -m pip install -q --prefer-binary python-pptx pillow pypdf reportlab openpyxl python-docx'] })
    }
    const ok = await installKit(sb)
    if (!ok) throw new Error('installKit failed')
    await sb.writeFiles([{ path: '/mnt/user-data/uploads/orders.csv', content: Buffer.from(CSV.join('\n'), 'latin1') }])
    await run(sb, 'step1-deck', STEP_1)
    await run(sb, 'step2-deck', STEP_2)
    await run(sb, 'step3-data', STEP_3)
    await run(sb, 'step4-png', STEP_4)
    for (const f of ['e2e-deck.pptx', 'e2e-deck.pdf', 'e2e-book.xlsx', 'e2e-report.pdf', 'e2e-chart.png']) {
      const buf = await sb.readFileToBuffer({ path: `/mnt/user-data/outputs/${f}` })
      if (!buf) throw new Error(`missing ${f}`)
      await writeFile(`${OUT}/${f}`, buf)
      console.log(`↓ ${f} ${(buf.byteLength / 1024).toFixed(0)} KB`)
    }
    console.log(`\nALL OK in ${Date.now() - t0}ms`)
  } finally {
    await sb.stop().catch(() => {})
  }
}

void main().catch(e => { console.error(e); process.exit(1) })
