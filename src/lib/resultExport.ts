import type { jsPDF } from 'jspdf';
import type { CellInput, Color, RowInput } from 'jspdf-autotable';

export const COLLEGE_NAME = 'Sufia Motin Mohila College';
export const COLLEGE_ADDRESS = 'Jatrapasha (3351), Baniachong, Habiganj';
/** College crest on the printed sheet — the browser renders it as-is. */
export const COLLEGE_LOGO_URL = '/logo.png';
/** Crest for the PDF export: jsPDF can only embed raster images, so the
 *  crest is shipped as a PNG in /public. */
export const COLLEGE_LOGO_PDF_URL = '/logo.png';
/** Export sheet size (landscape). Legal paper, as used by the office. */
export const PDF_PAGE_FORMAT = 'legal';
/** Unicode font shipped in /public/fonts. The browser uses it to shape
 *  Bengali text before placing it in the PDF; regular table text stays vector. */
export const PDF_FONT_FAMILY = 'NotoSansBengali';
/** Keep Name the same width for every group in print and PDF. */
const RESULT_NAME_COLUMN_PERCENT = 20;
const PDF_FONT_FILES = {
  normal: '/fonts/NotoSansBengali-Regular.ttf',
  bold: '/fonts/NotoSansBengali-Bold.ttf',
} as const;

/** Red-text tone for a marks cell, mirroring the on-screen sheet.
 *  - `fail`     → CQ or MCQ below its pass mark (never the numeric Total)
 *  - `absent`   → A in the Total cell only
 *  - `expelled` → E in the Total cell only */
export type ResultCellTone = 'fail' | 'absent' | 'expelled';

export interface ResultExportSubject {
  name: string;
  inExam: boolean;
  /** Single Total column instead of CQ/MCQ/Total (e.g. English without MCQ). */
  totalOnly?: boolean;
}

export interface ResultExportRow {
  roll: string;
  name: string;
  /** Per-subject CQ/MCQ/Total strings, already formatted like the sheet. */
  cells: string[];
  /** Optional highlight per entry of `cells` (three per subject). */
  cellTones?: (ResultCellTone | null)[];
  /** Position of the student's 4th subject within this group's `subjects`, else -1. */
  fourthSubjectIndex?: number;
  /** Absolute index into `cells` of the 4th subject's Total cell (accounts for
   *  total-only subjects with one cell); renderers prefer this over the /3 math. */
  fourthCellIndex?: number;
  fourthBonus: string;
  /** Science-only practical value (single number per student); undefined hides the column. */
  practical?: string;
  total: string;
  status: string;
}

export interface ResultExportGroup {
  group: string;
  subjects: ResultExportSubject[];
  rows: ResultExportRow[];
  /** Show the Practical column just before Total (Science group only). */
  showPractical?: boolean;
}

export type ResultExamInfo = { name: string; program: string; session: string };

export function resultFileName(exam: ResultExamInfo, group: string): string {
  const safe = (v: string): string => v.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');
  return `Result_${safe(exam.name)}_${safe(exam.program)}_${safe(exam.session)}_${safe(group)}`;
}

const esc = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Space-saving headings for every result column header (on-screen sheet,
 *  print sheet and PDF); data keeps full names. */
export const SHORT_SUBJECT_NAMES: Record<string, string> = {
  'Islamic History and Culture': 'Islamic Hist. & Cult.',
  'Business Organization and Management': 'Business Org. & Mgmt.',
  'Production Management and Marketing': 'Prod. Mgmt. & Mktg.',
  'Political Science': 'Political Sci.',
};

const subjectHeading = (name: string): string => SHORT_SUBJECT_NAMES[name] || name;

/** Short display name for a result column header (full name kept in `title`). */
export function resultColumnHeading(name: string): string {
  return subjectHeading(name);
}

