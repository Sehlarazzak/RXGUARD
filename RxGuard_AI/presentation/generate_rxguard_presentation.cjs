/*
 * RxGuard AI hackathon deck generator.
 * Presentation-only tooling: this script does not change application behavior.
 */
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'RxGuard AI';
pptx.company = 'RxGuard AI';
pptx.subject = 'Technical architecture and product evidence';
pptx.title = 'RxGuard AI: AI-Powered Medicine Safety & Intelligent Alternatives';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US'
};
pptx.defineLayout({ name: 'RXGUARD_WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'RXGUARD_WIDE';
pptx.margin = 0;
pptx.layout = 'LAYOUT_WIDE';

const W = 13.333;
const H = 7.5;
const C = {
  navy: '0A2540',
  navy2: '103B63',
  blue: '1677C8',
  sky: '50B8E8',
  ice: 'EAF7FD',
  pale: 'F5FAFE',
  white: 'FFFFFF',
  ink: '16324A',
  muted: '5D7487',
  line: 'C9E4F3',
  green: '16846B',
  amber: 'C78314',
  red: 'C44753',
  lavender: 'EDF0FF'
};
const F = { head: 'Aptos Display', body: 'Aptos' };
const asset = (...parts) => path.resolve(__dirname, '..', ...parts);
const screenshots = {
  landing: asset('docs', 'test-screenshots', '01-landing-page.png'),
  safety: asset('docs', 'test-screenshots', '06-notepad-safety-check.png'),
  notice: asset('docs', 'test-screenshots', '07-novidat-learn-more.png'),
  admin: asset('docs', 'test-screenshots', '10-admin-dashboard.png')
};

function addText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: opts.fontFace || F.body,
    fontSize: opts.fontSize || 12,
    color: opts.color || C.ink,
    bold: Boolean(opts.bold),
    italic: Boolean(opts.italic),
    margin: opts.margin === undefined ? 0 : opts.margin,
    breakLine: false,
    fit: 'shrink',
    valign: opts.valign || 'mid',
    align: opts.align || 'left',
    paraSpaceAfterPt: opts.paraSpaceAfterPt || 0,
    bullet: opts.bullet,
    transparency: opts.transparency,
    isTextBox: true,
    ...opts
  });
}

function shape(slide, type, x, y, w, h, opts = {}) {
  slide.addShape(type, {
    x, y, w, h,
    line: opts.line === false ? { color: opts.fill || C.white, transparency: 100 } : {
      color: opts.lineColor || C.line,
      width: opts.lineWidth || 0.7,
      transparency: opts.lineTransparency || 0
    },
    fill: opts.fill ? { color: opts.fill, transparency: opts.transparency || 0 } : { color: C.white, transparency: 100 },
    radius: opts.radius,
    ...opts
  });
}

function addBackground(slide, number, dark = false) {
  slide.background = { color: dark ? C.navy : C.white };
  shape(slide, pptx.ShapeType.rect, 0, 0, W, 0.08, { fill: dark ? C.sky : C.blue, line: false });
  if (!dark) {
    shape(slide, pptx.ShapeType.arc, 10.8, -1.65, 3.5, 3.5, {
      line: false, fill: C.ice, transparency: 16, adjustPoint: 0.22
    });
    shape(slide, pptx.ShapeType.arc, -1.35, 5.95, 2.75, 2.75, {
      line: false, fill: C.ice, transparency: 22, adjustPoint: 0.26
    });
  }
  addText(slide, 'RXGUARD AI', 0.55, 7.09, 1.7, 0.16, {
    fontSize: 6.8, color: dark ? 'B9DDF2' : C.muted, bold: true, charSpacing: 1.1
  });
  addText(slide, 'MEDICINE SAFETY • VERIFIED DATA • GROUNDED AI', 2.28, 7.09, 4.2, 0.16, {
    fontSize: 6.2, color: dark ? 'B9DDF2' : C.muted, charSpacing: 0.3
  });
  addText(slide, String(number).padStart(2, '0'), 12.25, 7.03, 0.52, 0.24, {
    fontSize: 8.5, color: dark ? C.sky : C.blue, bold: true, align: 'right'
  });
}

function addTitle(slide, number, title, subtitle, opts = {}) {
  addBackground(slide, number, Boolean(opts.dark));
  const color = opts.dark ? C.white : C.navy;
  addText(slide, opts.eyebrow || 'TECHNICAL OVERVIEW', 0.58, 0.34, 3.15, 0.2, {
    fontSize: 7.2, color: opts.dark ? C.sky : C.blue, bold: true, charSpacing: 1.35
  });
  addText(slide, title, 0.56, 0.6, 12.0, 0.42, {
    fontFace: F.head, fontSize: 24, color, bold: true
  });
  if (subtitle) {
    addText(slide, subtitle, 0.58, 1.1, 11.7, 0.3, {
      fontSize: 10.2, color: opts.dark ? 'C5DCEC' : C.muted
    });
  }
}

function card(slide, x, y, w, h, opts = {}) {
  shape(slide, pptx.ShapeType.roundRect, x, y, w, h, {
    fill: opts.fill || C.white,
    lineColor: opts.lineColor || C.line,
    lineWidth: opts.lineWidth || 0.75,
    radius: 0.11,
    shadow: opts.shadow ? { type: 'outer', color: '9BBBCF', opacity: 0.12, blur: 1, angle: 45, distance: 1 } : undefined
  });
  if (opts.accent) {
    shape(slide, pptx.ShapeType.roundRect, x, y, 0.075, h, {
      fill: opts.accent, line: false, radius: 0.11
    });
  }
}

