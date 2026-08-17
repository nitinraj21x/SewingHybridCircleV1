import { Buffer } from 'node:buffer';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { inflateRawSync } from 'node:zlib';
import { TextDecoder } from 'node:util';

const STANDARD_FONT_DATA_URL = new URL('../../../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).toString();

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function bboxUnion(acc, item) {
  if (!acc) return item;
  const x1 = Math.min(acc.x, item.x);
  const y1 = Math.min(acc.y, item.y);
  const x2 = Math.max(acc.x + acc.width, item.x + item.width);
  const y2 = Math.max(acc.y + acc.height, item.y + item.height);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function groupPdfItemsIntoLines(items) {
  const sorted = items
    .map((item) => ({
      text: item.str || '',
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
      width: item.width ?? 0,
      height: item.height ?? 0,
      fontName: item.fontName || '',
      raw: item,
    }))
    .filter((item) => item.text.trim())
    .sort((a, b) => (Math.abs(b.y - a.y) > 0.5 ? b.y - a.y : a.x - b.x));

  const lines = [];
  let current = null;

  for (const item of sorted) {
    const height = item.height || 10;
    if (!current || Math.abs(item.y - current.y) > Math.max(2, height * 0.7)) {
      if (current) lines.push(current);
      current = {
        textParts: [item.text.trim()],
        items: [item],
        x: item.x,
        y: item.y,
        bbox: { x: item.x, y: item.y - height, width: item.width || 0, height },
      };
      continue;
    }

    const last = current.items[current.items.length - 1];
    const horizontalJump = item.x - last.x;
    if (horizontalJump > 140 || horizontalJump < -10) {
      lines.push(current);
      current = {
        textParts: [item.text.trim()],
        items: [item],
        x: item.x,
        y: item.y,
        bbox: { x: item.x, y: item.y - height, width: item.width || 0, height },
      };
      continue;
    }
    const gap = item.x - (last.x + (last.width || 0));
    if (gap > 4) current.textParts.push(' ');
    current.textParts.push(item.text.trim());
    current.items.push(item);
    current.bbox = bboxUnion(current.bbox, {
      x: item.x,
      y: item.y - height,
      width: item.width || 0,
      height,
    });
  }

  if (current) lines.push(current);

  return lines.map((line, index) => ({
    id: `line-${index + 1}`,
    text: normalizeText(line.textParts.join('').replace(/\s+/g, ' ')),
    x: line.bbox.x,
    y: line.y,
    width: line.bbox.width,
    height: line.bbox.height,
    page: line.page,
    items: line.items.map((item) => ({
      text: item.text,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      fontName: item.fontName,
    })),
  }));
}

function detectLayoutFromLines(lines) {
  const xs = lines.map((line) => line.x).filter((x) => Number.isFinite(x));
  if (xs.length < 8) {
    return { type: 'single-column', columns: 1, confidence: 0.4 };
  }

  const sorted = [...xs].sort((a, b) => a - b);
  const minX = sorted[0];
  const maxX = sorted[sorted.length - 1];
  const left = xs.filter((x) => x <= minX + 120).length;
  const right = xs.filter((x) => x >= maxX - 120).length;
  const ratio = Math.min(left, right) / Math.max(left, right || 1);

  if ((maxX - minX) >= 180 && left >= 3 && right >= 3 && ratio > 0.45) {
    return { type: 'two-column', columns: 2, confidence: 0.78 };
  }

  return { type: 'single-column', columns: 1, confidence: 0.66 };
}

async function extractPdf(buffer, originalname) {
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise;
  const pages = [];
  const blocks = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    const lines = groupPdfItemsIntoLines(content.items);
    const pageLines = lines.map((line) => ({
      ...line,
      page: pageNumber,
    }));

    const pageBlocks = pageLines.map((line, index) => ({
      id: `p${pageNumber}-b${index + 1}`,
      page: pageNumber,
      text: line.text,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      fontSize: line.items[0]?.height || null,
      fontWeight: /bold/i.test(line.items[0]?.fontName || '') ? 'bold' : 'normal',
      items: line.items,
    }));

    pages.push({
      page: pageNumber,
      width: page.view?.[2] ?? null,
      height: page.view?.[3] ?? null,
      lines: pageLines,
      blocks: pageBlocks,
    });
    blocks.push(...pageBlocks);
  }

  const allLines = pages.flatMap((page) => page.lines);
  const rawText = normalizeText(allLines.map((line) => line.text).join('\n'));
  const layout = detectLayoutFromLines(allLines);

  return {
    type: 'pdf',
    source: originalname,
    pages,
    blocks,
    rawText,
    layout,
    textConfidence: rawText ? 0.92 : 0.1,
  };
}

function readUInt16LE(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function findEocd(buffer) {
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function parseZipEntries(buffer) {
  const eocdOffset = findEocd(buffer);
  if (eocdOffset < 0) {
    throw new Error('Unsupported DOCX/ZIP archive: end of central directory not found.');
  }

  const totalEntries = readUInt16LE(buffer, eocdOffset + 10);
  const centralDirectoryOffset = readUInt32LE(buffer, eocdOffset + 16);
  const entries = new Map();
  let offset = centralDirectoryOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Unsupported DOCX/ZIP archive: central directory entry not found.');
    }

    const compressionMethod = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const uncompressedSize = readUInt32LE(buffer, offset + 24);
    const fileNameLength = readUInt16LE(buffer, offset + 28);
    const extraLength = readUInt16LE(buffer, offset + 30);
    const commentLength = readUInt16LE(buffer, offset + 32);
    const localHeaderOffset = readUInt32LE(buffer, offset + 42);
    const fileName = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    const localHeaderNameLength = readUInt16LE(buffer, localHeaderOffset + 26);
    const localHeaderExtraLength = readUInt16LE(buffer, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localHeaderNameLength + localHeaderExtraLength;
    const dataEnd = dataStart + compressedSize;
    const compressed = buffer.slice(dataStart, dataEnd);

    let data;
    if (compressionMethod === 0) {
      data = Buffer.from(compressed);
    } else if (compressionMethod === 8) {
      data = Buffer.from(inflateRawSync(compressed));
    } else {
      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    if (uncompressedSize && data.length !== uncompressedSize) {
      // Keep going, but the archive is probably malformed.
    }

    entries.set(fileName, data);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripDocxXml(xml) {
  if (!xml) return '';

  return normalizeText(
    decodeXmlEntities(
      xml
        .replace(/<w:tab\s*\/>/g, '\t')
        .replace(/<w:br\s*\/>/g, '\n')
        .replace(/<w:cr\s*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<w:p[^>]*>/g, '')
        .replace(/<w:tr[^>]*>/g, '')
        .replace(/<w:tc[^>]*>/g, '')
        .replace(/<\/w:tc>/g, '\t')
        .replace(/<[^>]+>/g, '')
    )
  );
}

function extractDocx(buffer, originalname) {
  const entries = parseZipEntries(buffer);
  const xmlParts = [];
  const pages = [];
  const blocks = [];

  const interestingEntries = [...entries.keys()].filter((name) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(name)
  );

  for (const entryName of interestingEntries.sort()) {
    const xml = new TextDecoder('utf8').decode(entries.get(entryName));
    const text = stripDocxXml(xml);
    if (text) xmlParts.push(text);
  }

  const rawText = normalizeText(xmlParts.join('\n'));
  const lines = rawText.split('\n').map((line, index) => ({
    id: `line-${index + 1}`,
    text: line.trim(),
    x: 0,
    y: index * 12,
    width: line.length * 7,
    height: 12,
    page: 1,
    items: [],
  })).filter((line) => line.text);

  lines.forEach((line, index) => {
    blocks.push({
      id: `docx-b${index + 1}`,
      page: 1,
      text: line.text,
      x: 0,
      y: line.y,
      width: line.width,
      height: line.height,
      fontSize: null,
      fontWeight: 'normal',
      items: [],
    });
  });

  pages.push({
    page: 1,
    width: null,
    height: null,
    lines,
    blocks,
  });

  return {
    type: 'docx',
    source: originalname,
    pages,
    blocks,
    rawText,
    layout: { type: 'flow', columns: 1, confidence: 0.72 },
    textConfidence: rawText ? 0.88 : 0.12,
  };
}

function extractPrintableText(buffer) {
  const decoder = new TextDecoder('latin1');
  const text = decoder.decode(buffer);
  const runs = text.match(/[ -~]{4,}/g) || [];
  return normalizeText(runs.join('\n'));
}

function extractDoc(buffer, originalname) {
  const rawText = extractPrintableText(buffer);
  const lines = rawText.split('\n').map((line, index) => ({
    id: `line-${index + 1}`,
    text: line.trim(),
    x: 0,
    y: index * 12,
    width: line.length * 7,
    height: 12,
    page: 1,
    items: [],
  })).filter((line) => line.text);

  return {
    type: 'doc',
    source: originalname,
    pages: [{ page: 1, width: null, height: null, lines, blocks: lines }],
    blocks: lines,
    rawText,
    layout: { type: 'unknown', columns: 1, confidence: 0.22 },
    textConfidence: rawText ? 0.42 : 0.05,
  };
}

function extractTxt(buffer, originalname) {
  const rawText = normalizeText(new TextDecoder('utf8').decode(buffer));
  const lines = rawText.split('\n').map((line, index) => ({
    id: `line-${index + 1}`,
    text: line.trim(),
    x: 0,
    y: index * 12,
    width: line.length * 7,
    height: 12,
    page: 1,
    items: [],
  })).filter((line) => line.text);

  return {
    type: 'txt',
    source: originalname,
    pages: [{ page: 1, width: null, height: null, lines, blocks: lines }],
    blocks: lines,
    rawText,
    layout: { type: 'flow', columns: 1, confidence: 0.95 },
    textConfidence: rawText ? 0.99 : 0.1,
  };
}

function getExtension(originalname = '', mimetype = '') {
  const fromName = (originalname.split('.').pop() || '').toLowerCase();
  if (fromName) return fromName;
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype === 'text/plain') return 'txt';
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimetype === 'application/msword') return 'doc';
  return '';
}

export async function ingestResumeDocument(file) {
  if (!file?.buffer) {
    throw new Error('Missing resume buffer.');
  }

  const extension = getExtension(file.originalname, file.mimetype);
  if (extension === 'pdf') return extractPdf(file.buffer, file.originalname);
  if (extension === 'docx') return extractDocx(file.buffer, file.originalname);
  if (extension === 'doc') return extractDoc(file.buffer, file.originalname);
  if (extension === 'txt') return extractTxt(file.buffer, file.originalname);

  // Fall back to a printable text scan so we never silently fail.
  return extractDoc(file.buffer, file.originalname);
}

export function extractPlainTextFromDocument(document) {
  return normalizeText(document?.rawText || document?.pages?.flatMap((page) => page.lines?.map((line) => line.text) || []).join('\n') || '');
}
