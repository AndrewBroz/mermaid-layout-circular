/** The playground's link: the URL hash names an example, or holds the
 *  visitor's own text once they edit it. */
export type Shared = { example: string } | { text: string };

/** UTF-8, then base64url without padding, so any text fits a URL. */
const encode = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

/** The inverse of encode. Throws on text that isn't base64url of UTF-8. */
const decode = (value: string): string => {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new Error('not base64url');
  }
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

/** The hash for a shared example or text, with its `#`. */
export const writeHash = (shared: Shared): string =>
  'example' in shared
    ? `#example=${encodeURIComponent(shared.example)}`
    : `#text=${encode(shared.text)}`;

/** What a hash shares, or undefined for an empty or broken hash. */
export const readHash = (hash: string): Shared | undefined => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const example = params.get('example');
  if (example) {
    return { example };
  }
  const text = params.get('text');
  if (text) {
    try {
      return { text: decode(text) };
    } catch {
      return undefined;
    }
  }
  return undefined;
};
