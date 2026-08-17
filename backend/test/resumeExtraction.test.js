import { Buffer } from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseResumeUpload } from '../src/utils/resume/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

async function loadTextFixture(name) {
  return readFile(path.join(fixturesDir, 'resumes', name), 'utf8');
}

async function loadJsonFixture(kind, name) {
  const raw = await readFile(path.join(fixturesDir, kind, name), 'utf8');
  return JSON.parse(raw);
}

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdfBuffer(lines, options = {}) {
  const width = options.width || 612;
  const height = options.height || 792;
  const fontObjectId = 5;

  const pages = Array.isArray(lines[0]) ? lines : [lines];
  const objects = [];

  const catalogId = 1;
  const pagesId = 2;
  const pageIds = [];
  const contentIds = [];

  for (let i = 0; i < pages.length; i += 1) {
    pageIds.push(3 + i * 2);
    contentIds.push(4 + i * 2);
  }

  objects.push(`${catalogId} 0 obj
<< /Type /Catalog /Pages ${pagesId} 0 R >>
endobj
`);

  objects.push(`${pagesId} 0 obj
<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>
endobj
`);

  for (let i = 0; i < pages.length; i += 1) {
    const pageObjectId = pageIds[i];
    const contentObjectId = contentIds[i];
    const contentLines = pages[i];
    const contentStream = contentLines.map((line) => {
      const x = line.x ?? 72;
      const y = line.y ?? (height - 72);
      const fontSize = line.fontSize || 12;
      return `BT /F1 ${fontSize} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(line.text)}) Tj ET`;
    }).join('\n');
    const contentBytes = Buffer.from(contentStream, 'utf8');
    objects.push(`${pageObjectId} 0 obj
<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>
endobj
`);
    objects.push(`${contentObjectId} 0 obj
<< /Length ${contentBytes.length} >>
stream
${contentStream}
endstream
endobj
`);
  }

  objects.push(`${fontObjectId} 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
`);

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += object;
  }

  const xrefOffset = Buffer.byteLength(body, 'utf8');
  const xrefCount = objects.length + 1;
  let xref = `xref\n0 ${xrefCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < xrefCount; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${xrefCount} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, 'utf8');
}

function crc32(buffer) {
  const table = crc32.table || (crc32.table = (() => {
    const tbl = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      tbl[i] = c >>> 0;
    }
    return tbl;
  })());

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeZipEntry(name, data, offset) {
  const nameBuffer = Buffer.from(name, 'utf8');
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const header = Buffer.alloc(30 + nameBuffer.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(crc32(payload), 14);
  header.writeUInt32LE(payload.length, 18);
  header.writeUInt32LE(payload.length, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  nameBuffer.copy(header, 30);

  const central = Buffer.alloc(46 + nameBuffer.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(crc32(payload), 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(payload.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(offset, 42);
  nameBuffer.copy(central, 46);

  return { header, payload, central };
}

function buildZipBuffer(entries) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, data] of entries) {
    const entry = writeZipEntry(name, data, offset);
    fileParts.push(entry.header, entry.payload);
    centralParts.push(entry.central);
    offset += entry.header.length + entry.payload.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectory, eocd]);
}

function buildDocxBuffer(paragraphs) {
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map((paragraph) => `<w:p><w:r><w:t>${paragraph}</w:t></w:r></w:p>`).join('\n    ')}
    <w:sectPr/>
  </w:body>
</w:document>`;

  return buildZipBuffer([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`],
    ['word/document.xml', docXml],
  ]);
}

function pickSummary(result) {
  return {
    name: result.payload.firstName && result.payload.lastName ? `${result.payload.firstName} ${result.payload.lastName}` : '',
    location: result.payload.location,
    currentRole: result.payload.currentRole,
    currentCompany: result.payload.currentCompany,
    skills: result.payload.skills,
    educationYear: result.payload.education?.[0]?.year ? String(result.payload.education[0].year) : '',
    totalExperience: Number(result.payload.totalExperience || 0),
    status: result._status || result.extraction.metadata.status,
    warnings: result.extraction.metadata.warnings,
  };
}

test('extracts a one-column PDF resume into the existing candidate payload', async () => {
  const content = await loadTextFixture('one-column.txt');
  const lines = content.split('\n').map((text, index) => ({ text, x: 72, y: 740 - (index * 16), fontSize: /^(Experience|Education|Skills|Projects|Certifications|Languages|Professional Summary)$/.test(text) ? 13 : 11 }));
  const buffer = buildPdfBuffer(lines);
  const result = await parseResumeUpload({ buffer, originalname: 'one-column.pdf', mimetype: 'application/pdf', size: buffer.length });

  const expected = await loadJsonFixture('expected', 'one-column.json');
  const summary = pickSummary(result);

  assert.equal(summary.name, expected.name);
  assert.equal(summary.location.raw || summary.location, expected.location);
  assert.equal(summary.currentRole, expected.currentRole);
  assert.equal(summary.currentCompany, expected.currentCompany);
  assert.equal(summary.status, expected.status);
  assert.ok(summary.skills.includes('React'));
  assert.ok(summary.skills.includes('Node.js'));
  assert.ok(summary.skills.includes('AWS'));
  assert.equal(summary.educationYear, expected.educationYear);
  assert.ok(summary.totalExperience >= 6);
  assert.ok(summary.totalExperience <= 10);
});

test('extracts a DOCX resume and normalizes location names', async () => {
  const paragraphs = (await loadTextFixture('docx.txt')).split('\n').filter(Boolean);
  const buffer = buildDocxBuffer(paragraphs);
  const result = await parseResumeUpload({ buffer, originalname: 'sample.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: buffer.length });

  const expected = await loadJsonFixture('expected', 'docx.json');
  const summary = pickSummary(result);

  assert.equal(summary.name, expected.name);
  assert.equal(summary.location.raw || summary.location.normalized || summary.location, expected.location);
  assert.equal(summary.currentRole, expected.currentRole);
  assert.equal(summary.currentCompany, expected.currentCompany);
  assert.equal(summary.status, expected.status);
  assert.ok(summary.skills.includes('React'));
  assert.ok(summary.skills.includes('TypeScript'));
  assert.ok(summary.skills.includes('Node.js'));
  assert.ok(summary.skills.includes('Figma'));
  assert.ok(summary.skills.includes('Jira'));
  assert.equal(summary.educationYear, expected.educationYear);
});

test('handles two-column PDF layouts and emits a layout warning', async () => {
  const layout = await loadJsonFixture('resumes', 'two-column.layout.json');
  const buffer = buildPdfBuffer(layout.pages[0].lines.map((line) => ({ ...line, fontSize: 11 })), { width: layout.pages[0].width, height: layout.pages[0].height });
  const result = await parseResumeUpload({ buffer, originalname: 'two-column.pdf', mimetype: 'application/pdf', size: buffer.length });

  const expected = await loadJsonFixture('expected', 'two-column.json');
  const summary = pickSummary(result);

  assert.equal(summary.name, expected.name);
  assert.equal(summary.location.raw || summary.location.normalized || summary.location, expected.location);
  assert.equal(summary.currentRole, expected.currentRole);
  assert.equal(summary.currentCompany, expected.currentCompany);
  assert.equal(summary.status, expected.status);
  assert.ok(result.extraction.document.layout.type === 'two-column');
  assert.ok(summary.warnings.some((warning) => warning.includes(expected.warningsContains)));
  assert.ok(summary.skills.includes('React'));
  assert.ok(summary.skills.includes('AWS'));
  assert.ok(summary.totalExperience >= 3);
  assert.ok(summary.totalExperience <= 6.5);
});

test('supports legacy DOC uploads with best-effort text extraction', async () => {
  const content = await loadTextFixture('one-column.txt');
  const buffer = Buffer.from(content, 'utf8');
  const result = await parseResumeUpload({ buffer, originalname: 'legacy.doc', mimetype: 'application/msword', size: buffer.length });

  assert.equal(result.payload.firstName, 'Jane');
  assert.equal(result.payload.lastName, 'Kumar');
  assert.equal(result.payload.email, 'jane.kumar@example.com');
  assert.ok(Array.isArray(result.extraction.skills));
  assert.ok(result.extraction.metadata.status === 'complete' || result.extraction.metadata.status === 'partial');
});
