import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Copy legacy pdfjs-dist build into public/vendor/pdfjs/*.js for universal mobile + offline PDF rendering
const vendorOut = path.join(rootDir, 'public', 'vendor', 'pdfjs');
fs.mkdirSync(vendorOut, { recursive: true });

const pdfSrcDir = fs.existsSync(path.join(rootDir, 'node_modules', 'pdfjs-dist', 'legacy', 'build'))
  ? path.join(rootDir, 'node_modules', 'pdfjs-dist', 'legacy', 'build')
  : path.join(rootDir, 'node_modules', 'pdfjs-dist', 'build');

const pdfCode = fs
  .readFileSync(path.join(pdfSrcDir, 'pdf.min.mjs'), 'utf8')
  .replace(/\.\/pdf\.worker\.mjs/g, './pdf.worker.min.js');
fs.writeFileSync(path.join(vendorOut, 'pdf.min.js'), pdfCode, 'utf8');
fs.copyFileSync(path.join(pdfSrcDir, 'pdf.worker.min.mjs'), path.join(vendorOut, 'pdf.worker.min.js'));

const stdFontsSrc = path.join(rootDir, 'node_modules', 'pdfjs-dist', 'standard_fonts');
if (fs.existsSync(stdFontsSrc)) {
  fs.cpSync(stdFontsSrc, path.join(vendorOut, 'standard_fonts'), { recursive: true });
}

// 2. Build a clean, valid 2-page PDF sample Homework Worksheet in public/samples/
function buildTwoPagePdfBuffer() {
  const escPdf = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const page1Ops = [
    '0.96 0.94 0.90 rg 0 0 595 842 re f',
    '0.12 0.12 0.11 rg 0 760 595 82 re f',
    '0.95 0.72 0.16 rg 0 755 595 5 re f',
    'BT /F2 22 Tf 0.98 0.96 0.93 rg 42 796 Td (i-tutor Academy  |  Homework Pack) Tj ET',
    'BT /F1 11 Tf 0.95 0.72 0.16 rg 42 775 Td (Confidence in learning  -  Grade 12 Mathematics  -  Max Marks: 30) Tj ET',
    'BT /F2 16 Tf 0.12 0.12 0.11 rg 42 718 Td (Worksheet 4: Trigonometry Identities & Double Angles) Tj ET',
    'BT /F1 11 Tf 0.28 0.29 0.27 rg 42 696 Td (Educator: Ms. Naledi Khumalo   |   Due: Friday 17:00   |   Offline-Ready PDF) Tj ET',
    '0.85 0.65 0.15 RG 1.2 w 42 684 m 553 684 l S',
    'BT /F2 13 Tf 0.12 0.12 0.11 rg 42 654 Td (Question 1: Fundamental Double-Angle Proof  [8 Marks]) Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 42 632 Td (' + escPdf('Prove without a calculator that for all permissible values of x:') + ') Tj ET',
    'BT /F2 13 Tf 0.71 0.48 0.05 rg 64 606 Td (' + escPdf('(1 - cos 2x) / sin 2x  =  tan x') + ') Tj ET',
    'BT /F1 10.5 Tf 0.32 0.32 0.30 rg 42 582 Td (' + escPdf('Hint: Substitute cos 2x = 1 - 2 sin^2(x) and sin 2x = 2 sin(x) cos(x).') + ') Tj ET',
    'BT /F2 13 Tf 0.12 0.12 0.11 rg 42 538 Td (Question 2: Compound Angle Evaluation  [10 Marks]) Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 42 516 Td (' + escPdf('Simplify completely without using a calculator:') + ') Tj ET',
    'BT /F2 13 Tf 0.71 0.48 0.05 rg 64 490 Td (' + escPdf('sin 75 deg * cos 15 deg  +  cos 75 deg * sin 15 deg') + ') Tj ET',
    'BT /F2 13 Tf 0.12 0.12 0.11 rg 42 444 Td (Question 3: General Trigonometric Solution  [12 Marks]) Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 42 422 Td (' + escPdf('Determine the general solution of the equation:') + ') Tj ET',
    'BT /F2 13 Tf 0.71 0.48 0.05 rg 64 396 Td (' + escPdf('2 sin^2(x) - sin(x) - 1 = 0') + ') Tj ET',
    '0.99 0.98 0.96 rg 42 250 511 112 re f',
    '0.95 0.72 0.16 RG 1.5 w 42 250 511 112 re S',
    'BT /F2 12 Tf 0.12 0.12 0.11 rg 58 338 Td (Submission Instructions:) Tj ET',
    'BT /F1 10.5 Tf 0.22 0.23 0.21 rg 58 316 Td (1. Write each step clearly from Left-Hand Side to Right-Hand Side.) Tj ET',
    'BT /F1 10.5 Tf 0.22 0.23 0.21 rg 58 296 Td (2. Take a clear photo or scan of your handwritten working.) Tj ET',
    'BT /F1 10.5 Tf 0.22 0.23 0.21 rg 58 276 Td (3. Upload your photo or PDF directly inside Homework or Educator Chat.) Tj ET',
    'BT /F1 9.5 Tf 0.45 0.44 0.41 rg 42 42 Td (Page 1 of 2  -  i-tutor Academy Offline Homework Vault) Tj ET'
  ].join('\n');

  const page2Ops = [
    '0.96 0.94 0.90 rg 0 0 595 842 re f',
    '0.12 0.12 0.11 rg 0 760 595 82 re f',
    '0.95 0.72 0.16 rg 0 755 595 5 re f',
    'BT /F2 20 Tf 0.98 0.96 0.93 rg 42 796 Td (i-tutor Formula Reference Sheet) Tj ET',
    'BT /F1 11 Tf 0.95 0.72 0.16 rg 42 775 Td (Page 2 of 2  -  Keep Saved Offline for Exam Revision) Tj ET',
    'BT /F2 14 Tf 0.12 0.12 0.11 rg 42 710 Td (Core Trigonometric Identities:) Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 54 680 Td (' + escPdf('*  sin^2(x) + cos^2(x) = 1     and     tan(x) = sin(x) / cos(x)') + ') Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 54 652 Td (' + escPdf('*  sin(A + B) = sin A cos B + cos A sin B') + ') Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 54 624 Td (' + escPdf('*  cos(A + B) = cos A cos B - sin A sin B') + ') Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 54 596 Td (' + escPdf('*  sin(2A) = 2 sin A cos A') + ') Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 54 568 Td (' + escPdf('*  cos(2A) = cos^2(A) - sin^2(A) = 1 - 2 sin^2(A) = 2 cos^2(A) - 1') + ') Tj ET',
    'BT /F2 14 Tf 0.12 0.12 0.11 rg 42 512 Td (Sine, Cosine & Area Rules:) Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 54 482 Td (' + escPdf('*  sin A / a  =  sin B / b  =  sin C / c') + ') Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 54 454 Td (' + escPdf('*  a^2 = b^2 + c^2 - 2bc cos A') + ') Tj ET',
    'BT /F1 11.5 Tf 0.18 0.19 0.17 rg 54 426 Td (' + escPdf('*  Area of Triangle ABC = 1/2 ab sin C') + ') Tj ET',
    'BT /F1 9.5 Tf 0.45 0.44 0.41 rg 42 42 Td (Page 2 of 2  -  i-tutor Academy  |  Confidence in learning) Tj ET'
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 7 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 8 0 R >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `7 0 obj\n<< /Length ${Buffer.byteLength(page1Ops, 'utf8')} >>\nstream\n${page1Ops}\nendstream\nendobj\n`,
    `8 0 obj\n<< /Length ${Buffer.byteLength(page2Ops, 'utf8')} >>\nstream\n${page2Ops}\nendstream\nendobj\n`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

const samplesDir = path.join(rootDir, 'public', 'samples');
fs.mkdirSync(samplesDir, { recursive: true });
fs.writeFileSync(path.join(samplesDir, 'trig-identities-worksheet.pdf'), buildTwoPagePdfBuffer());

const pulleySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 500" width="820" height="500">
  <rect width="820" height="500" fill="#F8F3EC" rx="22"/>
  <rect x="0" y="0" width="820" height="68" fill="#1E1F1D" rx="22"/>
  <rect x="0" y="48" width="820" height="20" fill="#1E1F1D"/>
  <rect x="0" y="66" width="820" height="4" fill="#F2B728"/>
  <text x="32" y="43" fill="#F8F3EC" font-family="system-ui, sans-serif" font-size="21" font-weight="800">i-tutor Physics Homework Diagram — Two-Body Pulley System</text>
  <!-- Table -->
  <rect x="70" y="250" width="460" height="22" fill="#2A2C29" rx="4"/>
  <rect x="95" y="272" width="22" height="175" fill="#484A45"/>
  <rect x="470" y="272" width="22" height="175" fill="#484A45"/>
  <!-- Block A -->
  <rect x="210" y="166" width="130" height="84" fill="#F2B728" stroke="#1E1F1D" stroke-width="3" rx="10"/>
  <text x="275" y="205" text-anchor="middle" fill="#1E1F1D" font-family="system-ui, sans-serif" font-size="19" font-weight="800">Block A</text>
  <text x="275" y="229" text-anchor="middle" fill="#1E1F1D" font-family="system-ui, sans-serif" font-size="15" font-weight="700">m = 4 kg</text>
  <!-- Friction Arrow Left -->
  <line x1="210" y1="238" x2="120" y2="238" stroke="#C43B30" stroke-width="4"/>
  <polygon points="120,230 102,238 120,246" fill="#C43B30"/>
  <text x="150" y="224" text-anchor="middle" fill="#C43B30" font-family="system-ui, sans-serif" font-size="15" font-weight="800">f_k (μ = 0.25)</text>
  <!-- Tension Arrow Right -->
  <line x1="340" y1="205" x2="555" y2="205" stroke="#1E7E48" stroke-width="4"/>
  <polygon points="448,197 468,205 448,213" fill="#1E7E48"/>
  <text x="445" y="188" text-anchor="middle" fill="#1E7E48" font-family="system-ui, sans-serif" font-size="16" font-weight="800">Tension T</text>
  <!-- Pulley Wheel -->
  <line x1="525" y1="255" x2="578" y2="222" stroke="#1E1F1D" stroke-width="6"/>
  <circle cx="585" cy="222" r="28" fill="#EFE7DC" stroke="#1E1F1D" stroke-width="4"/>
  <circle cx="585" cy="222" r="6" fill="#1E1F1D"/>
  <!-- Vertical Rope & Block B -->
  <line x1="613" y1="222" x2="613" y2="330" stroke="#1E7E48" stroke-width="4"/>
  <polygon points="605,288 613,268 621,288" fill="#1E7E48"/>
  <text x="648" y="284" fill="#1E7E48" font-family="system-ui, sans-serif" font-size="16" font-weight="800">T</text>
  <rect x="558" y="330" width="110" height="84" fill="#FCE078" stroke="#1E1F1D" stroke-width="3" rx="10"/>
  <text x="613" y="368" text-anchor="middle" fill="#1E1F1D" font-family="system-ui, sans-serif" font-size="19" font-weight="800">Block B</text>
  <text x="613" y="392" text-anchor="middle" fill="#1E1F1D" font-family="system-ui, sans-serif" font-size="15" font-weight="700">m = 6 kg</text>
  <!-- Gravity Arrow on B -->
  <line x1="613" y1="414" x2="613" y2="468" stroke="#C43B30" stroke-width="4"/>
  <polygon points="605,462 613,480 621,462" fill="#C43B30"/>
  <text x="678" y="458" fill="#C43B30" font-family="system-ui, sans-serif" font-size="15" font-weight="800">F_g = 58.8 N</text>
  <!-- Footer -->
  <text x="32" y="478" fill="#74716A" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Find acceleration (a) and rope tension (T) — Tap + to zoom inside i-tutor Photo Opener</text>
</svg>`;
fs.writeFileSync(path.join(samplesDir, 'newton-pulley-diagram.svg'), pulleySvg, 'utf8');

console.log('i-tutor vendor PDF engine & sample homework media ready.');
