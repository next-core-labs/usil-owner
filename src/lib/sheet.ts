/**
 * Read the first sheet of an Excel (.xlsx) or CSV file into rows of text, with
 * no spreadsheet library: an .xlsx is a zip of XML, and the browser can inflate
 * it itself (`DecompressionStream`). The SheetJS build on npm carries known
 * advisories, and importing a phone list needs only cells, not formulas.
 *
 * Old binary .xls files are not supported — Excel saves .xlsx by default.
 */

export class SheetError extends Error {}

const XLS_UNSUPPORTED = 'صيغة .xls القديمة غير مدعومة. افتح الملف في إكسل واحفظه بصيغة .xlsx أو CSV.';
const UNREADABLE = 'تعذّر قراءة الملف. تأكد أنه ملف إكسل (.xlsx) أو CSV.';

/* ── zip ─────────────────────────────────────────────────────────────── */

type ZipEntry = { name: string; method: number; compressedSize: number; localOffset: number };

function zipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory: scan back over a possible archive comment.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new SheetError(UNREADABLE);
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new SheetError(UNREADABLE);
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    entries.set(name, { name, method, compressedSize, localOffset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new SheetError(UNREADABLE);
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const raw = bytes.subarray(start, start + entry.compressedSize);
  const data = entry.method === 0 ? raw : entry.method === 8 ? await inflateRaw(raw) : null;
  if (!data) throw new SheetError(UNREADABLE);
  return new TextDecoder().decode(data);
}

/* ── xlsx XML ────────────────────────────────────────────────────────── */

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** All `<t>` runs inside a shared string or inline string, joined (rich text). */
function textRuns(xml: string): string {
  let out = '';
  for (const match of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decodeXml(match[1]);
  return out;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] || 'A';
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

/** A number cell as text: phone numbers come out whole, never as 9.665E+11. */
function numberText(raw: string): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  return Number.isInteger(value) ? BigInt(Math.round(value)).toString() : String(value);
}

function sheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] || '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] || 'n';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textRuns(body);
      else if (type === 'str' || type === 'e') value = decodeXml(raw ?? '');
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      else value = raw === undefined ? '' : numberText(raw);
      const index = ref ? columnIndex(ref) : cells.length;
      cells[index] = value.trim();
    }
    rows.push(Array.from(cells, (value) => value ?? ''));
  }
  return rows;
}

/** The workbook's first sheet, resolved through its relationships; sheet1 as a fallback. */
async function firstSheetPath(bytes: Uint8Array, entries: Map<string, ZipEntry>): Promise<string> {
  const workbook = entries.get('xl/workbook.xml');
  const rels = entries.get('xl/_rels/workbook.xml.rels');
  if (workbook && rels) {
    const wb = await readEntry(bytes, workbook);
    const relId = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(wb)?.[1];
    if (relId) {
      const relXml = await readEntry(bytes, rels);
      for (const rel of relXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        if (new RegExp(`\\bId="${relId}"`).test(rel[1])) {
          const target = /\bTarget="([^"]+)"/.exec(rel[1])?.[1] || '';
          const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
          if (entries.has(path)) return path;
        }
      }
    }
  }
  if (entries.has('xl/worksheets/sheet1.xml')) return 'xl/worksheets/sheet1.xml';
  throw new SheetError(UNREADABLE);
}

export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const entries = zipEntries(bytes);
  const sharedEntry = entries.get('xl/sharedStrings.xml');
  const shared: string[] = [];
  if (sharedEntry) {
    const xml = await readEntry(bytes, sharedEntry);
    for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(textRuns(si[1]));
  }
  const sheet = entries.get(await firstSheetPath(bytes, entries));
  if (!sheet) throw new SheetError(UNREADABLE);
  return sheetRows(await readEntry(bytes, sheet), shared);
}

/* ── csv ─────────────────────────────────────────────────────────────── */

export function readCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  // Arabic-locale Excel saves CSV with semicolons.
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

export async function readSpreadsheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xls')) throw new SheetError(XLS_UNSUPPORTED);
  if (name.endsWith('.csv') || file.type === 'text/csv') return readCsv(await file.text());
  const bytes = new Uint8Array(await file.arrayBuffer());
  // "PK" — a zip (xlsx); anything else is tried as CSV text.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes);
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) throw new SheetError(XLS_UNSUPPORTED);
  return readCsv(new TextDecoder().decode(bytes));
}

/* ── mapping rows to contacts ────────────────────────────────────────── */

export type LeadField = 'name' | 'phone' | 'city' | 'activity' | 'note';
export type ColumnMap = Partial<Record<LeadField, number>>;

const HEADER_PATTERNS: Array<[LeadField, RegExp]> = [
  ['phone', /جوال|هاتف|موبايل|الرقم|رقم|واتس|phone|mobile|tel|whats/i],
  ['city', /مدينة|المدينة|منطقة|city|region/i],
  ['activity', /نشاط|النشاط|الخدمة|خدمة|تصنيف|التخصص|category|activity|service|type/i],
  ['note', /ملاحظ|note|comment|remarks/i],
  ['name', /اسم|الاسم|المورد|المورّد|الشركة|المحل|المؤسسة|name|company|vendor/i],
];

/** Looks like a Saudi mobile in any of the usual spellings. */
export function looksLikePhone(value: string): boolean {
  const digits = String(value || '').replace(/\D/g, '');
  return /^(00966|966)?0?5\d{8}$/.test(digits);
}

/**
 * Which column holds what. A header row is recognised by its titles; without
 * one, the phone column is the one whose cells look most like mobiles.
 */
export function detectColumns(rows: string[][]): { map: ColumnMap; headerRow: boolean } {
  const first = rows.find((row) => row.some((cell) => cell.trim())) || [];
  const map: ColumnMap = {};
  first.forEach((cell, index) => {
    if (!cell || looksLikePhone(cell)) return;
    for (const [field, pattern] of HEADER_PATTERNS) {
      if (map[field] === undefined && pattern.test(cell)) {
        map[field] = index;
        break;
      }
    }
  });
  if (map.phone !== undefined) return { map, headerRow: true };

  const width = Math.max(0, ...rows.slice(0, 50).map((row) => row.length));
  let best = -1;
  let bestScore = 0;
  for (let col = 0; col < width; col++) {
    const score = rows.slice(0, 50).filter((row) => looksLikePhone(row[col] || '')).length;
    if (score > bestScore) {
      best = col;
      bestScore = score;
    }
  }
  const headerRow = Object.keys(map).length > 0;
  if (best >= 0) map.phone = best;
  // No titles at all: the first column with words (not numbers) is most likely the name.
  if (!headerRow && map.name === undefined) {
    for (let col = 0; col < width; col++) {
      if (col === map.phone) continue;
      const words = rows.slice(0, 50).filter((row) => /[\p{L}]/u.test(row[col] || '')).length;
      if (words > 0) {
        map.name = col;
        break;
      }
    }
  }
  return { map, headerRow };
}

export function rowsToLeads(rows: string[][], map: ColumnMap, headerRow: boolean) {
  const body = (headerRow ? rows.slice(rows.findIndex((row) => row.some((cell) => cell.trim())) + 1) : rows).filter((row) =>
    row.some((cell) => cell.trim()),
  );
  const pick = (row: string[], field: LeadField) => (map[field] === undefined ? '' : String(row[map[field]!] ?? '').trim());
  return body.map((row) => ({
    name: pick(row, 'name'),
    phone: pick(row, 'phone'),
    city: pick(row, 'city'),
    activity: pick(row, 'activity'),
    note: pick(row, 'note'),
  }));
}