/** Legal-landscape print sheet, with each group starting on a new page. */
export function buildResultPrintHTML(exam: ResultExamInfo, groups: ResultExportGroup[]): string {
  const header = `<header class="masthead"><img class="crest" src="${COLLEGE_LOGO_URL}" alt="" />`
    + `<div class="mast-text"><h1>${esc(COLLEGE_NAME)}</h1><h2>${esc(exam.name)}</h2>`
    + `<p class="meta">${esc(exam.program)} · ${esc(exam.session)}</p></div></header>`
    + `<p class="legend">Rank / Status codes: <b>F</b> = failed subjects, <b>A</b> = absent, <b>E</b> = expelled · “—” = no marks entered</p>`;
  const sections = groups.map((g) => {
    if (g.rows.length === 0) {
      return `<section class="sheet">${header}<h3 class="empty-group">${esc(g.group)}</h3><p class="empty">No results</p></section>`;
    }
    const subjectCols = g.subjects.reduce((n, s) => n + (s.totalOnly ? 1 : 3), 0);
    const totalCols = 2 + subjectCols + 3 + (g.showPractical ? 1 : 0);
    const rowSpan = g.subjects.length ? ' rowspan="2"' : '';
    const headTop = g.subjects
      .map((s) => `<th class="band${s.inExam ? '' : ' dim'}" colspan="${s.totalOnly ? 1 : 3}" title="${esc(s.name)}${s.totalOnly ? ' (Total only)' : ''}">${esc(subjectHeading(s.name))}</th>`)
      .join('');
    const practicalHead = g.showPractical ? `<th${rowSpan} title="Science practical marks, summed into the Total">Practical</th>` : '';
    const headSub = g.subjects.map((s) => s.totalOnly
      ? '<th class="tot">Total</th>'
      : '<th>CQ</th><th>MCQ</th><th class="tot">Total</th>').join('');
    // Absolute positions of Total cells (total-only subjects shift them).
    const totalIdx = new Set<number>();
    {
      let off = 0;
      for (const s of g.subjects) {
        const w = s.totalOnly ? 1 : 3;
        totalIdx.add(off + w - 1);
        off += w;
      }
    }
    const body = g.rows.map((r) => {
      const tds = r.cells.map((c, ci) => {
        const tone = r.cellTones?.[ci] ?? null;
        // Only the 4th subject's Total cell has a yellow fill (CQ/MCQ stay plain).
        // fourthCellIndex is the absolute position (total-only subjects shift it);
        // fall back to the /3 math for rows built without it.
        const isFourth = r.fourthCellIndex != null && r.fourthCellIndex >= 0
          ? ci === r.fourthCellIndex
          : r.fourthSubjectIndex !== undefined
            && r.fourthSubjectIndex >= 0
            && Math.floor(ci / 3) === r.fourthSubjectIndex
            && ci % 3 === 2;
        const classes = [
          totalIdx.has(ci) ? 'tot' : '',
          isFourth ? 'fourth' : '',
          tone ? 'red' : '',
        ].filter(Boolean).join(' ');
        return `<td${classes ? ` class="${classes}"` : ''}>${esc(c)}</td>`;
      }).join('');
      return `<tr><td class="n">${esc(r.roll)}</td><td>${esc(r.name)}</td>${tds}<td class="n">${esc(r.fourthBonus)}</td>${g.showPractical ? `<td class="n">${esc(r.practical ?? '—')}</td>` : ''}<td class="n b">${esc(r.total)}</td><td class="st">${esc(r.status)}</td></tr>`;
    }).join('');
    return `<section class="sheet">${header}<table><colgroup><col class="c-roll" /><col class="c-name" />`
      + g.subjects.map((s, si) => {
        const span = s.totalOnly ? 1 : 3;
        // First subject band (English) is ~1.5× wider so its name fits.
        return si === 0
          ? `<col span="${span}" style="width:${span * 46}px" />`
          : `<col class="c-sub" span="${span}" />`;
      }).join('')
      + (g.showPractical ? '<col class="c-prac" />' : '')
      + `<col class="c-bonus" /><col class="c-total" /><col class="c-status" /></colgroup>`
      + `<thead><tr class="groupbar"><th colspan="${totalCols}">${esc(g.group)}</th></tr>`
      + `<tr><th${rowSpan}>Roll</th><th${rowSpan}>Name</th>${headTop}<th${rowSpan}>4th Bonus</th>${practicalHead}<th${rowSpan}>Total</th><th${rowSpan}>Rank / Status</th></tr>`
      + (g.subjects.length ? `<tr>${headSub}</tr>` : '')
      + `</thead><tbody>${body}</tbody></table></section>`;
  }).join('');
  const css = `*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}`
    + `body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:9pt;line-height:1.3}`
    + `.sheet+.sheet{break-before:page;page-break-before:always}`
    + `.masthead{display:flex;align-items:center;gap:10px;border-bottom:1px solid #bbb;padding-bottom:9px;margin-bottom:12px;break-after:avoid;page-break-after:avoid}`
    + `.masthead .crest{width:34px;height:34px;flex:0 0 34px;display:block}`
    + `.mast-text h1{font-size:14pt;margin:0}`
    + `.mast-text h2{font-size:10pt;margin:2px 0 0}`
    + `.mast-text .meta{font-size:8pt;color:#555;margin:2px 0 0}`
    + `.legend{font-size:8pt;color:#444;margin:0 0 8px}`
    + `table{width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.25pt}`
    + `thead{display:table-header-group}tfoot{display:table-footer-group}tr{page-break-inside:avoid}`
    + `th,td{border:.7pt solid #555;padding:2.5px 3px;text-align:center;overflow:hidden;word-wrap:break-word;vertical-align:middle}`
    + `tbody td{padding-top:4px;padding-bottom:4px}`
    + `th{background:#eef4ee;font-size:9pt}th.band{font-size:8pt}thead tr:last-child th{font-size:7.5pt;color:#444}`
    + `th.tot,td.tot{background:#f7faf7}td.tot{color:#000}td.n{white-space:nowrap}td.b{font-weight:bold}`
    + `td.st{font-size:9.25pt;white-space:normal}`
    + `td.fourth{background:${PRINT_FOURTH}!important;color:#000}`
    + `td.red{color:${PRINT_RED}!important;font-weight:bold}`
    + `.c-roll{width:56px}.c-name{width:${RESULT_NAME_COLUMN_PERCENT}%}.c-sub{width:auto}.c-prac{width:44px}.c-bonus{width:48px}.c-total{width:38px}.c-status{width:84px}`
    + `.groupbar th{background:#eef4ee!important;color:#111;font-size:11.25pt;text-align:center;padding:5px 7px}`
    + `.empty-group{background:#eef4ee;font-size:9pt;margin:0;padding:5px 7px}`
    + `.empty{border:1px solid #ddd;color:#666;margin:0;padding:10px 7px}.dim{color:#888}`
    + `@page{size:14in 8.5in;margin:8mm 7mm}`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${esc(exam.name)} — Result</title><style>${css}</style></head><body>${sections}</body></html>`;
}

/** Fail/absent/expelled marks are shown as red text (no fill tint), so they read
 *  clearly on the office's black-and-white printers too. */
const TONE_TEXT: Record<ResultCellTone, [number, number, number]> = {
  fail: [185, 28, 28],
  absent: [185, 28, 28],
  expelled: [185, 28, 28],
};
/** yellow-200 fill for the 4th-subject Total cell, matching the on-screen sheet. */
const FOURTH_FILL: [number, number, number] = [254, 240, 138];
/** Black text used on the yellow 4th-subject Total cell. */
const FOURTH_TEXT: [number, number, number] = [0, 0, 0];
/** Red text (hex) for inline-styled cells in the print sheet. */
const PRINT_RED = '#b91c1c';
/** Yellow fill (hex) for the 4th-subject Total cell in the print sheet. */
const PRINT_FOURTH = '#fef08a';

/**
 * Column widths (mm) for the PDF sheet. autoTable's auto-width used to hand the
 * subject-name column ~10mm while letting long subject names inflate their CQ
 * column, so the header band never lined up with the data. Fixing every width
 * ourselves keeps the two header rows and all data rows on one grid.
 */
/** Exported for width sanity-checks: fixed per-column mm widths for the PDF sheet.
 *  The first subject band (English in every HSC group) gets `firstMult`× width
 *  so its name fits; the rest share what's left. */
export function resultColumnWidths(usableWidth: number, subjectColumns: number, nameWidth: number, extraSingle = 0, firstSpan = 0, firstMult = 1.5): number[] {
  // Name uses one fixed width for the whole export; the additional subjects in
  // Humanities divide the remaining space without shrinking the Name column.
  // subjectColumns is the count of CQ/MCQ/Total-level columns (total-only
  // subjects contribute 1 instead of 3).
  const wide = subjectColumns > 27;
  const roll = wide ? 8 : 9;
  const bonus = wide ? 9 : 10;
  const practical = wide ? 8 : 9;
  // Kept narrow on purpose so subject bands get maximum width: rolls, bonuses
  // and totals are short numbers and Rank/Status holds codes like 1st or F: 2.
  const total = wide ? 8 : 10;
  const status = wide ? 17 : 22;
  const fixed = roll + bonus + practical * extraSingle + total + status;
  const span = Math.min(firstSpan, subjectColumns);
  const normal = subjectColumns - span;
  const unit = subjectColumns > 0 ? (usableWidth - fixed - nameWidth) / (normal + span * firstMult) : 0;

  const widths = [roll, nameWidth];
  for (let i = 0; i < subjectColumns; i += 1) widths.push(i < span ? unit * firstMult : unit);
  widths.push(bonus);
  for (let i = 0; i < extraSingle; i += 1) widths.push(practical);
  widths.push(total, status);
  return widths;
}

/** The slice of the jsPDF API these helpers touch. */
interface PdfDocLike {
  setFont: (family: string, style?: string) => void;
  setFontSize: (size: number) => void;
  getTextWidth: (text: string) => number;
  addFileToVFS: (filename: string, content: string) => void;
  addFont: (postScriptName: string, id: string, style: string) => void;
}

/** Band-header font shrinking shared by the PDF sheet: one size for the whole
 *  file, driven by the tightest subject band — but never below `minSize`, so
 *  names stay readable and tighter bands wrap instead of shrinking further.
 *  Exported for measurement checks. */
export function bandHeaderFontSize(
  doc: PdfDocLike,
  family: string,
  samples: { text: string; width: number }[],
  minSize = 8
): number {
  let size = 8.75;
  for (const s of samples) {
    size = Math.min(size, fitFontSize(doc, family, s.text, s.width, 'bold'));
  }
  return Math.max(minSize, size);
}

/** Largest font size (pt) at which `text` still fits `maxWidth` mm on one line. */
function fitFontSize(
  doc: PdfDocLike,
  family: string,
  text: string,
  maxWidth: number,
  fontStyle: 'bold' | 'normal'
): number {
  const sizes = [8.75, 8.25, 7.75, 7.25, 7, 6.75, 6.5, 6, 5.5, 5, 4.5];
  doc.setFont(family, fontStyle);
  for (const size of sizes) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) return size;
  }
  return sizes[sizes.length - 1];
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Load the shipped font into both jsPDF and the browser's shaping engine. */
async function registerUnicodeFont(doc: PdfDocLike): Promise<boolean> {
  try {
    const [regular, bold] = await Promise.all([
      fetchFontBuffer(PDF_FONT_FILES.normal),
      fetchFontBuffer(PDF_FONT_FILES.bold),
    ]);
    doc.addFileToVFS('NotoSansBengali-Regular.ttf', base64FromBytes(new Uint8Array(regular)));
    doc.addFileToVFS('NotoSansBengali-Bold.ttf', base64FromBytes(new Uint8Array(bold)));
    doc.addFont('NotoSansBengali-Regular.ttf', PDF_FONT_FAMILY, 'normal');
    doc.addFont('NotoSansBengali-Bold.ttf', PDF_FONT_FAMILY, 'bold');

    if (typeof FontFace === 'undefined' || typeof document === 'undefined') return false;
    const [regularFace, boldFace] = await Promise.all([
      new FontFace(PDF_FONT_FAMILY, regular, { weight: '400' }).load(),
      new FontFace(PDF_FONT_FAMILY, bold, { weight: '700' }).load(),
    ]);
    document.fonts.add(regularFace);
    document.fonts.add(boldFace);
    return true;
  } catch {
    return false;
  }
}

async function fetchFontBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font ${url} responded ${res.status}`);
  return res.arrayBuffer();
}

// jsPDF can embed Unicode glyphs, but it does not reliably shape complex scripts
// such as Bengali. Let the browser shape those strings and place only those
// cells as crisp, transparent images; ASCII marks and borders remain PDF text.
const needsBrowserShaping = (text: string): boolean => /[^\p{ASCII}\u2013\u2014]/u.test(text);

