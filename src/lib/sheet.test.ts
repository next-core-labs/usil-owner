import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectColumns, looksLikePhone, readCsv, readXlsx, rowsToLeads } from './sheet.ts';

// Both fixtures were saved by SheetJS the way Excel saves them: shared strings,
// numbers stored as numbers, an Arabic sheet name.
const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)));

describe('reading an Excel sheet of supplier numbers', () => {
  it('reads titled columns, keeps numbers whole and skips empty rows', async () => {
    const rows = await readXlsx(fixture('leads.xlsx'));
    const { map, headerRow } = detectColumns(rows);
    assert.equal(headerRow, true);
    assert.deepEqual(map, { name: 0, phone: 1, city: 2, activity: 3, note: 4 });
    const leads = rowsToLeads(rows, map, headerRow);
    assert.equal(leads.length, 4);
    assert.deepEqual(leads[0], { name: 'قهوة الديرة', phone: '501234567', city: 'الرياض', activity: 'قهوة', note: 'تواصل & متابعة' });
    // A number cell with the country code comes out in full, not as 9.66E+11.
    assert.equal(leads[1].phone, '966551112223');
    assert.equal(leads[2].note, '<مهم>');
  });

  it('finds the phone and name columns of a sheet without titles', async () => {
    const rows = await readXlsx(fixture('noheader.xlsx'));
    const { map, headerRow } = detectColumns(rows);
    assert.equal(headerRow, false);
    assert.deepEqual(map, { phone: 1, name: 0 });
    assert.deepEqual(rowsToLeads(rows, map, headerRow).map((l) => l.phone), ['0501111111', '+966 50 222 2222']);
  });

  it('reads CSV with quotes and the semicolons Arabic Excel uses', () => {
    const rows = readCsv('﻿الاسم;الجوال\r\n"قهوة ""الأصيل""";0503333333\r\n');
    const { map, headerRow } = detectColumns(rows);
    assert.deepEqual(rowsToLeads(rows, map, headerRow), [
      { name: 'قهوة "الأصيل"', phone: '0503333333', city: '', activity: '', note: '' },
    ]);
  });

  it('recognises Saudi mobiles in their usual spellings only', () => {
    for (const ok of ['0501234567', '501234567', '966501234567', '+966 50 123 4567', '00966501234567']) {
      assert.equal(looksLikePhone(ok), true, ok);
    }
    for (const bad of ['05012', '0112345678', 'قهوة', '']) assert.equal(looksLikePhone(bad), false, bad);
  });
});