function badge(slide, text, x, y, w, color = C.blue) {
  shape(slide, pptx.ShapeType.roundRect, x, y, w, 0.28, { fill: color, line: false, radius: 0.14 });
  addText(slide, text.toUpperCase(), x + 0.08, y + 0.035, w - 0.16, 0.18, {
    fontSize: 6.7, color: C.white, bold: true, align: 'center', charSpacing: 0.55
  });
}

function bulletList(slide, items, x, y, w, opts = {}) {
  const size = opts.fontSize || 10.5;
  const gap = opts.gap || 0.44;
  items.forEach((item, i) => {
    shape(slide, pptx.ShapeType.ellipse, x, y + i * gap + 0.12, 0.08, 0.08, {
      fill: opts.bulletColor || C.blue, line: false
    });
    addText(slide, item, x + 0.18, y + i * gap, w - 0.18, opts.height || 0.3, {
      fontSize: size, color: opts.color || C.ink, valign: 'top'
    });
  });
}

function iconCircle(slide, label, x, y, color, opts = {}) {
  shape(slide, pptx.ShapeType.ellipse, x, y, opts.size || 0.54, opts.size || 0.54, {
    fill: color, line: false
  });
  addText(slide, label, x, y + (opts.size || 0.54) * 0.19, opts.size || 0.54, 0.2, {
    fontSize: opts.fontSize || 12, color: C.white, bold: true, align: 'center'
  });
}

function arrow(slide, x, y, w, color = C.blue) {
  shape(slide, pptx.ShapeType.chevron, x, y, w, 0.34, { fill: color, line: false });
}

function labelValue(slide, label, value, x, y, w, color = C.blue) {
  addText(slide, value, x, y, w, 0.38, { fontFace: F.head, fontSize: 20, color, bold: true, align: 'center' });
  addText(slide, label, x, y + 0.4, w, 0.24, { fontSize: 7.5, color: C.muted, bold: true, align: 'center', charSpacing: 0.3 });
}

function screenshot(slide, file, x, y, w, h, caption) {
  card(slide, x, y, w, h, { fill: C.white, shadow: true });
  if (fs.existsSync(file)) {
    slide.addImage({ path: file, x: x + 0.07, y: y + 0.07, w: w - 0.14, h: h - 0.38 });
  } else {
    shape(slide, pptx.ShapeType.rect, x + 0.07, y + 0.07, w - 0.14, h - 0.38, { fill: C.ice, line: false });
    addText(slide, 'Product screenshot unavailable', x + 0.2, y + h / 2 - 0.12, w - 0.4, 0.24, {
      fontSize: 9, color: C.muted, align: 'center'
    });
  }
  addText(slide, caption, x + 0.12, y + h - 0.25, w - 0.24, 0.14, {
    fontSize: 6.6, color: C.muted, align: 'center'
  });
}

// 1. Title
{
  const s = pptx.addSlide();
  addBackground(s, 1, true);
  shape(s, pptx.ShapeType.arc, 8.7, -1.0, 5.5, 5.5, { fill: C.blue, transparency: 15, line: false, adjustPoint: 0.28 });
  shape(s, pptx.ShapeType.arc, 9.6, -0.2, 3.65, 3.65, { fill: C.sky, transparency: 9, line: false, adjustPoint: 0.23 });
  badge(s, 'Hackathon Technical Presentation', 0.62, 0.72, 2.45, C.blue);
  addText(s, 'RxGuard AI', 0.58, 1.45, 7.8, 0.68, { fontFace: F.head, fontSize: 40, color: C.white, bold: true });
  addText(s, 'AI-Powered Medicine Safety\nand Intelligent Alternatives', 0.62, 2.16, 7.2, 0.87, {
    fontFace: F.head, fontSize: 23.5, color: 'D9EEF9', bold: true, valign: 'top'
  });
  addText(s, 'A grounded decision-support platform that keeps verified regulatory data—not generative output—as the source of truth.', 0.63, 3.22, 6.4, 0.55, {
    fontSize: 12, color: 'B9DDF2', valign: 'top'
  });
  const pillars = [
    ['Verified Registry', 'Safety status, provenance, recalls'],
    ['Hybrid Search', 'Keywords + local embeddings + use'],
    ['Grounded AI', 'Constrained Gemini ranking with validation']
  ];
  pillars.forEach((p, i) => {
    const x = 0.64 + i * 2.27;
    card(s, x, 4.42, 2.05, 1.15, { fill: '143E63', lineColor: '2D6793', accent: i === 2 ? C.sky : C.blue });
    addText(s, p[0], x + 0.18, 4.64, 1.7, 0.18, { fontSize: 9.3, color: C.white, bold: true, align: 'center' });
    addText(s, p[1], x + 0.15, 4.91, 1.76, 0.34, { fontSize: 7.2, color: 'B9DDF2', align: 'center', valign: 'top' });
  });
  shape(s, pptx.ShapeType.roundRect, 8.42, 4.2, 3.91, 1.42, { fill: C.white, transparency: 3, line: false, radius: 0.16 });
  addText(s, 'SAFETY DECISION FLOW', 8.8, 4.49, 3.15, 0.18, { fontSize: 7.1, color: C.blue, bold: true, align: 'center', charSpacing: 1 });
  addText(s, 'Verify → Analyze → Recommend\nValidate → Inform', 8.65, 4.78, 3.45, 0.55, { fontFace: F.head, fontSize: 16.2, color: C.navy, bold: true, align: 'center' });
  addText(s, 'Current implementation audit', 0.63, 6.33, 3.0, 0.22, { fontSize: 8, color: C.sky, bold: true, charSpacing: 0.45 });
}