function pdfTextColor(color: Color): string {
  if (Array.isArray(color)) return `rgb(${color.join(',')})`;
  if (typeof color === 'number') return `rgb(${color},${color},${color})`;
  return typeof color === 'string' ? color : '#111';
}

function drawShapedText(
  doc: jsPDF,
  text: string,
  fontSize: number,
  bold: boolean,
  color: Color,
  x: number,
  y: number,
  width: number,
  height: number,
  align: 'left' | 'center' = 'center'
): void {
  if (width <= 0 || height <= 0) return;
  const fontPx = fontSize * (96 / 72);
  const font = `${bold ? '700' : '400'} ${fontPx}px "${PDF_FONT_FAMILY}"`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable for Unicode PDF text.');
  ctx.font = font;
  const naturalWidth = Math.ceil(ctx.measureText(text).width + 4);
  const naturalHeight = Math.ceil(fontPx * 1.6);
  const resolution = 3;
  canvas.width = naturalWidth * resolution;
  canvas.height = naturalHeight * resolution;
  const imageCtx = canvas.getContext('2d');
  if (!imageCtx) throw new Error('Canvas is unavailable for Unicode PDF text.');
  imageCtx.scale(resolution, resolution);
  imageCtx.font = font;
  imageCtx.textBaseline = 'middle';
  imageCtx.fillStyle = pdfTextColor(color);
  imageCtx.fillText(text, 2, naturalHeight / 2);

  const mmPerPixel = 25.4 / 96;
  const naturalWidthMm = naturalWidth * mmPerPixel;
  const naturalHeightMm = naturalHeight * mmPerPixel;
  const scale = Math.min(1, width / naturalWidthMm, height / naturalHeightMm);
  const imageWidth = naturalWidthMm * scale;
  const imageHeight = naturalHeightMm * scale;
  doc.addImage(
    canvas.toDataURL('image/png'), 'PNG',
    align === 'center' ? x + (width - imageWidth) / 2 : x,
    y + (height - imageHeight) / 2,
    imageWidth, imageHeight
  );
}

/** Image types jsPDF can decode, keyed by file extension. */
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Loads the crest as a data URL jsPDF can embed. */
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(COLLEGE_LOGO_PDF_URL);
    if (!res.ok) return null;
    // jsPDF picks its decoder from the data URL's media type, so never let a
    // host's generic content type (e.g. application/octet-stream) hide the crest.
    const header = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = COLLEGE_LOGO_PDF_URL.split('.').pop()?.toLowerCase() ?? '';
    const mime = header.startsWith('image/') ? header : IMAGE_MIME[ext] ?? 'image/png';
    const bytes = new Uint8Array(await res.arrayBuffer());
    return `data:${mime};base64,${base64FromBytes(bytes)}`;
  } catch {
    return null;
  }
}

