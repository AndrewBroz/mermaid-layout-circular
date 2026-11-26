import { isMap, parseDocument, type Document } from 'yaml';

/** Reads and edits the `config` settings in a diagram's frontmatter.
 *  The playground's controls use this to write into the editor text,
 *  so the text stays the only state. Edits go through `yaml`'s
 *  Document, which keeps a visitor's comments and key order. */

/** A path under `config`, such as `['flowchart', 'curve']`. */
export type ConfigPath = readonly string[];

/** The block from a first line `---` to the next line `---`, as
 *  mermaid and Pele read it. */
const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m;

interface Parts {
  /** The YAML between the two `---` lines, or '' when there is none. */
  yaml: string;
  /** The diagram text after the block. */
  rest: string;
  eol: '\n' | '\r\n';
}

const split = (text: string): Parts => {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const match = FRONTMATTER.exec(text);
  if (!match || match.index !== 0) {
    return { yaml: '', rest: text, eol };
  }
  return { yaml: match[1] ?? '', rest: text.slice(match[0].length), eol };
};

/** The parsed frontmatter, or undefined when it isn't YAML whose top
 *  level and `config` are maps, which the controls could edit. */
const parse = (yaml: string): Document | undefined => {
  const doc = parseDocument(yaml);
  if (doc.errors.length > 0) {
    return undefined;
  }
  if (doc.contents !== null && !isMap(doc.contents)) {
    return undefined;
  }
  const config = doc.get('config', true);
  if (config !== undefined && config !== null && !isMap(config)) {
    return undefined;
  }
  return doc;
};

/** The `config` map of the text's frontmatter: `{}` when there is no
 *  frontmatter or no `config`, undefined when it doesn't parse. */
export const readConfig = (text: string): Record<string, unknown> | undefined => {
  const doc = parse(split(text).yaml);
  if (!doc) {
    return undefined;
  }
  const config: unknown = doc.toJS()?.config;
  return (config ?? {}) as Record<string, unknown>;
};

const isEmptyMap = (node: unknown): boolean => isMap(node) && node.items.length === 0;

/** Sets `config.<path>` to `value`, or deletes it when `value` is
 *  undefined. A map left empty by a delete goes too, and so does the
 *  whole block. Returns the text unchanged when the frontmatter
 *  doesn't parse. */
export const setConfig = (
  text: string,
  path: ConfigPath,
  value: string | undefined
): string => {
  const { yaml, rest, eol } = split(text);
  const doc = parse(yaml);
  if (!doc) {
    return text;
  }
  const full = ['config', ...path];
  if (value === undefined) {
    if (!doc.hasIn(full)) {
      return text;
    }
    doc.deleteIn(full);
    for (let n = full.length - 1; n > 0 && isEmptyMap(doc.getIn(full.slice(0, n))); n--) {
      doc.deleteIn(full.slice(0, n));
    }
  } else {
    doc.setIn(full, value);
  }
  if (doc.contents === null || isEmptyMap(doc.contents)) {
    return rest;
  }
  const out = doc.toString().replaceAll('\n', eol);
  return `---${eol}${out}---${eol}${rest}`;
};