// 2. Problem
{
  const s = pptx.addSlide();
  addTitle(s, 2, 'Medication safety is a data-and-workflow problem', 'People need a clear, traceable answer before they act on a medicine or prescription.');
  const problems = [
    ['?', 'Uncertain medicines', 'A brand name alone does not reveal current regulatory or safety status.', C.red],
    ['!', 'Unsafe workflow gaps', 'Patients, clinicians, and administrators work from disconnected information.', C.amber],
    ['≈', 'Opaque recommendations', 'Generic AI advice cannot be trusted without verified candidate controls.', C.blue]
  ];
  problems.forEach((p, i) => {
    const x = 0.66 + i * 4.18;
    card(s, x, 1.8, 3.68, 2.18, { accent: p[3], shadow: true });
    iconCircle(s, p[0], x + 0.27, 2.12, p[3], { size: 0.6, fontSize: 16 });
    addText(s, p[1], x + 1.02, 2.08, 2.28, 0.27, { fontSize: 14, color: C.navy, bold: true });
    addText(s, p[2], x + 0.28, 2.78, 3.1, 0.62, { fontSize: 10.1, color: C.muted, valign: 'top' });
  });
  addText(s, 'Designed for the people who need an accountable safety decision:', 0.67, 4.46, 6.1, 0.24, { fontSize: 12.5, color: C.navy, bold: true });
  const users = [['PATIENT', 'Checks a medicine and stores prescription images.'], ['DOCTOR', 'Creates patient files and checks typed prescriptions.'], ['ADMIN', 'Maintains the registry, approvals, and audit trail.']];
  users.forEach((u, i) => {
    const x = 0.68 + i * 4.15;
    card(s, x, 4.94, 3.67, 1.18, { fill: i === 0 ? C.ice : C.pale, lineColor: C.line });
    badge(s, u[0], x + 0.22, 5.18, 0.95, i === 0 ? C.green : C.blue);
    addText(s, u[1], x + 1.34, 5.12, 2.04, 0.5, { fontSize: 8.7, color: C.ink, valign: 'top' });
  });
}

// 3. Solution
{
  const s = pptx.addSlide();
  addTitle(s, 3, 'One safety layer across discovery, analysis, and follow-up', 'RxGuard combines registry evidence, deterministic checks, and a bounded AI reasoning step.');
  const blocks = [
    ['01', 'Verified registry', 'Products, ingredients, notices, recall batches, provenance, and status history.', C.blue],
    ['02', 'Hybrid discovery', 'Keyword matching + local semantic vectors + verified therapeutic-use overlap.', C.sky],
    ['03', 'Safety analysis', 'Typed prescription lines are matched to products and classified by current status.', C.green],
    ['04', 'Grounded alternatives', 'Gemini ranks only already-safe candidates; the database revalidates every output.', C.navy2]
  ];
  blocks.forEach((b, i) => {
    const x = 0.62 + i * 3.13;
    card(s, x, 1.88, 2.78, 3.15, { fill: C.white, accent: b[3], shadow: true });
    addText(s, b[0], x + 0.22, 2.15, 0.42, 0.26, { fontFace: F.head, fontSize: 13.5, color: b[3], bold: true });
    addText(s, b[1], x + 0.22, 2.65, 2.22, 0.4, { fontFace: F.head, fontSize: 15, color: C.navy, bold: true, valign: 'top' });
    addText(s, b[2], x + 0.22, 3.42, 2.24, 0.86, { fontSize: 9.4, color: C.muted, valign: 'top' });
  });
  card(s, 1.37, 5.64, 10.58, 0.72, { fill: C.ice, lineColor: C.line });
  addText(s, 'Core design principle', 1.72, 5.83, 1.55, 0.17, { fontSize: 8, color: C.blue, bold: true, charSpacing: 0.6 });
  addText(s, 'Generative AI may explain a choice, but it never creates the trusted candidate set or the final medicine record.', 3.33, 5.76, 8.05, 0.3, { fontSize: 11.1, color: C.navy, bold: true });
}

// 4. Product journey
{
  const s = pptx.addSlide();
  addTitle(s, 4, 'A guided journey from input to accountable next step', 'The product supports search and typed prescription review while preserving an evidence trail.');
  const stages = [
    ['1', 'ENTER', 'Search a medicine\nor type prescription text', C.blue],
    ['2', 'ANALYZE', 'Resolve product identity\nand current safety status', C.sky],
    ['3', 'EXPLAIN', 'Show verified safety\ndetails and provenance', C.green],
    ['4', 'ACT', 'Offer validated safe\nalternatives or block print', C.navy2]
  ];
  stages.forEach((st, i) => {
    const x = 0.56 + i * 3.17;
    card(s, x, 2.05, 2.64, 2.06, { fill: C.white, accent: st[3], shadow: true });
    iconCircle(s, st[0], x + 0.23, 2.35, st[3], { size: 0.47, fontSize: 11.5 });
    addText(s, st[1], x + 0.82, 2.37, 1.5, 0.18, { fontSize: 8.3, color: st[3], bold: true, charSpacing: 0.8 });
    addText(s, st[2], x + 0.24, 3.0, 2.1, 0.58, { fontSize: 10.3, color: C.navy, bold: true, align: 'center', valign: 'top' });
    if (i < stages.length - 1) arrow(s, x + 2.73, 2.94, 0.36, C.line);
  });
  card(s, 0.78, 4.72, 11.72, 0.83, { fill: C.lavender, lineColor: 'D8DFFC' });
  iconCircle(s, 'i', 1.1, 4.89, C.blue, { size: 0.35, fontSize: 10 });
  addText(s, 'Prescription photos are supported as uploaded records. Safety analysis uses typed text; OCR/text extraction is not implemented.', 1.62, 4.91, 10.25, 0.25, { fontSize: 10.7, color: C.navy, bold: true });
  addText(s, 'Result: an explainable workflow that separates product identity, safety evidence, candidate retrieval, and AI-assisted ranking.', 0.79, 6.02, 11.4, 0.24, { fontSize: 10.2, color: C.muted, align: 'center' });
}