/** Real .pdf file via jsPDF: masthead on each group's first page only. */
export async function downloadResultPDF(exam: ResultExamInfo, groups: ResultExportGroup[]): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: PDF_PAGE_FORMAT });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableW = pageW - margin * 2;
  const nameColumnWidth = usableW * RESULT_NAME_COLUMN_PERCENT / 100;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const [unicodeFont, logo] = await Promise.all([registerUnicodeFont(doc), loadLogoDataUrl()]);
  const hasUnicode = [exam.name, exam.program, exam.session].some(needsBrowserShaping) || groups.some((g) =>
    needsBrowserShaping(g.group) ||
    g.subjects.some((s) => needsBrowserShaping(s.name)) ||
    g.rows.some((r) => [r.roll, r.name, ...r.cells, r.fourthBonus, r.total, r.status].some(needsBrowserShaping))
  );
  if (hasUnicode && !unicodeFont) {
    throw new Error('Unable to load the Bengali PDF font. Check that /fonts is accessible and try again.');
  }
  const font = unicodeFont ? PDF_FONT_FAMILY : 'helvetica';
  const logoSize = 16;
  const dataPad = 0.4;
  const headPad = 0.4;
  const subjectColsOf = (subjects: ResultExportSubject[]): number =>
    subjects.reduce((n, s) => n + (s.totalOnly ? 1 : 3), 0);
  // Sub-column span of the first subject band (widened 1.5× so e.g. a
  // Total-only English name fits); 0 when the group has no subjects.
  const firstSpanOf = (subjects: ResultExportSubject[]): number =>
    subjects.length === 0 ? 0 : (subjects[0].totalOnly ? 1 : 3);
  const subjectWidths = groups
    .filter((g) => g.subjects.length > 0)
    .map((g) => {
      const cols = subjectColsOf(g.subjects);
      const fS = firstSpanOf(g.subjects);
      const ws = resultColumnWidths(usableW, cols, nameColumnWidth, g.showPractical ? 1 : 0, fS);
      // Data digits live in normal-width columns; the widened first band is
      // roomier by design, so measure the narrowest normal column instead.
      return ws[2 + Math.min(fS, cols - 1)] ?? ws[2];
    });
  const narrowestSubject = subjectWidths.length ? Math.min(...subjectWidths) : null;
  // One size for the entire PDF, based on the tightest group rather than each
  // group's width. Denser groups no longer appear smaller than sparse groups.
  // Floored at 7pt: narrow columns never force micro-type; longer values wrap.
  const dataSize = narrowestSubject === null
    ? 8.75
    : Math.max(7, fitFontSize(doc, font, '888', narrowestSubject - dataPad * 2, 'normal'));
  const subLabelSize = narrowestSubject === null
    ? 8.75
    : Math.max(7, fitFontSize(doc, font, 'Total', narrowestSubject - headPad * 2, 'bold'));
  // Band headers (subject names) shrink to fit their band on one line instead
  // of wrapping mid-word. One size for the whole PDF, driven by the tightest
  // band — e.g. a Total-only English column is a single sub-column wide.
  let bandSize = 8.75;
  {
    const samples: { text: string; width: number }[] = [];
    for (const g of groups) {
      if (g.subjects.length === 0) continue;
      const fS = firstSpanOf(g.subjects);
      const nCols = subjectColsOf(g.subjects);
      const cols = resultColumnWidths(usableW, nCols, nameColumnWidth, g.showPractical ? 1 : 0, fS);
      const firstW = cols[2];
      const restW = nCols > fS ? cols[2 + fS] : firstW;
      g.subjects.forEach((s, si) => {
        const bandW = (si === 0 ? firstW : restW) * (s.totalOnly ? 1 : 3);
        samples.push({ text: subjectHeading(s.name), width: bandW - headPad * 2 });
      });
    }
    bandSize = bandHeaderFontSize(doc, font, samples);
  }

  groups.forEach((g, gi) => {
    if (gi > 0) doc.addPage();
    if (logo) {
      try { doc.addImage(logo, 'PNG', margin, margin, logoSize, logoSize); } catch { /* logo optional */ }
    }
    doc.setFont(font, 'bold'); doc.setFontSize(15); doc.setTextColor(4, 64, 47);
    doc.text(COLLEGE_NAME, margin + logoSize + 4, margin + 5);
    doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(80);
    doc.text(COLLEGE_ADDRESS, margin + logoSize + 4, margin + 9.5);
    doc.setFont(font, 'bold'); doc.setFontSize(11); doc.setTextColor(20);
    if (needsBrowserShaping(exam.name)) {
      const titleX = margin + logoSize + 4;
      drawShapedText(doc, exam.name, 11, true, 20, titleX, margin + 11, pageW - margin - titleX, 7, 'left');
    } else {
      doc.text(exam.name, margin + logoSize + 4, margin + 14.5);
    }
    doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(60);
    const examMeta = `Program: ${exam.program}   |   Session: ${exam.session}`;
    if (needsBrowserShaping(examMeta)) {
      const metaX = margin + logoSize + 4;
      drawShapedText(doc, examMeta, 8, false, 60, metaX, margin + 16, pageW - margin - metaX, 5, 'left');
    } else {
      doc.text(examMeta, margin + logoSize + 4, margin + 18.5);
    }
    doc.setDrawColor(4, 64, 47); doc.setLineWidth(0.7);
    doc.line(margin, margin + 22, pageW - margin, margin + 22);
    const startY = margin + 26;

    const subjectCols = g.subjects.reduce((n, s) => n + (s.totalOnly ? 1 : 3), 0);
    const totalCols = 2 + subjectCols + 3 + (g.showPractical ? 1 : 0);
    const widths = resultColumnWidths(usableW, subjectCols, nameColumnWidth, g.showPractical ? 1 : 0, firstSpanOf(g.subjects));
    const columnStyles: Record<string, { cellWidth: number }> = {};
    widths.forEach((w, i) => {
      columnStyles[String(i)] = { cellWidth: w };
    });

    // Same three header rows as the print sheet: group strip (repeats on every
    // page), subject bands spanning their CQ/MCQ/Total columns, then the
    // sub-column labels. Roll/Name/4th Bonus/Total/Rank span both label rows.
    // Total-only subjects contribute a single Total sub-column.
    const totalIdx = new Set<number>();
    {
      let off = 0;
      for (const s of g.subjects) {
        const w = s.totalOnly ? 1 : 3;
        totalIdx.add(off + w - 1);
        off += w;
      }
    }
    const subLabels = g.subjects.flatMap((s) => (s.totalOnly ? ['Total'] : ['CQ', 'MCQ', 'Total']).map((label) => ({
      content: label,
      styles: { fontSize: subLabelSize },
    })));
    const rowSpan = subLabels.length > 0 ? 2 : 1;
    const head: RowInput[] = [
      [{
        content: `Group: ${g.group}`,
        colSpan: totalCols,
        styles: { halign: 'center', fillColor: [4, 64, 47], textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
      }],
      [
        { content: 'Roll', rowSpan },
        { content: 'Name', rowSpan },
        ...g.subjects.map((s) => ({ content: subjectHeading(s.name), colSpan: s.totalOnly ? 1 : 3, styles: { fontSize: bandSize } })),
        { content: '4th Bonus', rowSpan },
        ...(g.showPractical ? [{ content: 'Practical', rowSpan }] : []),
        { content: 'Total', rowSpan },
        { content: 'Rank / Status', rowSpan },
      ],
      ...(subLabels.length > 0 ? [subLabels] : []),
    ];

    // Only failed CQ/MCQ components use red text; numeric Totals stay black.
    // A/E appears in red only in Total. The 4th-subject Total keeps its yellow
    // fill with black numeric text or red A/E text.
    const body: RowInput[] = g.rows.map((r) => {
      const cells: CellInput[] = [r.roll, r.name];
      r.cells.forEach((value, ci) => {
        const tone = r.cellTones?.[ci] ?? null;
        // Only the 4th subject's Total cell has a yellow fill (CQ/MCQ stay plain).
        const isFourth = r.fourthCellIndex != null && r.fourthCellIndex >= 0
          ? ci === r.fourthCellIndex
          : r.fourthSubjectIndex !== undefined
            && r.fourthSubjectIndex >= 0
            && Math.floor(ci / 3) === r.fourthSubjectIndex
            && ci % 3 === 2;
        if (tone || totalIdx.has(ci)) {
          cells.push({
            content: value,
            styles: {
              fillColor: isFourth ? FOURTH_FILL : false,
              textColor: tone ? TONE_TEXT[tone] : FOURTH_TEXT,
              fontStyle: tone ? 'bold' : 'normal',
            },
          });
        } else {
          cells.push(value);
        }
      });
      cells.push(r.fourthBonus);
      if (g.showPractical) cells.push(r.practical ?? '—');
      cells.push(r.total, r.status);
      return cells;
    });

    const shapedCells = new WeakMap<object, string>();
    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin, top: margin + 6, bottom: margin + 4 },
      head,
      body,
      theme: 'grid',
      showHead: 'everyPage',
      styles: {
        font,
        fontSize: dataSize,
        cellPadding: { top: 1.2, bottom: 1.2, left: dataPad, right: dataPad },
        textColor: 20,
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak',
        lineColor: 120,
        lineWidth: 0.1,
      },
      bodyStyles: { minCellHeight: 7 },
      headStyles: {
        font,
        fillColor: [239, 247, 242],
        textColor: 20,
        fontStyle: 'bold',
        fontSize: 8.75,
        cellPadding: { top: 1, right: headPad, bottom: 1, left: headPad },
      },
      columnStyles,
      didParseCell: ({ cell }) => {
        const text = cell.text.join(' ');
        if (needsBrowserShaping(text)) {
          shapedCells.set(cell, text);
          cell.text = ['']; // Suppress jsPDF's unshaped Unicode glyphs.
        }
      },
      didDrawCell: ({ cell }) => {
        const text = shapedCells.get(cell);
        if (!text) return;
        drawShapedText(
          doc, text, cell.styles.fontSize, cell.styles.fontStyle.includes('bold'),
          cell.styles.textColor, cell.x + cell.padding('left'), cell.y + cell.padding('top'),
          cell.width - cell.padding('horizontal'), cell.height - cell.padding('vertical')
        );
      },
      didDrawPage: () => {
        doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(110);
        const footer = `Group: ${g.group}  |  ${exam.name}  |  Published: ${today}  |  Page ${doc.getNumberOfPages()}`
          + `  |  F = failed, A = absent, E = expelled`;
        if (needsBrowserShaping(footer)) {
          drawShapedText(doc, footer, 8, false, 110, margin, pageH - 10, usableW, 5, 'left');
        } else {
          doc.text(footer, margin, pageH - 6);
        }
      },
    });
  });

  doc.save(`${resultFileName(exam, groups.length === 1 ? groups[0].group : 'All_Groups')}.pdf`);
}

/** Print view: same sheet in a new tab; user picks printer or "Save as PDF". */
export function printResultSheet(exam: ResultExamInfo, groups: ResultExportGroup[]): void {
  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) return;
  w.document.write(buildResultPrintHTML(exam, groups));
  w.document.close();
  w.focus();
  window.setTimeout(() => { w.print(); }, 350);
}

// ---------------------------------------------------------------------------
// Exam summary sheet: one page per group with toppers, pass/fail counts, fail
// distribution and subject-wise pass rates, under a college-pad masthead.
// ---------------------------------------------------------------------------

export interface SummaryTopStudent {
  roll: string;
  name: string;
  total: number;
}

export interface SummarySubject {
  subject: string;
  appeared: number;
  passed: number;
  failed: number;
}

export interface SummaryFailBucket {
  /** Failed-subject count as a string ("1".."N"); one bucket per count present. */
  failedIn: string;
  count: number;
}

export interface SummaryGroup {
  group: string;
  total: number;
  appeared: number;
  notAppeared: number;
  passed: number;
  failed: number;
  absentExpelled: number;
  /** Pass % over appeared students, 0–100. */
  passRate: number;
  average: number;
  highest: number;
  lowest: number;
  /** Science only: mean practical over students who have one. */
  avgPractical?: number;
  top3: SummaryTopStudent[];
  failDist: SummaryFailBucket[];
  subjects: SummarySubject[];
}

export interface ExamSummaryData {
  groups: SummaryGroup[];
}

