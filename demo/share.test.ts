import { expect, test } from 'vitest';
import { readHash, writeHash } from './share.js';

test('an example round-trips', () => {
  expect(readHash(writeHash({ example: 'hub' }))).toEqual({ example: 'hub' });
});

test('non-ASCII text round-trips', () => {
  const text = 'flowchart LR\n  A[Évaporation 🌧️] --> B[凝結]\n';
  expect(readHash(writeHash({ text }))).toEqual({ text });
});

test('the text hash is URL-safe', () => {
  expect(writeHash({ text: '>>>???' })).toMatch(/^#text=[A-Za-z0-9_-]*$/);
});

test.each(['', '#', '#text=%%%', '#text=@@', '#text=_w', '#nothing=1', '#example='])(
  'broken hash %j reads as undefined',
  (hash) => {
    expect(readHash(hash)).toBeUndefined();
  }
);
