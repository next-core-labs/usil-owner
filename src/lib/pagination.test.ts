import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clampPage, pageWindow } from './pagination.ts';

describe('paging a table', () => {
  it('shows every page when there are few', () => {
    assert.deepEqual(pageWindow(1, 1), [1]);
    assert.deepEqual(pageWindow(3, 7), [1, 2, 3, 4, 5, 6, 7]);
  });

  it('skips the middle runs around the current page', () => {
    assert.deepEqual(pageWindow(5, 10), [1, null, 4, 5, 6, null, 10]);
  });

  it('keeps five in a row near either end', () => {
    assert.deepEqual(pageWindow(1, 10), [1, 2, 3, 4, 5, null, 10]);
    assert.deepEqual(pageWindow(10, 10), [1, null, 6, 7, 8, 9, 10]);
  });

  it('pulls a page that no longer exists back into range', () => {
    assert.equal(clampPage(4, 60, 25), 3);
    assert.equal(clampPage(2, 0, 25), 1);
    assert.equal(clampPage(0, 100, 25), 1);
  });
});