/** College-pad print sheet for the exam summary (legal landscape). */
export function buildSummaryPrintHTML(exam: ResultExamInfo, summary: ExamSummaryData): string {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const header = `<header class="masthead"><img class="crest" src="${COLLEGE_LOGO_URL}" alt="College crest" />`
    + `<h1>${esc(COLLEGE_NAME)}</h1><p class="addr">${esc(COLLEGE_ADDRESS)}</p><h2>${esc(exam.name)} — Exam Summary</h2>`
    + `<p class="meta">${esc(exam.program)} · ${esc(exam.session)} · Published: ${esc(today)}</p></header>`;
  const grand = summary.groups.reduce(
    (a, g) => ({ appeared: a.appeared + g.appeared, passed: a.passed + g.passed, failed: a.failed + g.failed }),
    { appeared: 0, passed: 0, failed: 0 }
  );
  const grandRate = grand.appeared ? (grand.passed / grand.appeared) * 100 : 0;
  const stat = (label: string, value: string): string =>
    `<div class="stat"><span class="sv">${esc(value)}</span><span class="sl">${esc(label)}</span></div>`;
  const grandHtml = `<div class="grand">${stat('Total appeared', String(grand.appeared))}${stat('Total passed', String(grand.passed))}${stat('Total failed', String(grand.failed))}${stat('Overall pass rate', grandRate.toFixed(1) + '%')}</div>`;
  const sections = summary.groups.map((g, gi) => {
    const topRows = g.top3.length
      ? g.top3.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.roll)}</td><td class="l">${esc(t.name)}</td><td class="b">${t.total}</td></tr>`).join('')
      : '<tr><td colspan="4" class="empty">No rank-eligible students</td></tr>';
    const distRows = g.failDist.map((d) =>
      `<tr><td>Failed in ${esc(d.failedIn)} subject${d.failedIn === '1' ? '' : 's'}</td><td class="b">${d.count}</td></tr>`).join('');    const subjRows = g.subjects.length
      ? g.subjects.map((s) => {
        const rate = s.appeared ? Math.round((s.passed / s.appeared) * 100) : 0;
        return `<tr><td class="l">${esc(s.subject)}</td><td>${s.appeared}</td><td>${s.passed}</td><td class="red">${s.failed}</td><td class="b">${rate}%</td></tr>`;
      }).join('')
      : '<tr><td colspan="5" class="empty">No subjects</td></tr>';
    return `<section class="sheet">${header}${gi === 0 ? grandHtml : ''}<h3 class="groupbar">${esc(g.group)} — ${g.appeared}/${g.total} appeared · Pass ${g.passRate.toFixed(1)}%</h3>`
      + `<div class="stats">`
      + stat('Appeared', String(g.appeared))
      + stat('Passed', String(g.passed))
      + stat('Failed', String(g.failed))
      + stat('Absent/Expelled', String(g.absentExpelled))
      + stat('Not appeared', String(g.notAppeared))
      + stat('Average', g.appeared ? g.average.toFixed(1) : '—')
      + stat('Highest', g.appeared ? String(g.highest) : '—')
      + stat('Lowest', g.appeared ? String(g.lowest) : '—')
      + (g.avgPractical != null ? stat('Avg practical', g.avgPractical.toFixed(1)) : '')
      + `</div>`
      + `<div class="cols"><div><h4>Top 3 students</h4><table><colgroup><col style="width:10mm" /><col style="width:16mm" /><col /><col style="width:18mm" /></colgroup><thead><tr><th>#</th><th>Roll</th><th class="l">Name</th><th>Total</th></tr></thead><tbody>${topRows}</tbody></table></div>`
      + `<div><h4>Fail distribution</h4><table><colgroup><col /><col style="width:22mm" /></colgroup><thead><tr><th class="l">Fail bracket</th><th>Students</th></tr></thead><tbody>${distRows}</tbody></table></div></div>`
      + `<h4>Subject-wise performance</h4><table><colgroup><col /><col style="width:22mm" span="4" /></colgroup><thead><tr><th class="l">Subject</th><th>Appeared</th><th>Passed</th><th>Failed</th><th>Pass %</th></tr></thead><tbody>${subjRows}</tbody></table></section>`;
  }).join('');
  const css = `*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}`
    + `body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:9pt;line-height:1.35}`
    + `.sheet+.sheet{break-before:page;page-break-before:always}`
    + `.masthead{text-align:center;border-bottom:2px solid #04402f;padding-bottom:10px;margin-bottom:12px;break-after:avoid}`
    + `.masthead .crest{width:44px;height:44px;display:block;margin:0 auto 6px}`
    + `.masthead h1{font-size:16pt;margin:0;color:#04402f}.masthead .addr{font-size:8pt;color:#555;margin:1px 0 0}`
    + `.masthead h2{font-size:11pt;margin:3px 0 0}.masthead .meta{font-size:8pt;color:#555;margin:2px 0 0}`
    + `.grand{display:flex;gap:8px;margin:0 0 12px;break-inside:avoid}`
    + `.stat{flex:1;border:.7pt solid #555;border-radius:6px;padding:6px 4px;text-align:center;background:#f7faf7}`
    + `.stat .sv{display:block;font-size:13pt;font-weight:bold}.stat .sl{display:block;font-size:7.5pt;color:#444}`
    + `.stats{display:flex;gap:6px;margin:8px 0 10px;flex-wrap:wrap}.stats .stat{min-width:72px}`
    + `h3.groupbar{background:#eef4ee;font-size:11pt;margin:0 0 2px;padding:6px 8px;border:.7pt solid #555}`
    + `h4{font-size:9.5pt;margin:10px 0 4px}`
    + `.cols{display:flex;gap:12px;flex-wrap:wrap}.cols>div{flex:1 1 260px;min-width:0}`
    + `table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt}`
    + `th,td{border:.7pt solid #555;padding:3px 4px;text-align:center;overflow:hidden;word-wrap:break-word;font-size:10pt}`
    + `th{background:#eef4ee}td.l,th.l{text-align:left}td.red{color:#b91c1c}td.empty{color:#666}`
    + `@page{size:A4 portrait;margin:9mm 8mm}`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${esc(exam.name)} — Exam Summary</title><style>${css}</style></head><body>`
    + sections + `</body></html>`;
}

/** Print view for the exam summary in a new tab. */
export function printSummarySheet(exam: ResultExamInfo, summary: ExamSummaryData): void {
  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) return;
  w.document.write(buildSummaryPrintHTML(exam, summary));
  w.document.close();
  w.focus();
  window.setTimeout(() => { w.print(); }, 350);
}

// ---------------------------------------------------------------------------
// In-course result sheet (Honours/Degree): SL, Roll, Name block (name + regi +
// father), per-subject Paper/Atte/Total, paper Total, average Atte, blank
// Remarks. Legal landscape — subject count varies per exam.
// ---------------------------------------------------------------------------

export interface InCoursePrintRow {
  roll: string;
  /** Stacked lines: name, "Regi: …", "Father: …" (empties already dropped). */
  nameBlock: string[];
  /** Three strings (paper, atte, total-or-A/—) per exam subject, in order. */
  cells: string[];
  /** Sum of paper marks, or '—'. */
  total: string;
  /** Average attendance, or '—'. */
  atte: string;
}

/** College-pad print sheet for one in-course exam result. */
export function buildIncoursePrintHTML(
  exam: ResultExamInfo,
  subjects: string[],
  rows: InCoursePrintRow[]
): string {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const header = `<header class="masthead"><img class="crest" src="${COLLEGE_LOGO_URL}" alt="College crest" />`
    + `<h1>${esc(COLLEGE_NAME)}</h1><p class="addr">${esc(COLLEGE_ADDRESS)}</p><h2>${esc(exam.name)} — In-Course Result</h2>`
    + `<p class="meta">${esc(exam.program)} · ${esc(exam.session)} · Published: ${esc(today)}</p></header>`;
  const headTop = subjects
    .map((s) => `<th colspan="3" title="${esc(s)}">${esc(s)}</th>`)
    .join('');
  const headSub = subjects.map(() => '<th>Paper</th><th>Atte</th><th class="tot">Total</th>').join('');
  const body = rows.length
    ? rows.map((r, i) => {
      const nameTds = r.nameBlock.map((line, li) => (li === 0 ? esc(line) : `<br/>${esc(line)}`)).join('');
      const tds = r.cells.map((c) => `<td>${esc(c)}</td>`).join('');
      return `<tr><td class="n">${i + 1}</td><td class="n">${esc(r.roll)}</td><td class="l">${nameTds}</td>${tds}<td class="n b">${esc(r.total)}</td><td class="n">${esc(r.atte)}</td><td class="rmk"></td></tr>`;
    }).join('')
    : `<tr><td colspan="${4 + subjects.length * 3 + 3}" class="empty">No students</td></tr>`;
  // SL 10 / Roll 14 / Name auto / each subject band equal / Total 14 / Atte 14 / Remarks 22.
  const colgroup = `<colgroup><col style="width:10mm" /><col style="width:14mm" /><col />`
    + subjects.map(() => '<col span="3" />').join('')
    + `<col style="width:14mm" /><col style="width:14mm" /><col style="width:22mm" /></colgroup>`;
  const css = `*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}`
    + `body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:9pt;line-height:1.35}`
    + `.masthead{text-align:center;border-bottom:2px solid #04402f;padding-bottom:10px;margin-bottom:12px;break-after:avoid}`
    + `.masthead .crest{width:44px;height:44px;display:block;margin:0 auto 6px}`
    + `.masthead h1{font-size:16pt;margin:0;color:#04402f}.masthead .addr{font-size:8pt;color:#555;margin:1px 0 0}`
    + `.masthead h2{font-size:11pt;margin:3px 0 0}.masthead .meta{font-size:8pt;color:#555;margin:2px 0 0}`
    + `table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt}`
    + `th,td{border:.7pt solid #555;padding:3px 4px;text-align:center;overflow:hidden;word-wrap:break-word;vertical-align:middle;font-size:10pt}`
    + `th{background:#eef4ee}td.l{text-align:left}td.b{font-weight:bold}td.n{white-space:nowrap}td.empty{color:#666}`
    + `@page{size:14in 8.5in;margin:8mm 7mm}`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${esc(exam.name)} — In-Course Result</title><style>${css}</style></head><body>`
    + header
    + `<table>${colgroup}<thead><tr><th rowspan="2">SL</th><th rowspan="2">Roll</th><th rowspan="2" class="l">Name</th>${headTop}<th rowspan="2">Total</th><th rowspan="2">Atte</th><th rowspan="2">Remarks</th></tr>`
    + (subjects.length ? `<tr>${headSub}</tr>` : '')
    + `</thead><tbody>${body}</tbody></table></body></html>`;
}

/** Print view for one in-course exam result in a new tab. */
export function printIncourseSheet(exam: ResultExamInfo, subjects: string[], rows: InCoursePrintRow[]): void {
  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) return;
  w.document.write(buildIncoursePrintHTML(exam, subjects, rows));
  w.document.close();
  w.focus();
  window.setTimeout(() => { w.print(); }, 350);
}

export interface InCourseRoutinePrintRow {
  day: string;
  date: string;
  time: string;
  subject: string;
  code: string;
}

/** 'YYYY-MM-DD' -> '1 Jul 2026'; passes other values through trimmed. */
function formatRoutineDate(value: string): string {
  const v = (value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** College-pad print sheet for one in-course exam routine. */
export function buildIncourseRoutinePrintHTML(examName: string, meta: string, rows: InCourseRoutinePrintRow[]): string {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const header = `<header class="masthead"><img class="crest" src="${COLLEGE_LOGO_URL}" alt="College crest" />`
    + `<h1>${esc(COLLEGE_NAME)}</h1><p class="addr">${esc(COLLEGE_ADDRESS)}</p><h2>${esc(examName)} — Exam Routine</h2>`
    + `<p class="meta">${esc(meta)} · Published: ${esc(today)}</p></header>`;
  const body = rows.length
    ? rows.map((r, i) => {
      const subj = r.code ? `${r.subject} (${r.code})` : r.subject;
      return `<tr><td class="n">${i + 1}</td><td>${esc(r.day) || '—'}</td><td class="n">${esc(formatRoutineDate(r.date)) || '—'}</td><td>${esc(r.time) || '—'}</td><td class="l b">${esc(subj) || '—'}</td></tr>`;
    }).join('')
    : `<tr><td colspan="5" class="empty">No routine rows</td></tr>`;
  const css = `*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}`
    + `body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:10pt;line-height:1.4}`
    + `.masthead{text-align:center;border-bottom:2px solid #04402f;padding-bottom:10px;margin-bottom:12px;break-after:avoid}`
    + `.masthead .crest{width:44px;height:44px;display:block;margin:0 auto 6px}`
    + `.masthead h1{font-size:16pt;margin:0;color:#04402f}.masthead .addr{font-size:8pt;color:#555;margin:1px 0 0}`
    + `.masthead h2{font-size:11pt;margin:3px 0 0}.masthead .meta{font-size:8pt;color:#555;margin:2px 0 0}`
    + `table{width:100%;border-collapse:collapse;font-size:10pt}`
    + `th,td{border:.7pt solid #555;padding:5px 6px;text-align:center;vertical-align:middle}`
    + `th{background:#eef4ee}td.l{text-align:left}td.b{font-weight:bold}td.n{white-space:nowrap}td.empty{color:#666}`
    + `@page{size:A4 portrait;margin:12mm 10mm}`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${esc(examName)} — Exam Routine</title><style>${css}</style></head><body>`
    + header
    + `<table><colgroup><col style="width:12mm" /><col style="width:32mm" /><col style="width:32mm" /><col style="width:45mm" /><col /></colgroup><thead><tr><th>SL</th><th>Day</th><th>Date</th><th>Time</th><th class="l">Subject</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
}

