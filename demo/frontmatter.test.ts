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

test('turning the last setting off keeps a comment above it', () => {
  const out = setConfig(fm('# my diagram\n\nconfig:\n  layout: circular\n'), ['layout'], undefined);
  expect(out).toContain('# my diagram');
  expect(out.endsWith(body)).toBe(true);
  expect(readConfig(out)).toEqual({});
});

test('turning the last setting off keeps a comment after it', () => {
  const out = setConfig(fm('config:\n  layout: circular\n# end\n'), ['layout'], undefined);
  expect(out).toContain('# end');
  expect(readConfig(out)).toEqual({});
});

test('a comment above a removed map stays', () => {
  const out = setConfig(fm('title: T\n# settings\nconfig:\n  layout: circular\n'), ['layout'], undefined);
  expect(out).toContain('# settings');
  expect(out).toContain('title: T');
  expect(readConfig(out)).toEqual({});
});

test('a comment inside a removed map stays', () => {
  const text = fm('config:\n  flowchart:\n    curve: linear\n    # straight\n  layout: circular\n');
  const out = setConfig(text, ['flowchart', 'curve'], undefined);
  expect(out).toContain('# straight');
  expect(readConfig(out)).toEqual({ layout: 'circular' });
});

test('an empty config reads as no settings', () => {
  expect(readConfig(fm('config:\n'))).toEqual({});
  expect(readConfig(setConfig(fm('config:\n'), ['layout'], 'circular'))).toEqual({
    layout: 'circular',
  });
});

test.each(['flowchart:\n', 'flowchart: basis\n'])(
  'setting a key under %j replaces it with a map',
  (flowchart) => {
    const text = fm(`config:\n  layout: circular\n  ${flowchart}`);
    expect(readConfig(setConfig(text, ['flowchart', 'curve'], 'linear'))).toEqual({
      layout: 'circular',
      flowchart: { curve: 'linear' },
    });
  }
);

test('deleting under a scalar changes nothing', () => {
  const text = fm('config:\n  flowchart: basis\n');
  expect(setConfig(text, ['flowchart', 'curve'], undefined)).toBe(text);
});