// 5. System architecture
{
  const s = pptx.addSlide();
  addTitle(s, 5, 'System architecture: web client, REST API, registry, and bounded AI', 'The Express API coordinates application workflows while local embeddings and Gemini serve distinct roles.');
  const nodes = [
    { x: 0.58, y: 2.08, w: 2.25, title: 'EXPO WEB CLIENT', body: 'Expo Router\nReact Context auth\nFetch API client', color: C.blue },
    { x: 3.56, y: 2.08, w: 2.45, title: 'EXPRESS REST API', body: 'Auth • medicines\nprescriptions • history\nadmin • uploads', color: C.navy2 },
    { x: 6.75, y: 2.08, w: 2.38, title: 'POSTGRESQL', body: 'mediverify registry\nrxguard workflows\nJSONB embeddings', color: C.green }
  ];
  nodes.forEach((n) => {
    card(s, n.x, n.y, n.w, 1.92, { fill: C.white, accent: n.color, shadow: true });
    addText(s, n.title, n.x + 0.22, n.y + 0.27, n.w - 0.4, 0.2, { fontSize: 8.1, color: n.color, bold: true, align: 'center', charSpacing: 0.55 });
    addText(s, n.body, n.x + 0.2, n.y + 0.73, n.w - 0.4, 0.7, { fontSize: 11.2, color: C.navy, bold: true, align: 'center', valign: 'mid' });
  });
  arrow(s, 2.91, 2.9, 0.46, C.blue);
  arrow(s, 6.12, 2.9, 0.46, C.blue);
  card(s, 9.92, 1.62, 2.72, 1.48, { fill: C.ice, accent: C.sky, shadow: true });
  addText(s, 'LOCAL ML', 10.18, 1.89, 2.2, 0.2, { fontSize: 8.1, color: C.blue, bold: true, align: 'center', charSpacing: 0.55 });
  addText(s, 'Xenova\nall-MiniLM-L6-v2', 10.15, 2.2, 2.25, 0.52, { fontSize: 12.2, color: C.navy, bold: true, align: 'center' });
  card(s, 9.92, 3.53, 2.72, 1.48, { fill: C.lavender, accent: C.navy2, shadow: true });
  addText(s, 'GENAI SERVICE', 10.18, 3.8, 2.2, 0.2, { fontSize: 8.1, color: C.navy2, bold: true, align: 'center', charSpacing: 0.55 });
  addText(s, 'Gemini\nconstrained ranking', 10.15, 4.1, 2.25, 0.52, { fontSize: 12.2, color: C.navy, bold: true, align: 'center' });
  shape(s, pptx.ShapeType.line, 9.15, 2.84, 9.83, 2.35, { line: { color: C.sky, width: 1.25, beginArrowType: 'none', endArrowType: 'triangle' } });
  shape(s, pptx.ShapeType.line, 9.15, 3.25, 9.83, 4.16, { line: { color: C.navy2, width: 1.25, beginArrowType: 'none', endArrowType: 'triangle' } });
  card(s, 0.73, 5.47, 11.6, 0.56, { fill: C.pale, lineColor: C.line });
  addText(s, 'Boundaries', 1.04, 5.66, 0.85, 0.14, { fontSize: 7.3, color: C.blue, bold: true, charSpacing: 0.6 });
  addText(s, 'Embeddings are local inference; Gemini never searches the database and receives only verified, pre-filtered candidate data.', 2.04, 5.58, 9.72, 0.25, { fontSize: 9.8, color: C.ink, bold: true });
}

// 6. Frontend
{
  const s = pptx.addSlide();
  addTitle(s, 6, 'Frontend architecture: route-aware, role-aware, resilient UI', 'Expo Router and shared client-side primitives provide a responsive web workflow.');
  const columns = [
    ['Routing & shells', ['Expo Router file-based pages', 'Authenticated (app) route group', 'Role-protected dashboards'], C.blue],
    ['Session & API', ['React Context authentication state', 'Bearer-token Fetch API client', 'FormData support for image uploads'], C.sky],
    ['Experience states', ['Loading and API error handling', 'Prescription and medicine detail views', 'Patient, doctor, and admin workflows'], C.green]
  ];
  columns.forEach((c, i) => {
    const x = 0.62 + i * 4.18;
    card(s, x, 1.83, 3.72, 3.73, { fill: C.white, accent: c[2], shadow: true });
    addText(s, c[0], x + 0.28, 2.14, 3.1, 0.28, { fontFace: F.head, fontSize: 15, color: C.navy, bold: true, align: 'center' });
    bulletList(s, c[1], x + 0.4, 2.83, 2.9, { fontSize: 10.1, gap: 0.63, bulletColor: c[2], height: 0.45 });
  });
  badge(s, 'Same-origin web build supported', 4.64, 6.02, 4.08, C.navy2);
  addText(s, 'When Express serves the static frontend on port 3001, the API client uses /api; otherwise it reads EXPO_PUBLIC_API_URL.', 1.25, 6.43, 10.85, 0.22, { fontSize: 9.4, color: C.muted, align: 'center' });
}

