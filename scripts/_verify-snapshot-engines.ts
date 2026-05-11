/**
 * Snapshot engine smoke test — verifies the four document-producing
 * engines (pptxgenjs, openpyxl, reportlab, python-docx) all work
 * end-to-end inside a fresh sandbox restored from
 * SANDBOX_SKILLS_SNAPSHOT_ID, by running a canned snippet per
 * engine and then running the structural inspect commands the
 * primers ask the model to run.
 *
 * What this DOES test:
 *   - The snapshot serves all libraries the primers reference.
 *   - The pptxgenjs symlink at /opt/pptxgenjs resolves cleanly.
 *   - The inspect commands return the structural numbers we expect.
 *   - File sizes land in the bands the primers claim.
 *
 * What this DOES NOT test:
 *   - That the model, given the new primer + user prompt, actually
 *     writes good code. That's a separate live-model harness.
 *
 * Why both layers exist:
 *   - Snapshot smoke test catches infra drift (a stale snapshot,
 *     a missing system binary, a moved file). Failures here block
 *     the live test from being meaningful.
 *
 * Usage:
 *   pnpm exec tsx scripts/_verify-snapshot-engines.ts
 */
import { Sandbox } from '@vercel/sandbox'

const SNAPSHOT_ID = process.env.SANDBOX_SKILLS_SNAPSHOT_ID
if (!SNAPSHOT_ID) throw new Error('SANDBOX_SKILLS_SNAPSHOT_ID not set')

type EngineCheck = {
  name: 'pptxgenjs' | 'openpyxl' | 'reportlab' | 'python-docx'
  // Canned snippet — represents the FLOOR of what we expect the model
  // to write when given the new primer. Includes structural elements
  // from the visual charter so the inspect commands have something
  // to assert against.
  build: { lang: 'node' | 'python'; code: string }
  inspect: Array<{ lang: 'sh' | 'python'; code: string; expect: (out: string) => boolean; label: string }>
}