/** Print view for one in-course exam routine in a new tab. */
export function printIncourseRoutine(examName: string, meta: string, rows: InCourseRoutinePrintRow[]): void {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(buildIncourseRoutinePrintHTML(examName, meta, rows));
  w.document.close();
  w.focus();
  window.setTimeout(() => { w.print(); }, 350);
}

// ---------------------------------------------------------------------------
// Principal's student roster: filtered Roll/Name/Mobile + a blank Remarks
// column, laid out in two side-by-side blocks so a full page holds twice the
// students. PDF is A4 landscape; CSV is the same single-column list.
// ---------------------------------------------------------------------------

export interface StudentListRow {
  roll: string;
  name: string;
  mobile: string;
  /** Result group (Humanities / Science / Business Studies / Other). */
  group: string;
}

export interface StudentListMeta {
  session: string;
  program: string;
  subject: string;
  group: string;
  count: number;
}

export interface StudentListGroup {
  group: string;
  rows: StudentListRow[];
}

const ROSTER_GROUP_ORDER = ['Humanities', 'Science', 'Business Studies'];

/** Split roster rows into group sections (shared subjects land in every group
 *  that takes them). Exported for measurement checks. */
export function groupStudentListRows(rows: StudentListRow[]): StudentListGroup[] {
  const byGroup = new Map<string, StudentListRow[]>();
  for (const r of rows) {
    const g = (r.group || '').trim() || 'Other';
    const list = byGroup.get(g) || [];
    list.push(r);
    byGroup.set(g, list);
  }
  const ordered = [...ROSTER_GROUP_ORDER.filter((g) => byGroup.has(g))];
  for (const g of byGroup.keys()) {
    if (!ROSTER_GROUP_ORDER.includes(g)) ordered.push(g);
  }
  return ordered.map((g) => ({ group: g, rows: byGroup.get(g) || [] }));
}