// 7. Backend
{
  const s = pptx.addSlide();
  addTitle(s, 7, 'Backend architecture: Express modules enforce the safety workflow', 'The server hosts REST endpoints, database integration, uploads, local ML startup, and the built web client.');
  const layers = [
    ['HTTP / middleware', 'dotenv • CORS • JSON body parsing • static web serving • Multer uploads', C.blue],
    ['Route modules', 'auth • medicines • prescriptions • history • admin', C.sky],
    ['Domain utilities', 'analysis • grounded alternatives • embeddings • medical-use vocabulary', C.green],
    ['Database access', 'Parameterized pg queries • PostgreSQL initialization • idempotent embedding columns', C.navy2]
  ];
  layers.forEach((l, i) => {
    const y = 1.67 + i * 1.05;
    card(s, 1.12, y, 11.12, 0.77, { fill: i % 2 ? C.pale : C.white, accent: l[2] });
    addText(s, l[0], 1.52, y + 0.24, 2.25, 0.2, { fontSize: 11.7, color: C.navy, bold: true });
    addText(s, l[1], 3.9, y + 0.2, 7.75, 0.28, { fontSize: 10.1, color: C.muted });
  });
  card(s, 2.02, 6.16, 9.3, 0.47, { fill: C.ice, lineColor: C.line });
  addText(s, 'Startup behavior: initialize schema → attempt local embedding generation in the background → continue in keyword-only mode if embeddings are not ready.', 2.27, 6.28, 8.83, 0.16, { fontSize: 8.3, color: C.navy, bold: true, align: 'center' });
}

// 8. Database
{
  const s = pptx.addSlide();
  addTitle(s, 8, 'Database architecture: two schemas separate regulatory truth from workflows', 'PostgreSQL holds both the verified product registry and user-facing application records.');
  card(s, 0.72, 1.73, 5.84, 3.95, { fill: C.ice, accent: C.blue, shadow: true });
  badge(s, 'mediverify', 1.0, 2.03, 1.36, C.blue);
  addText(s, 'Regulatory registry & provenance', 1.01, 2.49, 4.8, 0.25, { fontFace: F.head, fontSize: 16, color: C.navy, bold: true });
  bulletList(s, ['products: status, source text, JSONB embedding, model', 'ingredients and product_ingredients composition links', 'notices, recall_batches, sources, status history', 'users, roles, admin_events, approval state'], 1.02, 3.06, 4.92, { fontSize: 9.6, gap: 0.48, bulletColor: C.blue, height: 0.38 });
  card(s, 6.78, 1.73, 5.84, 3.95, { fill: C.pale, accent: C.green, shadow: true });
  badge(s, 'rxguard', 7.06, 2.03, 1.15, C.green);
  addText(s, 'Application workflow records', 7.07, 2.49, 4.8, 0.25, { fontFace: F.head, fontSize: 16, color: C.navy, bold: true });
  bulletList(s, ['prescriptions: typed details and uploaded-image metadata', 'patient_files and doctor_prescriptions notepad', 'search_history for every user role', 'backups and retailer records'], 7.08, 3.06, 4.92, { fontSize: 9.6, gap: 0.48, bulletColor: C.green, height: 0.38 });
  arrow(s, 6.35, 3.42, 0.25, C.line);
  card(s, 1.42, 6.06, 10.48, 0.52, { fill: C.lavender, lineColor: 'D8DFFC' });
  addText(s, 'Implementation fact: vectors are stored as JSONB and scored in Node.js; this project does not use pgvector or a database vector index.', 1.74, 6.21, 9.84, 0.17, { fontSize: 9.3, color: C.navy, bold: true, align: 'center' });
}

// 9. Hybrid search
{
  const s = pptx.addSlide();
  addTitle(s, 9, 'Hybrid semantic search balances name matching, meaning, and medical use', 'The ranking deliberately requires more than a fuzzy word match to protect relevance.');
  const flow = [
    ['QUERY', 'Brand, generic,\nor therapeutic phrase', C.blue],
    ['KEYWORD', 'Strict name\nmatching', C.sky],
    ['EMBEDDING', '384-D local\nsemantic vector', C.green],
    ['USE MATCH', 'Verified medical-use\noverlap', C.navy2],
    ['RANK', 'Return relevant\nproducts', C.blue]
  ];
  flow.forEach((f, i) => {
    const x = 0.39 + i * 2.6;
    card(s, x, 1.96, 2.1, 1.32, { fill: C.white, accent: f[2], shadow: true });
    addText(s, f[0], x + 0.16, 2.18, 1.76, 0.16, { fontSize: 7.6, color: f[2], bold: true, align: 'center', charSpacing: 0.55 });
    addText(s, f[1], x + 0.18, 2.53, 1.74, 0.43, { fontSize: 10.2, color: C.navy, bold: true, align: 'center', valign: 'mid' });
    if (i < flow.length - 1) arrow(s, x + 2.2, 2.47, 0.22, C.line);
  });
  addText(s, 'Final ranking composition', 0.72, 4.08, 2.55, 0.26, { fontFace: F.head, fontSize: 15, color: C.navy, bold: true });
  const weights = [['30%', 'semantic similarity', C.sky], ['45%', 'verified use overlap', C.green], ['25%', 'keyword signal', C.blue]];
  weights.forEach((w, i) => {
    const x = 0.73 + i * 3.78;
    card(s, x, 4.54, 3.32, 1.05, { fill: C.white, accent: w[2] });
    addText(s, w[0], x + 0.2, 4.78, 0.83, 0.32, { fontFace: F.head, fontSize: 19, color: w[2], bold: true, align: 'center' });
    addText(s, w[1], x + 1.13, 4.86, 1.8, 0.18, { fontSize: 9.7, color: C.navy, bold: true, valign: 'top' });
  });
  addText(s, 'Inclusion threshold: 0.30 (except strict keyword hits). Semantic candidates default to a 0.15 similarity threshold.', 0.78, 6.18, 11.55, 0.21, { fontSize: 9.7, color: C.muted, align: 'center' });
}