const ENGINES: EngineCheck[] = [
  {
    name: 'pptxgenjs',
    build: {
      lang: 'node',
      code: `
const PptxGenJS = require('/opt/pptxgenjs');
const p = new PptxGenJS();
p.layout = 'LAYOUT_WIDE';
p.defineSlideMaster({
  title: 'CHARTER',
  background: { color: '0B1F3A' },
  objects: [{ rect: { x: 0, y: 7.3, w: 13.333, h: 0.2, fill: { color: 'C7A557' } } }],
});
// Cover
const s1 = p.addSlide({ masterName: 'CHARTER' });
s1.addText('Snapshot smoke test', { x: 0.5, y: 2.5, w: 12, h: 1.5, fontFace: 'Georgia', italic: true, fontSize: 48, color: 'E6D292' });
s1.addText('verifying pptxgenjs engine', { x: 0.5, y: 4.0, w: 12, h: 0.5, fontFace: 'Inter', fontSize: 18, color: 'F5F1E8' });
// Content slide with chart
const s2 = p.addSlide();
s2.addText('Quarterly KPIs', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontFace: 'Georgia', italic: true, fontSize: 32, color: '0B1F3A' });
s2.addChart(p.charts.BAR, [
  { name: 'Revenue', labels: ['Q1','Q2','Q3','Q4'], values: [12, 19, 23, 31] },
], { x: 0.5, y: 1.4, w: 12, h: 5.5, chartColors: ['1E3A5F'], showTitle: false });
s2.addNotes('Speaker note: Q4 acceleration driven by enterprise pipeline.');
// Section divider
const s3 = p.addSlide({ masterName: 'CHARTER' });
s3.addText('Section II', { x: 0.5, y: 3.0, w: 12, h: 1.5, fontFace: 'Georgia', italic: true, fontSize: 60, color: 'E6D292', align: 'center' });
// Closing
const s4 = p.addSlide({ masterName: 'CHARTER' });
s4.addText('Thank you', { x: 0.5, y: 3.0, w: 12, h: 1.5, fontFace: 'Georgia', italic: true, fontSize: 48, color: 'E6D292', align: 'center' });
// Filler content
const s5 = p.addSlide();
s5.addText('Discussion', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontFace: 'Georgia', italic: true, fontSize: 32, color: '0B1F3A' });
s5.addText('Next steps and Q&A.', { x: 0.5, y: 1.4, w: 12, h: 0.5, fontFace: 'Inter', fontSize: 16, color: '4A4A4A' });
s5.addNotes('Speaker note: open the floor.');
p.writeFile({ fileName: '/mnt/user-data/outputs/smoke.pptx' }).then(()=>console.log('ok'));
      `,
    },
    inspect: [
      {
        lang: 'python',
        label: 'slides ≥ 5',
        code: `from pptx import Presentation; print(len(Presentation('/mnt/user-data/outputs/smoke.pptx').slides))`,
        expect: out => Number(out.trim()) >= 5,
      },
      {
        lang: 'python',
        label: 'speaker notes present',
        code: `from pptx import Presentation; p=Presentation('/mnt/user-data/outputs/smoke.pptx'); print(sum(1 for s in p.slides if s.has_notes_slide and s.notes_slide.notes_text_frame.text))`,
        expect: out => Number(out.trim()) >= 1,
      },
      {
        lang: 'sh',
        label: 'file size 30KB-2MB',
        code: `stat -c %s /mnt/user-data/outputs/smoke.pptx`,
        expect: out => { const n = Number(out.trim()); return n >= 30_000 && n <= 2_000_000 },
      },
    ],
  },
  {
    name: 'openpyxl',
    build: {
      lang: 'python',
      code: `
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, LineChart, PieChart, Reference

wb = openpyxl.Workbook()
data = wb.active; data.title = 'Data'
data.sheet_properties.tabColor = '0B1F3A'
data.append(['Region','Revenue','Growth','Date'])
rows = [
    ('North',  120000, 0.12, '2026-01-15'),
    ('South',   95000, 0.07, '2026-01-15'),
    ('East',  155000, 0.21, '2026-01-15'),
    ('West',  110000, 0.09, '2026-01-15'),
    ('Central',88000, 0.04, '2026-01-15'),
]
for r in rows: data.append(r)
for c in data[1]:
    c.font = Font(name='Inter', size=11, bold=True, color='FFFFFF')
    c.fill = PatternFill('solid', '0B1F3A')
    c.alignment = Alignment(horizontal='left', vertical='center')
for col, w in zip('ABCD', (12, 14, 12, 14)): data.column_dimensions[col].width = w
data['B2'].number_format = '$#,##0'; data['B3'].number_format = '$#,##0'; data['B4'].number_format = '$#,##0'; data['B5'].number_format = '$#,##0'; data['B6'].number_format = '$#,##0'
data['C2'].number_format = '0.0%'; data['C3'].number_format = '0.0%'; data['C4'].number_format = '0.0%'; data['C5'].number_format = '0.0%'; data['C6'].number_format = '0.0%'
data.freeze_panes = 'A2'
data.auto_filter.ref = data.dimensions

analytics = wb.create_sheet('Analytics')
analytics.sheet_properties.tabColor = 'C7A557'
analytics['A1'] = 'TOTAL REVENUE'; analytics['A2'] = sum(r[1] for r in rows); analytics['A2'].number_format = '$#,##0'
analytics['A1'].font = Font(name='Inter', size=10, bold=True, color='4A4A4A'); analytics['A1'].fill = PatternFill('solid','F5F1E8')
analytics['A2'].font = Font(name='Georgia', italic=True, size=22, bold=True, color='C7A557')

charts = wb.create_sheet('Charts')
charts.sheet_properties.tabColor = '1E3A5F'
for i, ChartCls in enumerate([BarChart, LineChart, PieChart]):
    ch = ChartCls()
    ch.title = ['Revenue by Region','Revenue Trend','Revenue Mix'][i]
    ch.style = 2
    ref = Reference(data, min_col=2, min_row=1, max_row=len(rows)+1, max_col=2)
    cats = Reference(data, min_col=1, min_row=2, max_row=len(rows)+1)
    ch.add_data(ref, titles_from_data=True)
    ch.set_categories(cats)
    charts.add_chart(ch, f'A{i*18+2}')

wb.properties.title = 'Snapshot smoke test'
wb.properties.creator = 'Clox verification harness'
wb.save('/mnt/user-data/outputs/smoke.xlsx')
print('ok')
      `,
    },
    inspect: [
      {
        lang: 'python',
        label: 'sheets ≥ 2 (Data + Analytics + Charts)',
        code: `import openpyxl; print(len(openpyxl.load_workbook('/mnt/user-data/outputs/smoke.xlsx').sheetnames))`,
        expect: out => Number(out.trim()) >= 2,
      },
      {
        lang: 'python',
        label: 'charts ≥ 3 across workbook',
        code: `import openpyxl; wb=openpyxl.load_workbook('/mnt/user-data/outputs/smoke.xlsx'); print(sum(len(wb[n]._charts) for n in wb.sheetnames))`,
        expect: out => Number(out.trim()) >= 3,
      },
      {
        lang: 'python',
        label: 'header row bold + non-default fill',
        code: `import openpyxl; ws=openpyxl.load_workbook('/mnt/user-data/outputs/smoke.xlsx')['Data']; print(ws['A1'].font.bold, ws['A1'].fill.fgColor.rgb)`,
        expect: out => /True.*0B1F3A/i.test(out),
      },
      {
        lang: 'sh',
        label: 'file size 8KB-500KB',
        code: `stat -c %s /mnt/user-data/outputs/smoke.xlsx`,
        expect: out => { const n = Number(out.trim()); return n >= 8_000 && n <= 500_000 },
      },
    ],
  },
  {
    name: 'reportlab',
    build: {
      lang: 'python',
      code: `
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.units import inch

class NumberedCanvas:
    def __init__(self): self.saved = []

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 9)
    canvas.setFillColorRGB(0.29, 0.29, 0.29)
    canvas.drawString(inch, A4[1]-0.5*inch, 'SNAPSHOT SMOKE TEST')
    canvas.drawRightString(A4[0]-inch, A4[1]-0.5*inch, 'Clox')
    canvas.setStrokeColor(colors.HexColor('#C8CCD2'))
    canvas.line(inch, A4[1]-0.55*inch, A4[0]-inch, A4[1]-0.55*inch)
    canvas.drawCentredString(A4[0]/2, 0.4*inch, f'Page {doc.page} of 4')
    canvas.restoreState()

doc = BaseDocTemplate(
    '/mnt/user-data/outputs/smoke.pdf', pagesize=A4,
    leftMargin=inch, rightMargin=inch, topMargin=1.25*inch, bottomMargin=0.75*inch,
    title='Snapshot smoke test', author='Clox verification harness',
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='body')
doc.addPageTemplates([PageTemplate(id='body', frames=[frame], onPage=header_footer)])

styles = getSampleStyleSheet()
h1 = ParagraphStyle('h1', parent=styles['Heading1'], fontName='Helvetica-Oblique', fontSize=18, textColor=colors.HexColor('#0B1F3A'), spaceAfter=8, spaceBefore=24)
body = ParagraphStyle('body', parent=styles['BodyText'], fontName='Helvetica', fontSize=11, leading=15, textColor=colors.HexColor('#1A1A1A'), alignment=0)

story = [
    Paragraph('Cover Title', ParagraphStyle('cover', fontName='Helvetica-Oblique', fontSize=40, textColor=colors.HexColor('#0B1F3A'), alignment=0, spaceAfter=12)),
    Paragraph('a verification document', ParagraphStyle('sub', fontName='Helvetica', fontSize=14, textColor=colors.HexColor('#4A4A4A'))),
    PageBreak(),
    Paragraph('Section One', h1),
    Paragraph('This is a body paragraph that exists primarily to make the inspect command find at least one page of body text. ' * 8, body),
    Paragraph('Section Two', h1),
    Paragraph('Another body paragraph. ' * 10, body),
    Spacer(1, 0.2*inch),
    Table([['Metric','Value','Trend'],['Revenue','$1.2M','+12%'],['Margin','38%','+3pp']], colWidths=[1.8*inch, 1.5*inch, 1.5*inch], style=TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0B1F3A')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#FFFFFF')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#F5F1E8'), colors.HexColor('#FFFFFF')]),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('LINEABOVE', (0,0), (-1,0), 0.5, colors.HexColor('#1A1A1A')),
        ('LINEBELOW', (0,-1), (-1,-1), 0.5, colors.HexColor('#1A1A1A')),
    ])),
    PageBreak(),
    Paragraph('Section Three', h1),
    Paragraph('More body text. ' * 12, body),
    PageBreak(),
    Paragraph('Closing', h1),
    Paragraph('About this document. ' * 8, body),
]
doc.build(story)
print('ok')
      `,
    },
    inspect: [
      {
        lang: 'python',
        label: 'pages ≥ 4',
        code: `import pypdf; r=pypdf.PdfReader('/mnt/user-data/outputs/smoke.pdf'); print(len(r.pages))`,
        expect: out => Number(out.trim()) >= 4,
      },
      {
        lang: 'python',
        label: 'page-number footer present',
        code: `import pypdf, re; r=pypdf.PdfReader('/mnt/user-data/outputs/smoke.pdf'); t='\\n'.join(p.extract_text() or '' for p in r.pages); print(len(re.findall(r'Page \\d+ of \\d+', t)))`,
        expect: out => Number(out.trim()) >= 3,
      },
      {
        lang: 'python',
        label: 'metadata title set',
        code: `import pypdf; r=pypdf.PdfReader('/mnt/user-data/outputs/smoke.pdf'); print(bool(r.metadata.title))`,
        expect: out => /True/.test(out),
      },
      {
        lang: 'sh',
        label: 'file size 30KB-3MB',
        code: `stat -c %s /mnt/user-data/outputs/smoke.pdf`,
        expect: out => { const n = Number(out.trim()); return n >= 30_000 && n <= 3_000_000 },
      },
    ],
  },
  {
    name: 'python-docx',
    build: {
      lang: 'python',
      code: `
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Mm
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

doc = Document()
# Title section
ts = doc.sections[0]
ts.page_width = Mm(210); ts.page_height = Mm(297)
ts.top_margin = Inches(1.5); ts.bottom_margin = ts.left_margin = ts.right_margin = Inches(1)
title = doc.add_paragraph('Snapshot smoke test'); title.style = doc.styles['Title']
run = title.runs[0]; run.font.name = 'Georgia'; run.font.italic = True; run.font.size = Pt(32); run.font.color.rgb = RGBColor(0x0B, 0x1F, 0x3A)
sub = doc.add_paragraph('Verifying python-docx engine'); sub.style = doc.styles['Subtitle']
sub.runs[0].font.size = Pt(14); sub.runs[0].font.color.rgb = RGBColor(0x4A, 0x4A, 0x4A)

# Section break to body
sec = doc.add_section(WD_SECTION.NEW_PAGE)
sec.top_margin = sec.bottom_margin = sec.left_margin = sec.right_margin = Inches(1)

# Body content
for txt in ['Findings', 'Methodology', 'Recommendations']:
    h = doc.add_heading(txt, level=1)
    h.runs[0].font.name = 'Georgia'; h.runs[0].font.italic = True; h.runs[0].font.size = Pt(18); h.runs[0].font.color.rgb = RGBColor(0x0B, 0x1F, 0x3A)
    for _ in range(3):
        p = doc.add_paragraph('Body text content. ' * 12)
        for r in p.runs: r.font.name = 'Inter'; r.font.size = Pt(11); r.font.color.rgb = RGBColor(0x1A, 0x1A, 0x1A)

# Mutate the Heading-1 style globally too so the inspect command sees it
s = doc.styles['Heading 1']
s.font.name = 'Georgia'; s.font.italic = True; s.font.size = Pt(18); s.font.color.rgb = RGBColor(0x0B, 0x1F, 0x3A)

# Styled table
tbl = doc.add_table(rows=3, cols=3); tbl.style = 'Light Grid Accent 1'
tbl.rows[0].cells[0].text = 'Metric'; tbl.rows[0].cells[1].text = 'Value'; tbl.rows[0].cells[2].text = 'Trend'
for c in tbl.rows[0].cells:
    shd = OxmlElement('w:shd'); shd.set(qn('w:fill'), '0B1F3A'); c._tc.get_or_add_tcPr().append(shd)
    for p in c.paragraphs:
        for r in p.runs: r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF); r.font.bold = True
tbl.rows[1].cells[0].text = 'Revenue'; tbl.rows[1].cells[1].text = '$1.2M'; tbl.rows[1].cells[2].text = '+12%'
tbl.rows[2].cells[0].text = 'Margin';  tbl.rows[2].cells[1].text = '38%';  tbl.rows[2].cells[2].text = '+3pp'

# Footer with PAGE + NUMPAGES fields
footer = sec.footer; fp = footer.paragraphs[0]; fp.text = ''
def add_field(par, instr):
    r = par.add_run()
    fld_begin = OxmlElement('w:fldChar'); fld_begin.set(qn('w:fldCharType'),'begin'); r._r.append(fld_begin)
    instr_el = OxmlElement('w:instrText'); instr_el.text = instr; r._r.append(instr_el)
    fld_end = OxmlElement('w:fldChar'); fld_end.set(qn('w:fldCharType'),'end'); r._r.append(fld_end)
add_field(fp, 'PAGE \\\\* MERGEFORMAT')
fp.add_run(' of ')
add_field(fp, 'NUMPAGES \\\\* MERGEFORMAT')
from docx.enum.text import WD_ALIGN_PARAGRAPH
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER

doc.save('/mnt/user-data/outputs/smoke.docx')
print('ok')
      `,
    },
    inspect: [
      {
        lang: 'python',
        label: 'has Heading 1 paragraphs',
        code: `from docx import Document; d=Document('/mnt/user-data/outputs/smoke.docx'); print(sum(1 for p in d.paragraphs if p.style.name=='Heading 1'))`,
        expect: out => Number(out.trim()) >= 1,
      },
      {
        lang: 'python',
        label: 'has styled table',
        code: `from docx import Document; d=Document('/mnt/user-data/outputs/smoke.docx'); print(len(d.tables), d.tables[0].style.name if d.tables else 'none')`,
        expect: out => /[1-9].*Light Grid Accent/.test(out) || /[1-9].*Accent/.test(out),
      },
      {
        lang: 'python',
        label: 'footer has PAGE + NUMPAGES',
        code: `from docx import Document; d=Document('/mnt/user-data/outputs/smoke.docx'); xml=d.sections[-1].footer.paragraphs[0]._p.xml; print('PAGE' in xml, 'NUMPAGES' in xml)`,
        expect: out => /True True/.test(out),
      },
      {
        lang: 'sh',
        label: 'file size 15KB-1MB',
        code: `stat -c %s /mnt/user-data/outputs/smoke.docx`,
        expect: out => { const n = Number(out.trim()); return n >= 15_000 && n <= 1_000_000 },
      },
    ],
  },
]

