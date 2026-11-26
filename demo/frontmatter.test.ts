import { expect, test } from 'vitest';
import { readConfig, setConfig } from './frontmatter.js';

const body = 'flowchart LR\n  A --> B\n';
const fm = (yaml: string) => `---\n${yaml}---\n${body}`;

test('reads config', () => {
  expect(readConfig(fm('config:\n  layout: circular\n'))).toEqual({ layout: 'circular' });
});

test('no frontmatter reads as empty', () => {
  expect(readConfig(body)).toEqual({});
});

test('broken YAML reads as undefined and is not edited', () => {
  const text = fm('config:\n  layout: [\n');
  expect(readConfig(text)).toBeUndefined();
  expect(setConfig(text, ['layout'], 'circular')).toBe(text);
});

test('flow maps and quoted values read the same', () => {
  expect(
    readConfig(fm('config: { layout: "circular-ccw", flowchart: { curve: linear } }\n'))
  ).toEqual({ layout: 'circular-ccw', flowchart: { curve: 'linear' } });
});

test('CRLF frontmatter reads', () => {
  expect(readConfig('---\r\nconfig:\r\n  layout: circular\r\n---\r\n' + body)).toEqual({
    layout: 'circular',
  });
});

test('adds a block to text without one', () => {
  expect(setConfig(body, ['layout'], 'circular')).toBe(fm('config:\n  layout: circular\n'));
});

test('sets a nested key', () => {
  expect(setConfig(fm('config:\n  layout: circular\n'), ['flowchart', 'curve'], 'linear')).toBe(
    fm('config:\n  layout: circular\n  flowchart:\n    curve: linear\n')
  );
});

test('deleting the last key removes its map', () => {
  expect(
    setConfig(
      fm('config:\n  layout: circular\n  flowchart:\n    curve: linear\n'),
      ['flowchart', 'curve'],
      undefined
    )
  ).toBe(fm('config:\n  layout: circular\n'));
});

test('deleting the last key of all removes the block', () => {
  expect(setConfig(fm('config:\n  layout: circular\n'), ['layout'], undefined)).toBe(body);
});

test('other keys and comments stay', () => {
  const text = fm(
    'title: Water\n# the layout\nconfig:\n  layout: circular # here\n  theme: neutral\n'
  );
  const out = setConfig(text, ['look'], 'handDrawn');
  expect(out).toContain('# the layout');
  expect(out).toContain('# here');
  expect(out).toContain('title: Water');
  expect(readConfig(out)).toEqual({ layout: 'circular', theme: 'neutral', look: 'handDrawn' });
});

test('a flow map stays a flow map', () => {
  const out = setConfig(fm('config: { layout: circular }\n'), ['layout'], 'circular-ccw');
  expect(out).toBe(fm('config: { layout: circular-ccw }\n'));
});

test('deleting a missing key changes nothing', () => {
  const text = fm('config:\n  layout: circular\n');
  expect(setConfig(text, ['look'], undefined)).toBe(text);
});

test('CRLF text keeps CRLF when edited', () => {
  const text = '---\r\nconfig:\r\n  layout: circular\r\n---\r\n' + body;
  expect(setConfig(text, ['look'], 'handDrawn')).toBe(
    '---\r\nconfig:\r\n  layout: circular\r\n  look: handDrawn\r\n---\r\n' + body
  );
});

test('config that is not a map reads as undefined and is not edited', () => {
  const text = fm('config: circular\n');
  expect(readConfig(text)).toBeUndefined();
  expect(setConfig(text, ['layout'], 'circular')).toBe(text);
});