// 10. Prescription safety
{
  const s = pptx.addSlide();
  addTitle(s, 10, 'Prescription safety analysis is typed-text matching—not OCR', 'Each entered line is normalized, matched against the registry, and assessed against its current safety status.');
  const steps = [
    ['TYPE', 'Enter prescription\ntext line by line', C.blue],
    ['NORMALIZE', 'Remove numbering,\nRx and dosage prefixes', C.sky],
    ['MATCH', 'Exact / prefix / token /\nbigram comparison', C.green],
    ['ASSESS', 'Active = safe; every\nrecognized item must be safe', C.navy2]
  ];
  steps.forEach((st, i) => {
    const x = 0.63 + i * 3.15;
    iconCircle(s, String(i + 1), x + 0.91, 1.82, st[2], { size: 0.48, fontSize: 12 });
    card(s, x, 2.52, 2.55, 1.46, { fill: C.white, accent: st[2], shadow: true });
    addText(s, st[0], x + 0.2, 2.76, 2.12, 0.18, { fontSize: 8.2, color: st[2], bold: true, align: 'center', charSpacing: 0.7 });
    addText(s, st[1], x + 0.22, 3.16, 2.08, 0.43, { fontSize: 10, color: C.navy, bold: true, align: 'center', valign: 'mid' });
    if (i < steps.length - 1) arrow(s, x + 2.62, 3.02, 0.31, C.line);
  });
  card(s, 0.96, 4.66, 5.48, 1.08, { fill: C.ice, accent: C.green });
  addText(s, 'Safe-to-print condition', 1.27, 4.92, 2.1, 0.2, { fontSize: 10.2, color: C.green, bold: true });
  addText(s, 'all_safe = results.length > 0 AND every matched item is active', 1.27, 5.25, 4.75, 0.18, { fontSize: 9.1, color: C.navy, bold: true });
  card(s, 6.87, 4.66, 5.48, 1.08, { fill: C.lavender, accent: C.blue });
  addText(s, 'Known boundary', 7.18, 4.92, 1.62, 0.2, { fontSize: 10.2, color: C.blue, bold: true });
  addText(s, 'Photos can be uploaded, stored, and viewed; no OCR endpoint or text extraction pipeline is implemented.', 7.18, 5.2, 4.67, 0.35, { fontSize: 8.9, color: C.navy, bold: true, valign: 'top' });
  addText(s, 'Recognition threshold: 0.42. Unknown or unmatched lines are marked unsafe rather than silently passed.', 1.03, 6.29, 11.16, 0.18, { fontSize: 9.6, color: C.muted, align: 'center' });
}

// 11. Gemini recommendations
{
  const s = pptx.addSlide();
  addTitle(s, 11, 'Gemini recommends only inside a pre-verified safe candidate set', 'AI contributes constrained selection and short reasoning; candidate discovery remains deterministic and database-grounded.');
  const blocks = [
    ['1', 'Retrieve', 'Load safe products and score candidates against the unsafe product.', C.blue],
    ['2', 'Filter', 'Keep active products only; require minimum 0.08 composite score; take at most 8.', C.green],
    ['3', 'Rank with Gemini', 'Prompt with candidate IDs and structured JSON contract only.', C.navy2],
    ['4', 'Validate', 'Check ID membership, database existence, and active status again.', C.sky]
  ];
  blocks.forEach((b, i) => {
    const x = 0.58 + i * 3.16;
    card(s, x, 1.87, 2.7, 2.52, { fill: C.white, accent: b[3], shadow: true });
    iconCircle(s, b[0], x + 0.24, 2.14, b[3], { size: 0.42, fontSize: 10.5 });
    addText(s, b[1], x + 0.83, 2.18, 1.52, 0.2, { fontSize: 11.7, color: C.navy, bold: true });
    addText(s, b[2], x + 0.25, 2.91, 2.16, 0.7, { fontSize: 9.1, color: C.muted, align: 'center', valign: 'top' });
    if (i < blocks.length - 1) arrow(s, x + 2.78, 2.94, 0.25, C.line);
  });
  card(s, 1.22, 5.03, 10.87, 0.88, { fill: C.ice, lineColor: C.line });
  addText(s, 'Candidate score = 50% ingredient Jaccard + 25% semantic similarity + 25% therapeutic-use overlap', 1.48, 5.28, 10.3, 0.23, { fontSize: 11, color: C.navy, bold: true, align: 'center' });
  addText(s, 'Model compatibility chain: gemini-2.5-flash → gemini-3.6-flash → gemini-3-flash-preview', 1.3, 6.27, 10.72, 0.18, { fontSize: 9.2, color: C.muted, align: 'center' });
}

// 12. Hallucination prevention
{
  const s = pptx.addSlide();
  addTitle(s, 12, 'Hallucination prevention is enforced in code, not delegated to a prompt', 'The final UI record is fetched from PostgreSQL after multiple hard validation gates.');
  const gates = [
    ['Verified retrieval', 'Candidate originates from the database retrieval step.', C.blue],
    ['Active-only filter', 'Unsafe or inactive products never reach the AI candidate list.', C.green],
    ['ID membership', 'Returned recommended_medicine_id must be inside the supplied candidate set.', C.navy2],
    ['Fresh database check', 'Backend confirms row existence and current active safety status.', C.sky],
    ['DB display source', 'Final medicine detail is loaded from PostgreSQL—not AI prose.', C.blue]
  ];
  gates.forEach((g, i) => {
    const y = 1.64 + i * 0.91;
    shape(s, pptx.ShapeType.ellipse, 1.0, y + 0.11, 0.4, 0.4, { fill: g[2], line: false });
    addText(s, '✓', 1.0, y + 0.19, 0.4, 0.15, { fontSize: 11, color: C.white, bold: true, align: 'center' });
    card(s, 1.62, y, 10.35, 0.62, { fill: i % 2 ? C.pale : C.white, accent: g[2] });
    addText(s, g[0], 1.95, y + 0.19, 2.2, 0.17, { fontSize: 10.1, color: C.navy, bold: true });
    addText(s, g[1], 4.2, y + 0.18, 7.15, 0.18, { fontSize: 9.3, color: C.muted });
  });
  badge(s, 'Database remains the source of truth', 3.99, 6.39, 5.28, C.navy2);
}