type Row = { engine: string; check: string; status: 'PASS' | 'FAIL'; detail: string }

async function main() {
  console.log(`[verify] booting sandbox from ${SNAPSHOT_ID}`)
  const sandbox = await Sandbox.create({
    runtime: 'python3.13',
    timeout: 30 * 60 * 1000,
    source: { type: 'snapshot', snapshotId: SNAPSHOT_ID! },
  })
  const rows: Row[] = []
  try {
    // clean outputs dir between runs for deterministic file-size checks
    await sandbox.runCommand({ cmd: 'sh', args: ['-lc', 'rm -f /mnt/user-data/outputs/smoke.*'] })

    for (const eng of ENGINES) {
      console.log(`\n[verify] === ${eng.name} ===`)
      // BUILD step
      const buildCmd = eng.build.lang === 'node'
        ? { cmd: 'node', args: ['-e', eng.build.code] }
        : { cmd: 'python3', args: ['-c', eng.build.code] }
      const b = await sandbox.runCommand(buildCmd)
      if (b.exitCode !== 0) {
        const err = (await b.stderr()).slice(-1000)
        rows.push({ engine: eng.name, check: 'build', status: 'FAIL', detail: err.replace(/\n/g, ' ') })
        console.log('build FAIL:', err)
        continue
      }
      rows.push({ engine: eng.name, check: 'build', status: 'PASS', detail: (await b.stdout()).trim() })

      // INSPECT steps
      for (const ins of eng.inspect) {
        const insCmd = ins.lang === 'sh'
          ? { cmd: 'sh', args: ['-lc', ins.code] }
          : { cmd: 'python3', args: ['-c', ins.code] }
        const r = await sandbox.runCommand(insCmd)
        const out = (await r.stdout()).trim()
        const ok = r.exitCode === 0 && ins.expect(out)
        rows.push({
          engine: eng.name,
          check: ins.label,
          status: ok ? 'PASS' : 'FAIL',
          detail: out || (await r.stderr()).trim().slice(-200),
        })
      }
    }
  } finally {
    try { await sandbox.stop() } catch { /* swallow */ }
  }

  // Scorecard
  console.log('\n\n=========== SCORECARD ============')
  for (const row of rows) {
    const tag = row.status === 'PASS' ? 'PASS' : 'FAIL'
    console.log(`[${tag}] ${row.engine.padEnd(12)} ${row.check.padEnd(40)} → ${row.detail}`)
  }
  const failed = rows.filter(r => r.status === 'FAIL').length
  console.log(`\n${rows.length - failed}/${rows.length} checks passed`)
  process.exit(failed === 0 ? 0 : 1)
}

void main().catch(e => { console.error(e); process.exit(1) })
