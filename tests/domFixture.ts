// Minimal zero-dependency HTML DOM shim for Node unit tests of store adapters.
// ponytail: supports tag, #id, .class, [attr="val"] and simple combinations (tag#id, tag.class, tag[attr="val"]); upgrade to linkedom if complex combinators are added.

interface FakeEl {
  tag: string;
  attrs: Record<string, string>;
  textContent: string;
  getAttribute(name: string): string | null;
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    attrs[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? '';
  }
  return attrs;
}

function parseElements(html: string): FakeEl[] {
  const els: FakeEl[] = [];
  const voidRe = /<(meta)\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = voidRe.exec(html)) !== null) {
    const attrs = parseAttrs(m[2] ?? '');
    els.push({
      tag: m[1]!.toLowerCase(),
      attrs,
      textContent: '',
      getAttribute: (name) => attrs[name.toLowerCase()] ?? null,
    });
  }

  const pairRe = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = pairRe.exec(html)) !== null) {
    const tag = m[1]!.toLowerCase();
    const attrs = parseAttrs(m[2] ?? '');
    const rawInner = m[3] ?? '';
    const inner = tag === 'script' ? rawInner : rawInner.replace(/<[^>]+>/g, ' ');
    els.push({
      tag,
      attrs,
      textContent: inner,
      getAttribute: (name) => attrs[name.toLowerCase()] ?? null,
    });
    if (tag !== 'script' && rawInner.includes('<')) {
      els.push(...parseElements(rawInner));
    }
  }
  return els;
}

function matchesSelector(el: FakeEl, selector: string): boolean {
  const sel = selector.trim();
  const attrMatch = sel.match(/^([a-zA-Z0-9*]*)\[([a-zA-Z0-9_-]+)="([^"]*)"]$/);
  if (attrMatch) {
    const [, tag, attr, val] = attrMatch;
    if (tag && tag !== '*' && el.tag !== tag.toLowerCase()) return false;
    return el.getAttribute(attr!) === val;
  }
  const idMatch = sel.match(/^([a-zA-Z0-9]*)#([a-zA-Z0-9_-]+)$/);
  if (idMatch) {
    const [, tag, id] = idMatch;
    if (tag && el.tag !== tag.toLowerCase()) return false;
    return el.getAttribute('id') === id;
  }
  const clsMatch = sel.match(/^([a-zA-Z0-9]*)\.([a-zA-Z0-9_-]+)$/);
  if (clsMatch) {
    const [, tag, cls] = clsMatch;
    if (tag && el.tag !== tag.toLowerCase()) return false;
    return (el.getAttribute('class') ?? '').split(/\s+/).includes(cls!);
  }
  return el.tag === sel.toLowerCase();
}

export function createDocumentFromHtml(html: string): Document {
  const elements = parseElements(html);
  return {
    querySelector(selector: string) {
      return elements.find((el) => matchesSelector(el, selector)) ?? null;
    },
    querySelectorAll(selector: string) {
      return elements.filter((el) => matchesSelector(el, selector));
    },
  } as unknown as Document;
}
