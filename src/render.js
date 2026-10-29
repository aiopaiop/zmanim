'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, ImageRun, Header, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom,
  TextWrappingType, UnderlineType, TableLayoutType, VerticalAlign,
} = require('docx');
const { SLOTS } = require('./times');

const FONT = 'Times New Roman';
const BLANK = path.join(__dirname, '..', 'assets', 'blank.jpg');
const SOFFICE_CMD = process.env.SOFFICE_CMD || 'soffice';

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

function run(text, size, opts = {}) {
  return new TextRun({
    text, font: FONT, size, bold: !!opts.bold, rightToLeft: opts.ltr ? false : true,
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
  });
}

function slotRow(slot, ad) {
  const time = ad.times[slot.key] || '';
  const suffix = slot.hasSuffix ? (ad.suffix[slot.key] || '') : '';
  const cell = (width, children) => new TableCell({
    width: { size: width, type: WidthType.DXA }, borders: NO_BORDERS,
    margins: { top: 130, bottom: 130, left: 60, right: 60 }, verticalAlign: VerticalAlign.CENTER, children,
  });
  return new TableRow({
    children: [
      cell(4300, [new Paragraph({ bidirectional: true, children: [run(slot.label, 68)] })]),
      cell(1800, [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: suffix ? [run(suffix, 44)] : [] })]),
      cell(2206, [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(time, 68, { ltr: true })] })]),
    ],
  });
}

function buildDocument(ad) {
  const header = new Header({
    children: [new Paragraph({
      children: [new ImageRun({
        type: 'jpg', data: fs.readFileSync(BLANK), transformation: { width: 794, height: 1123 },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
          behindDocument: true, allowOverlap: true, wrap: { type: TextWrappingType.NONE },
        },
      })],
    })],
  });

  const title = new Paragraph({
    alignment: AlignmentType.CENTER, bidirectional: true, spacing: { after: 400 },
    children: [run(`זמני התפילות לשבת פרשת ${ad.parsha}`, 64, { bold: true, underline: true })],
  });

  const table = new Table({
    width: { size: 8306, type: WidthType.DXA }, columnWidths: [4300, 1800, 2206],
    layout: TableLayoutType.FIXED, visuallyRightToLeft: true,
    borders: { ...NO_BORDERS, insideHorizontal: NONE, insideVertical: NONE },
    rows: SLOTS.map((s) => slotRow(s, ad)),
  });

  const sig = (text, size, bold, before) => new Paragraph({
    alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: before || 0 },
    children: [run(text, size, { bold })],
  });

  return new Document({
    creator: 'prayer-ads',
    title: `זמני התפילות לשבת פרשת ${ad.parsha}`,
    sections: [{
      headers: { default: header },
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 3900, bottom: 1500, left: 1800, right: 1800, header: 0, footer: 0 } } },
      children: [title, table, sig('בברכת', 44, false, 500), sig('שבת שלום ומבורך', 52, true), sig('הגבאים', 48, false)],
    }],
  });
}

async function renderDocx(ad) {
  return Packer.toBuffer(buildDocument(ad));
}

let queue = Promise.resolve();
function exclusive(fn) {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
}

function docxToPdf(docxBuf) {
  return exclusive(() => new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-'));
    const input = path.join(dir, 'ad.docx');
    fs.writeFileSync(input, docxBuf);
    const [cmd, ...pre] = SOFFICE_CMD.split(' ');
    const args = [...pre, '--headless', `-env:UserInstallation=file://${dir}/profile`, '--convert-to', 'pdf', '--outdir', dir, input];
    execFile(cmd, args, { timeout: 120000 }, (err) => {
      try {
        if (err) throw err;
        resolve(fs.readFileSync(path.join(dir, 'ad.pdf')));
      } catch (e) {
        reject(new Error('המרה ל-PDF נכשלה: ' + e.message));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }));
}

// מטמון: אותה מודעה לא נבנית פעמיים
const cache = new Map();
function adKey(ad) {
  return crypto.createHash('sha1').update(JSON.stringify([ad.parsha, ad.times, ad.suffix])).digest('hex');
}

async function renderFiles(ad) {
  const key = adKey(ad);
  if (cache.has(key)) return cache.get(key);
  const docx = await renderDocx(ad);
  const pdf = await docxToPdf(docx);
  const files = { docx, pdf };
  cache.clear();
  cache.set(key, files);
  return files;
}

function fileBase(ad) {
  return `זמני_התפילות_פרשת_${String(ad.parsha).replace(/\s+/g, '_')}`;
}

module.exports = { renderDocx, renderFiles, fileBase };