// 13. Fallback
{
  const s = pptx.addSlide();
  addTitle(s, 13, 'AI availability does not determine whether a safety workflow completes', 'The application makes failure explicit and falls back to a deterministic algorithmic ranking.');
  const failures = ['No GEMINI_API_KEY', 'Model/network failure', 'Malformed response', 'Candidate or DB validation failure'];
  failures.forEach((f, i) => {
    const x = 0.66 + i * 3.08;
    card(s, x, 1.78, 2.55, 0.73, { fill: 'FFF7EA', accent: C.amber });
    addText(s, f, x + 0.2, 2.03, 2.15, 0.16, { fontSize: 8.5, color: C.navy, bold: true, align: 'center' });
    if (i < failures.length - 1) arrow(s, x + 2.64, 1.99, 0.21, C.line);
  });
  card(s, 2.0, 3.1, 9.34, 1.32, { fill: C.ice, accent: C.green, shadow: true });
  addText(s, 'DETERMINISTIC FALLBACK', 2.36, 3.39, 2.45, 0.18, { fontSize: 8.1, color: C.green, bold: true, charSpacing: 0.75 });
  addText(s, 'Return safe candidates with ai_powered: false', 2.36, 3.76, 7.96, 0.27, { fontFace: F.head, fontSize: 17, color: C.navy, bold: true, align: 'center' });
  const weights = [['70%', 'ingredient overlap'], ['20%', 'name similarity'], ['10%', 'dosage-form match']];
  weights.forEach((w, i) => {
    const x = 1.78 + i * 3.35;
    card(s, x, 5.14, 2.98, 0.86, { fill: C.white, lineColor: C.line });
    addText(s, w[0], x + 0.17, 5.36, 0.68, 0.25, { fontFace: F.head, fontSize: 16, color: C.blue, bold: true, align: 'center' });
    addText(s, w[1], x + 0.95, 5.42, 1.73, 0.15, { fontSize: 8.8, color: C.navy, bold: true, align: 'center' });
  });
  addText(s, 'The response distinguishes AI-powered output from algorithmic output, so the user interface never hides degraded capability.', 1.3, 6.4, 10.72, 0.18, { fontSize: 9.2, color: C.muted, align: 'center' });
}

// 14. Workflows
{
  const s = pptx.addSlide();
  addTitle(s, 14, 'Role-specific workflows share the same safety foundation', 'Different roles see tailored actions while the security and registry rules remain central.');
  const roles = [
    ['PATIENT', 'Search verified medicines\nUpload and view prescription images\nAccess prescription history', C.green],
    ['DOCTOR', 'Create patient folders\nWrite in the notepad\nCheck typed prescription safety', C.blue],
    ['ADMIN', 'Approve doctor accounts\nMaintain medicine registry\nAudit safety and admin events', C.navy2]
  ];
  roles.forEach((r, i) => {
    const x = 0.74 + i * 4.14;
    card(s, x, 1.85, 3.6, 3.18, { fill: C.white, accent: r[2], shadow: true });
    badge(s, r[0], x + 1.0, 2.23, 1.58, r[2]);
    bulletList(s, r[1].split('\n'), x + 0.44, 3.05, 2.7, { fontSize: 10.1, gap: 0.56, bulletColor: r[2], height: 0.38 });
  });
  card(s, 1.45, 5.9, 10.42, 0.48, { fill: C.pale, lineColor: C.line });
  addText(s, 'Access control ties every workflow to authenticated identity, role checks, approval status, and ownership verification.', 1.67, 6.04, 10.0, 0.16, { fontSize: 9.1, color: C.navy, bold: true, align: 'center' });
}

// 15. Security
{
  const s = pptx.addSlide();
  addTitle(s, 15, 'Security and validation controls are practical, with explicit hackathon limits', 'The implementation protects key application boundaries while keeping limitations visible for reviewers.');
  const left = ['JWT authentication with 30-day expiry', 'bcrypt password hashing (10 rounds)', 'Role guard and doctor-approval middleware', 'CNIC, email, and password validation', 'Parameterized PostgreSQL queries'];
  const right = ['Patient ownership checks for prescription images', 'Image-only MIME filter and 10 MB upload limit', 'Backend-only Gemini API key via .env', 'No dedicated API rate limiter yet', 'Open CORS and a development JWT fallback require hardening'];
  card(s, 0.7, 1.77, 5.86, 3.96, { fill: C.ice, accent: C.green, shadow: true });
  addText(s, 'IMPLEMENTED CONTROLS', 1.0, 2.05, 4.9, 0.18, { fontSize: 8.4, color: C.green, bold: true, align: 'center', charSpacing: 0.8 });
  bulletList(s, left, 1.04, 2.64, 4.83, { fontSize: 9.7, gap: 0.51, bulletColor: C.green, height: 0.34 });
  card(s, 6.77, 1.77, 5.86, 3.96, { fill: 'FFF9F0', accent: C.amber, shadow: true });
  addText(s, 'LIMITS TO HARDEN NEXT', 7.08, 2.05, 4.9, 0.18, { fontSize: 8.4, color: C.amber, bold: true, align: 'center', charSpacing: 0.8 });
  bulletList(s, right, 7.12, 2.64, 4.83, { fontSize: 9.7, gap: 0.51, bulletColor: C.amber, height: 0.34 });
  addText(s, 'Safety limitation: the current code does not implement drug–drug interactions, dose-range checks, allergy/contraindication models, or clinical diagnosis.', 0.95, 6.18, 11.46, 0.25, { fontSize: 9.3, color: C.red, bold: true, align: 'center' });
}

