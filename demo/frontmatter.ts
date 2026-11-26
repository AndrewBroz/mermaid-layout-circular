import { isMap, isNode, isScalar, parseDocument, YAMLMap, type Document } from 'yaml';

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

/** A node with nothing in it, such as `config:` with no lines below. */
const isNull = (node: unknown): boolean => isScalar(node) && node.value === null;

/** The parsed frontmatter, or undefined when it isn't YAML whose top
 *  level and `config` are maps, which the controls could edit. An
 *  empty `config:` counts as no settings. */
const parse = (yaml: string): Document | undefined => {
  const doc = parseDocument(yaml);
  if (doc.errors.length > 0) {
    return undefined;
  }
  if (doc.contents !== null && !isMap(doc.contents)) {
    return undefined;
  }
  const config = doc.get('config', true);
  if (config !== undefined && !isNull(config) && !isMap(config)) {
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

/** Comments joined in order, or undefined when there are none. */
const joinComments = (...comments: (string | null | undefined)[]): string | undefined =>
  comments.filter(Boolean).join('\n') || undefined;

/** Removes `key` from `map`. The comments written on their own lines
 *  above it, or inside a map it held, move to the next key, or to the
 *  end of `map`. A comment at the end of the removed line goes with it. */
const removeKey = (map: YAMLMap, key: string) => {
  const i = map.items.findIndex((pair) => isScalar(pair.key) && pair.key.value === key);
  const [pair] = map.items.splice(i, 1);
  if (!pair) {
    return;
  }
  const value = isMap(pair.value) ? pair.value : undefined;
  const kept = joinComments(
    isNode(pair.key) ? pair.key.commentBefore : undefined,
    value?.commentBefore,
    value?.comment
  );
  const next = map.items[i]?.key;
  if (isNode(next)) {
    next.commentBefore = joinComments(kept, next.commentBefore);
  } else {
    map.comment = joinComments(map.comment, kept);
  }
};

/** The YAML for frontmatter with no settings left but comments. */
const commentsOnly = (doc: Document): string =>
  [doc.commentBefore, doc.comment]
    .filter(Boolean)
    .map((comment) => comment!.replace(/^/gm, '#'))
    .join('\n\n') + '\n';

/** Sets `config.<path>` to `value`, or deletes it when `value` is
 *  undefined. Setting replaces an empty or plain value on the way with
 *  a map. A map left empty by a delete goes too, and so does the whole
 *  block, unless it holds comments. Returns the text unchanged when
 *  the frontmatter doesn't parse. */
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
    // The maps from the top level down to the one that holds the key.
    const maps = full.map((_, n) => (n === 0 ? doc.contents : doc.getIn(full.slice(0, n), true)));
    for (let n = full.length - 1; n >= 0; n--) {
      removeKey(maps[n] as YAMLMap, full[n]!);
      if (n > 0 && !isEmptyMap(maps[n])) {
        break;
      }
    }
  } else {
    for (let n = 1; n < full.length; n++) {
      if (!isMap(doc.getIn(full.slice(0, n), true))) {
        doc.setIn(full.slice(0, n), new YAMLMap());
      }
    }
    doc.setIn(full, value);
  }
  let out: string;
  if (doc.contents === null || isEmptyMap(doc.contents)) {
    const top = doc.contents as YAMLMap | null;
    doc.comment = joinComments(top?.commentBefore, top?.comment, doc.comment) ?? null;
    if (!doc.commentBefore && !doc.comment) {
      return rest;
    }
    out = commentsOnly(doc);
  } else {
    out = doc.toString();
  }
  return `---${eol}${out.replaceAll('\n', eol)}---${eol}${rest}`;
};