/** A4-landscape two-column roster PDF with a college-pad masthead. */
export async function downloadStudentListPDF(
  rows: StudentListRow[],
  meta: StudentListMeta,
  filename: string
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableW = pageW - margin * 2;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const [unicodeFont, logo] = await Promise.all([registerUnicodeFont(doc), loadLogoDataUrl()]);
  const hasUnicode = rows.some((r) => [r.roll, r.name, r.mobile].some(needsBrowserShaping));
  if (hasUnicode && !unicodeFont) {
    throw new Error('Unable to load the Bengali PDF font. Check that /fonts is accessible and try again.');
  }
  const font = unicodeFont ? PDF_FONT_FAMILY : 'helvetica';
  const logoSize = 16;

  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, margin, logoSize, logoSize); } catch { /* logo optional */ }
  }
  doc.setFont(font, 'bold'); doc.setFontSize(15); doc.setTextColor(4, 64, 47);
  doc.text(COLLEGE_NAME, margin + logoSize + 4, margin + 5);
  doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(80);
  doc.text(COLLEGE_ADDRESS, margin + logoSize + 4, margin + 9.5);
  doc.setFont(font, 'bold'); doc.setFontSize(11); doc.setTextColor(20);
  doc.text('Student List', margin + logoSize + 4, margin + 14.5);
  doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(60);
  doc.text(
    `Session: ${meta.session}   |   Program: ${meta.program}   |   Subject: ${meta.subject}   |   Group: ${meta.group}   |   Total: ${meta.count}`,
    margin + logoSize + 4, margin + 18.5
  );
  doc.setDrawColor(4, 64, 47); doc.setLineWidth(0.7);
  doc.line(margin, margin + 22, pageW - margin, margin + 22);
  const startY = margin + 26;

  // Newspaper-style pairing per group section: consecutive students sit side
  // by side so one page holds twice as many rows.
  const sections = groupStudentListRows(rows);
  const columnHead: RowInput[] = [[
    { content: 'Roll' }, { content: 'Name' }, { content: 'Mobile' }, { content: 'Remarks' },
    { content: 'Roll' }, { content: 'Name' }, { content: 'Mobile' }, { content: 'Remarks' },
  ]];

  // Roll 10 / Name 68 / Mobile 24 / Remarks 28 per block (×2 = 260 of 277mm).
  // Name is the only long-text column, so it takes what the short ones save.
  const block = [10, 68, 24, 28];
  const columnStyles: Record<string, { cellWidth: number }> = {};
  [...block, ...block].forEach((w, i) => {
    columnStyles[String(i)] = { cellWidth: w };
  });

  const shapedCells = new WeakMap<object, string>();

  sections.forEach((sec, si) => {
    const half = Math.ceil(sec.rows.length / 2);
    const head: RowInput[] = [
      [{
        content: `${sec.group} (${sec.rows.length})`,
        colSpan: 8,
        styles: { halign: 'center', fillColor: [4, 64, 47], textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
      }],
      ...columnHead,
    ];
    const body: RowInput[] = [];
    for (let i = 0; i < half; i += 1) {
      const l = sec.rows[i];
      const r = sec.rows[i + half];
      body.push([l.roll, l.name, l.mobile, '', r?.roll ?? '', r?.name ?? '', r?.mobile ?? '', '']);
    }
    autoTable(doc, {
      startY: si === 0 ? startY : (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
      margin: { left: margin, right: margin, top: margin + 6, bottom: margin + 4 },
      head,
      body,
      theme: 'grid',
      showHead: 'everyPage',
      styles: {
        font,
        fontSize: 10,
        cellPadding: 1.2,
        textColor: 20,
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak',
        lineColor: 120,
        lineWidth: 0.1,
      },
      bodyStyles: { minCellHeight: 6.5 },
      headStyles: {
        font,
        fillColor: [239, 247, 242],
        textColor: 20,
        fontStyle: 'bold',
        fontSize: 10,
      },
      columnStyles,
      didParseCell: ({ cell }: { cell: { text: string[] } }) => {
        const text = cell.text.join(' ');
        if (needsBrowserShaping(text)) {
          shapedCells.set(cell, text);
          cell.text = [''];
        }
      },
      didDrawCell: ({ cell }) => {
        const text = shapedCells.get(cell);
        if (!text) return;
        drawShapedText(
          doc, text, cell.styles.fontSize, cell.styles.fontStyle.includes('bold'),
          cell.styles.textColor, cell.x + cell.padding('left'), cell.y + cell.padding('top'),
          cell.width - cell.padding('horizontal'), cell.height - cell.padding('vertical')
        );
      },
      didDrawPage: () => {
        doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(110);
        doc.text(`Student List  |  ${meta.session} / ${meta.program} / ${meta.subject}  |  Published: ${today}  |  Page ${doc.getNumberOfPages()}`, margin, pageH - 6);
      },
    });
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Pure CSV builder (grouped order): Roll,Name,Mobile,Group,Remarks. Exported for checks. */
export function buildStudentListCSV(rows: StudentListRow[]): string {
  const cell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ['Roll,Name,Mobile,Group,Remarks'];
  for (const sec of groupStudentListRows(rows)) {
    for (const r of sec.rows) {
      lines.push([cell(r.roll), cell(r.name), cell(r.mobile), cell(sec.group), ''].join(','));
    }
  }
  return lines.join('\n');
}

/** Same roster as CSV (grouped; Remarks left blank for handwriting). */
export function downloadStudentListCSV(rows: StudentListRow[], filename: string): void {
  const blob = new Blob(['\uFEFF' + buildStudentListCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

// ---------------------------------------------------------------------------
// Principal's teacher roster: highly filterable (employment / appointment /
// subject) SL + profile columns + blank Remarks. Single wide table, A4 landscape.
// ---------------------------------------------------------------------------

export interface TeacherListRow {
  name: string;
  id: string;
  designation: string;
  subject: string;
  employment: string;
  appointment: string;
  mobile: string;
  /** Seniority order (1 = most senior); '' when unset. */
  priority: string;
}

export interface TeacherListMeta {
  employment: string;
  appointment: string;
  subject: string;
  count: number;
}

/** Full-profile CSV column spec (everything except password and the photo
 *  blob). Order here is the CSV column order. */
export interface TeacherFullRow {
  priority: string;
  id: string;
  teacher_id: string;
  full_name: string;
  fathers_name: string;
  mothers_name: string;
  dob: string;
  mobile_number: string;
  email: string;
  tmis_no: string;
  ttis_no: string;
  current_address: string;
  permanent_address: string;
  nid_number: string;
  blood_group: string;
  gender: string;
  religion: string;
  joining_date: string;
  appointment_date: string;
  designation: string;
  subject: string;
  program: string;
  employment_type: string;
  appointment_type: string;
  pending_lawsuits: string;
  seniority_priority: string;
  mpo_date: string;
  index_number: string;
  salary_grade: string;
  basic_scale: string;
  training_names: string;
  education_ssc: string;
  education_hsc: string;
  education_honours: string;
  education_masters: string;
  edu_ssc_year: string;
  edu_ssc_board: string;
  edu_ssc_result: string;
  edu_hsc_year: string;
  edu_hsc_board: string;
  edu_hsc_result: string;
  edu_honours_year: string;
  edu_honours_board: string;
  edu_honours_result: string;
  edu_masters_year: string;
  edu_masters_board: string;
  edu_masters_result: string;
  is_principal: string;
  can_write_notice: string;
  created_at: string;
  updated_at: string;
}

const TEACHER_CSV_COLUMNS: { header: string; key: keyof TeacherFullRow | null }[] = [
  { header: 'SL', key: null },
  { header: 'Priority', key: 'priority' },
  { header: 'Record ID', key: 'id' },
  { header: 'Teacher ID', key: 'teacher_id' },
  { header: 'Full Name', key: 'full_name' },
  { header: "Father's Name", key: 'fathers_name' },
  { header: "Mother's Name", key: 'mothers_name' },
  { header: 'Date of Birth', key: 'dob' },
  { header: 'Mobile Number', key: 'mobile_number' },
  { header: 'Email', key: 'email' },
  { header: 'TMIS No', key: 'tmis_no' },
  { header: 'TTIS No', key: 'ttis_no' },
  { header: 'Current Address', key: 'current_address' },
  { header: 'Permanent Address', key: 'permanent_address' },
  { header: 'NID Number', key: 'nid_number' },
  { header: 'Blood Group', key: 'blood_group' },
  { header: 'Gender', key: 'gender' },
  { header: 'Religion', key: 'religion' },
  { header: 'Joining Date', key: 'joining_date' },
  { header: 'Appointment Date', key: 'appointment_date' },
  { header: 'Designation', key: 'designation' },
  { header: 'Subject', key: 'subject' },
  { header: 'Program', key: 'program' },
  { header: 'Employment Type', key: 'employment_type' },
  { header: 'Appointment Type', key: 'appointment_type' },
  { header: 'Pending Lawsuits', key: 'pending_lawsuits' },
  { header: 'Seniority Priority', key: 'seniority_priority' },
  { header: 'MPO Date', key: 'mpo_date' },
  { header: 'Index Number', key: 'index_number' },
  { header: 'Salary Grade', key: 'salary_grade' },
  { header: 'Basic Scale', key: 'basic_scale' },
  { header: 'Training Names', key: 'training_names' },
  { header: 'Education SSC', key: 'education_ssc' },
  { header: 'Education HSC', key: 'education_hsc' },
  { header: 'Education Honours', key: 'education_honours' },
  { header: 'Education Masters', key: 'education_masters' },
  { header: 'SSC Year', key: 'edu_ssc_year' },
  { header: 'SSC Board', key: 'edu_ssc_board' },
  { header: 'SSC Result', key: 'edu_ssc_result' },
  { header: 'HSC Year', key: 'edu_hsc_year' },
  { header: 'HSC Board', key: 'edu_hsc_board' },
  { header: 'HSC Result', key: 'edu_hsc_result' },
  { header: 'Honours Year', key: 'edu_honours_year' },
  { header: 'Honours Board', key: 'edu_honours_board' },
  { header: 'Honours Result', key: 'edu_honours_result' },
  { header: 'Masters Year', key: 'edu_masters_year' },
  { header: 'Masters Board', key: 'edu_masters_board' },
  { header: 'Masters Result', key: 'edu_masters_result' },
  { header: 'Is Principal', key: 'is_principal' },
  { header: 'Can Write Notice', key: 'can_write_notice' },
  { header: 'Created At', key: 'created_at' },
  { header: 'Updated At', key: 'updated_at' },
  { header: 'Remarks', key: null },
];

/** Pure full-profile CSV builder. Exported for checks. */
export function buildTeacherListCSV(rows: TeacherFullRow[]): string {
  const cell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [TEACHER_CSV_COLUMNS.map((c) => c.header).join(',')];
  rows.forEach((r, i) => {
    lines.push(
      TEACHER_CSV_COLUMNS.map((c, ci) => {
        if (ci === 0) return String(i + 1); // SL
        if (c.key === null) return ''; // blank Remarks
        return cell(r[c.key] ?? '');
      }).join(',')
    );
  });
  return lines.join('\n');
}

export function downloadTeacherListCSV(rows: TeacherFullRow[], filename: string): void {
  const blob = new Blob(['\uFEFF' + buildTeacherListCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

/** "2023-07-01" -> "1 Jul 2023"; passes through empty/unparseable as-is ('' for empty). */
export function formatShortDate(value: string): string {
  if (!value || !value.trim()) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Stacked profile cell: Name / Designation / Subject / Index / DOB (set fields only). */
export function teacherProfileCell(r: TeacherFullRow): string {
  const lines = [r.full_name || 'Profile not updated'];
  if (r.designation) lines.push(r.designation);
  if (r.subject) lines.push(r.subject);
  if (r.index_number) lines.push(`Index: ${r.index_number}`);
  if (r.dob) lines.push(`DOB: ${formatShortDate(r.dob)}`);
  if (r.blood_group) lines.push(`Blood: ${r.blood_group}`);
  return lines.join('\n');
}

const EDUCATION_LEVELS: { label: string; institute: keyof TeacherFullRow; year: keyof TeacherFullRow; board: keyof TeacherFullRow; result: keyof TeacherFullRow }[] = [
  { label: 'SSC', institute: 'education_ssc', year: 'edu_ssc_year', board: 'edu_ssc_board', result: 'edu_ssc_result' },
  { label: 'HSC', institute: 'education_hsc', year: 'edu_hsc_year', board: 'edu_hsc_board', result: 'edu_hsc_result' },
  { label: 'Honours', institute: 'education_honours', year: 'edu_honours_year', board: 'edu_honours_board', result: 'edu_honours_result' },
  { label: 'Masters', institute: 'education_masters', year: 'edu_masters_year', board: 'edu_masters_board', result: 'edu_masters_result' },
];

/** Stacked education cell: each level as "Label: institute, board (year) — result" (set parts only). */
export function teacherEducationCell(r: TeacherFullRow): string {
  const lines: string[] = [];
  for (const lvl of EDUCATION_LEVELS) {
    const parts = [r[lvl.institute], r[lvl.board], r[lvl.year] ? `(${r[lvl.year]})` : '']
      .map((p) => (p || '').trim())
      .filter(Boolean);
    const head = parts.length ? `${lvl.label}: ${parts.join(', ')}` : '';
    const result = (r[lvl.result] || '').trim();
    if (head && result) lines.push(`${head} — ${result}`);
    else if (head) lines.push(head);
    else if (result) lines.push(`${lvl.label}: ${result}`);
  }
  if ((r.training_names || '').trim()) lines.push(`Training: ${r.training_names.trim()}`);
  return lines.join('\n') || '—';
}

/**
 * Teacher roster PDF: SL | Profile (name/designation/subject/index/DOB) |
 * Education (qualifications + years + results) | Joining | MPO | Lawsuit |
 * Signature & Date (blank) | Remarks (blank). A4 landscape.
 */
export async function downloadTeacherListPDF(
  rows: TeacherFullRow[],
  meta: TeacherListMeta,
  filename: string
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const [unicodeFont, logo] = await Promise.all([registerUnicodeFont(doc), loadLogoDataUrl()]);
  const hasUnicode = rows.some((r) =>
    [r.full_name, r.teacher_id, r.designation, r.subject, r.employment_type, r.appointment_type,
     r.mobile_number, r.education_ssc, r.education_hsc, r.education_honours, r.education_masters,
     r.training_names].some((v) => needsBrowserShaping(v || ''))
  );
  if (hasUnicode && !unicodeFont) {
    throw new Error('Unable to load the Bengali PDF font. Check that /fonts is accessible and try again.');
  }
  const font = unicodeFont ? PDF_FONT_FAMILY : 'helvetica';
  const logoSize = 16;

  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, margin, logoSize, logoSize); } catch { /* logo optional */ }
  }
  doc.setFont(font, 'bold'); doc.setFontSize(15); doc.setTextColor(4, 64, 47);
  doc.text(COLLEGE_NAME, margin + logoSize + 4, margin + 5);
  doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(80);
  doc.text(COLLEGE_ADDRESS, margin + logoSize + 4, margin + 9.5);
  doc.setFont(font, 'bold'); doc.setFontSize(11); doc.setTextColor(20);
  doc.text('Staff Pattern', margin + logoSize + 4, margin + 14.5);
  doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(60);
  doc.text(
    `Employment: ${meta.employment}   |   Appointment: ${meta.appointment}   |   Subject: ${meta.subject}   |   Total: ${meta.count}`,
    margin + logoSize + 4, margin + 18.5
  );
  doc.setDrawColor(4, 64, 47); doc.setLineWidth(0.7);
  doc.line(margin, margin + 22, pageW - margin, margin + 22);
  const startY = margin + 26;

  const head: RowInput[] = [[
    { content: 'SL' }, { content: 'Profile' }, { content: 'Education Qualifications' },
    { content: 'Joining Date' }, { content: 'MPO Date' }, { content: 'Lawsuit' },
    { content: 'Signature & Date' }, { content: 'Remarks' },
  ]];
  const body: RowInput[] = rows.map((r, i) => ([
    String(i + 1),
    teacherProfileCell(r),
    teacherEducationCell(r),
    formatShortDate(r.joining_date) || '—',
    formatShortDate(r.mpo_date) || '—',
    (r.pending_lawsuits || '').trim() || '—',
    '',
    '',
  ]));

  // 8 + 52 + 80 + 22 + 22 + 16 + 28 + 28 = 256 of 277mm.
  // Education takes what the short date/code columns save.
  const widths = [8, 52, 80, 22, 22, 16, 28, 28];
  const columnStyles: Record<string, { cellWidth: number; halign?: 'left' | 'center' }> = {};
  widths.forEach((w, i) => {
    columnStyles[String(i)] = { cellWidth: w };
  });
  // Stacked text columns read left-aligned.
  columnStyles['1'].halign = 'left';
  columnStyles['2'].halign = 'left';

  const shapedCells = new WeakMap<object, string>();
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin, top: margin + 6, bottom: margin + 4 },
    head,
    body,
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      font,
      fontSize: 9,
      cellPadding: 1.2,
      textColor: 20,
      halign: 'center',
      valign: 'middle',
      overflow: 'linebreak',
      lineColor: 120,
      lineWidth: 0.1,
    },
    bodyStyles: { minCellHeight: 12 },
    headStyles: {
      font,
      fillColor: [239, 247, 242],
      textColor: 20,
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles,
    didParseCell: ({ cell }) => {
      const text = cell.text.join(' ');
      if (needsBrowserShaping(text)) {
        shapedCells.set(cell, text);
        cell.text = [''];
      }
    },
    didDrawCell: ({ cell }) => {
      const text = shapedCells.get(cell);
      if (!text) return;
      drawShapedText(
        doc, text, cell.styles.fontSize, cell.styles.fontStyle.includes('bold'),
        cell.styles.textColor, cell.x + cell.padding('left'), cell.y + cell.padding('top'),
        cell.width - cell.padding('horizontal'), cell.height - cell.padding('vertical')
      );
    },
    didDrawPage: () => {
      doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(110);
      doc.text(`Staff Pattern  |  ${meta.employment} / ${meta.appointment} / ${meta.subject}  |  Published: ${today}  |  Page ${doc.getNumberOfPages()}`, margin, pageH - 6);
    },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