// 16. Portability
{
  const s = pptx.addSlide();
  addTitle(s, 16, 'Reliability and portability: a runnable local stack with graceful degradation', 'The project is designed for repeatable setup while distinguishing optional AI enhancement from core behavior.');
  const steps = [
    ['1', 'Configure', '.env for PostgreSQL, JWT_SECRET, and optional GEMINI_API_KEY', C.blue],
    ['2', 'Initialize', 'Run idempotent PostgreSQL schema and seed data', C.green],
    ['3', 'Start', 'Express initializes API and can serve frontend/dist', C.navy2],
    ['4', 'Warm up', 'Local model downloads on first use; semantic search becomes available', C.sky]
  ];
  steps.forEach((st, i) => {
    const x = 0.62 + i * 3.15;
    card(s, x, 1.84, 2.69, 2.2, { fill: C.white, accent: st[3], shadow: true });
    iconCircle(s, st[0], x + 0.26, 2.12, st[3], { size: 0.4, fontSize: 10 });
    addText(s, st[1], x + 0.77, 2.18, 1.55, 0.18, { fontSize: 11.5, color: C.navy, bold: true });
    addText(s, st[2], x + 0.26, 2.83, 2.1, 0.63, { fontSize: 8.9, color: C.muted, align: 'center', valign: 'top' });
  });
  card(s, 0.94, 4.9, 11.39, 0.74, { fill: C.ice, lineColor: C.line });
  addText(s, 'Graceful-degradation behavior', 1.28, 5.14, 2.0, 0.18, { fontSize: 9.4, color: C.blue, bold: true });
  addText(s, 'If embeddings fail to initialize, smart search continues in keyword-only mode. If Gemini is unavailable, alternatives use deterministic ranking.', 3.42, 5.08, 8.35, 0.25, { fontSize: 10.1, color: C.navy, bold: true });
  addText(s, 'Judge setup note: use a personal Gemini key in backend/.env for AI reasoning, or omit it to demonstrate the documented fallback. Never commit the key.', 1.0, 6.23, 11.35, 0.2, { fontSize: 9.2, color: C.muted, align: 'center' });
}

// 17. Evidence
{
  const s = pptx.addSlide();
  addTitle(s, 17, 'Evidence from the working product', 'Curated existing screenshots show the implemented user experience; captions avoid claims beyond the current code.');
  screenshot(s, screenshots.landing, 0.62, 1.61, 2.93, 4.73, 'Landing / discovery experience');
  screenshot(s, screenshots.safety, 3.77, 1.61, 2.93, 4.73, 'Doctor notepad safety-check UI');
  screenshot(s, screenshots.notice, 6.92, 1.61, 2.93, 4.73, 'Medicine safety notice UI');
  screenshot(s, screenshots.admin, 10.07, 1.61, 2.64, 4.73, 'Admin management dashboard');
  addText(s, 'Screenshots are product evidence only. The safety notice image is not presented as evidence of current Gemini reasoning; current AI behavior is verified from the backend pipeline.', 0.82, 6.61, 11.75, 0.18, { fontSize: 7.8, color: C.muted, align: 'center', italic: true });
}

// 18. Differentiators and roadmap
{
  const s = pptx.addSlide();
  addTitle(s, 18, 'Differentiators today, responsible roadmap tomorrow', 'RxGuard is strongest where it combines workflow usability with verifiable control of AI-assisted decisions.');
  const today = ['Verified registry with safety provenance', 'Medical-use grounded hybrid search', 'Typed prescription safety gate', 'Gemini ranking constrained to safe candidates', 'Deterministic and transparent fallback'];
  const future = ['OCR as a separately validated capability', 'Drug–drug interaction and dose checks', 'Allergy and contraindication models', 'pgvector / indexed semantic retrieval at scale', 'Rate limiting, restrictive CORS, and key management'];
  card(s, 0.7, 1.73, 5.86, 3.95, { fill: C.ice, accent: C.green, shadow: true });
  addText(s, 'IMPLEMENTED DIFFERENTIATORS', 1.03, 2.05, 5.1, 0.18, { fontSize: 8.5, color: C.green, bold: true, align: 'center', charSpacing: 0.75 });
  bulletList(s, today, 1.08, 2.62, 4.82, { fontSize: 9.7, gap: 0.51, bulletColor: C.green, height: 0.34 });
  card(s, 6.77, 1.73, 5.86, 3.95, { fill: C.lavender, accent: C.blue, shadow: true });
  addText(s, 'FUTURE ENHANCEMENTS', 7.1, 2.05, 5.1, 0.18, { fontSize: 8.5, color: C.blue, bold: true, align: 'center', charSpacing: 0.75 });
  bulletList(s, future, 7.14, 2.62, 4.82, { fontSize: 9.7, gap: 0.51, bulletColor: C.blue, height: 0.34 });
  shape(s, pptx.ShapeType.roundRect, 2.16, 6.1, 9.0, 0.52, { fill: C.navy, line: false, radius: 0.16 });
  addText(s, 'Thank you • Questions & technical discussion', 2.4, 6.25, 8.52, 0.17, { fontFace: F.head, fontSize: 11.2, color: C.white, bold: true, align: 'center' });
}

const output = path.resolve(__dirname, '..', 'RxGuard_AI_Technical_Presentation.pptx');
pptx.writeFile({ fileName: output })
  .then(() => console.log(`Created ${output}`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
