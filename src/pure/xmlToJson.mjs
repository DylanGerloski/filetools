/**
 * XML -> JSON shaping logic -- the shared math behind the "convert XML to
 * JSON" tool. The browser's own DOMParser (in 'application/xml' mode --
 * see ../browser/xmlToJson.client.js's header, same mode
 * ../browser/xlsxToCsv.client.js already uses) does the actual XML
 * parsing; this module only walks an already-parsed, DOM-shaped plain
 * object (see PlainXmlNode below) and turns it into a JSON value, plus
 * turns a parser's error text into a friendly message. Pure data in, pure
 * data out -- no DOMParser import, no real DOM node anywhere in this file
 * -- so every branch here is directly unit-testable in Node
 * (test/xmlToJson.test.mjs) by hand-constructing a PlainXmlNode, without
 * needing a browser or a jsdom dependency. Same pure/browser split every
 * other converter on this site uses (../pure/yamlToJson.mjs,
 * ../pure/htmlTableExtract.mjs).
 *
 * Conversion convention (documented on the tool page's own FAQ, not just
 * here, since it's a real design choice a visitor needs to know about):
 *   - An element with no attributes and no child elements becomes a plain
 *     string -- its own text content, trimmed. An empty element (or one
 *     holding only whitespace) becomes "" rather than null, so every leaf
 *     is consistently a string.
 *   - An element WITH attributes and/or child elements becomes an object.
 *     Each attribute becomes a "@name" key holding its value. Each child
 *     element becomes a key named after its own tag; a repeated tag name
 *     becomes an array, in document order. Any of the element's own text
 *     (outside its child elements) becomes a "#text" key.
 *   - Every value that came from XML text -- element text and attribute
 *     values alike -- stays a string. Nothing is auto-coerced to a number
 *     or boolean, on purpose: XML has no type system of its own, and
 *     guessing types silently breaks data a visitor didn't ask to change
 *     (a US ZIP code "00501" auto-coerced to the number 501 loses its
 *     leading zero). A stranger converting real data can trust the output
 *     matches the input exactly, which is the tool's whole pitch.
 *   - The document's root element becomes the single top-level key of the
 *     result, e.g. `<note>hi</note>` -> `{"note": "hi"}` -- not the bare
 *     value alone, so the output always names what it came from, and a
 *     document that's just one plain-text root doesn't look
 *     indistinguishable from a JSON string literal.
 *   - Comments and processing instructions carry no equivalent in JSON,
 *     so they're dropped rather than invented a slot for -- same
 *     "documented, not silent" choice ../pure/yamlToJson.mjs makes for
 *     other format-specific features JSON has no room for.
 *   - Mixed content (text interleaved between child elements, e.g.
 *     `<a>Hello <b>x</b> world</a>`) collapses that element's own text
 *     runs into a single "#text" string, losing their original position
 *     relative to the child elements. This is a real, named limitation of
 *     the attribute/text JSON convention every simple XML-to-JSON
 *     converter shares (there is no lossless JSON shape for mixed content
 *     without inventing a much more complex, order-preserving format) --
 *     documented on the tool page's FAQ rather than silently producing
 *     output that looks complete but has quietly reordered content.
 */

/**
 * @typedef {object} PlainXmlNode a DOM Element's content, already reduced
 *   to plain data by ../browser/xmlToJson.client.js's own DOM walk (never
 *   constructed from a real DOM node in this file, which is what keeps it
 *   unit-testable without a browser).
 * @property {string} tag the element's tag name, prefix included verbatim
 *   for a namespaced element (e.g. "ns:foo") -- this tool doesn't resolve
 *   or strip XML namespaces, it keeps the qualified name exactly as
 *   written, same choice ../pure/yamlToJson.mjs makes for a YAML custom
 *   tag (kept as data, not specially interpreted).
 * @property {[string,string][]} attrs the element's attributes as
 *   [name, value] pairs, in document order.
 * @property {Array<{type:'element',node:PlainXmlNode}|{type:'text',text:string}>} children
 *   the element's child nodes, comments/processing instructions already
 *   excluded by the DOM walk that built this object.
 */

const ATTR_PREFIX = '@';
const TEXT_KEY = '#text';

/**
 * Case-insensitive, deliberately broad: matches `<!DOCTYPE` anywhere in
 * the raw text, not just at the document's start, so it can't be evaded
 * by leading whitespace/a BOM/a comment placed before it. A false
 * positive (the four characters "<!DOCTYPE" appearing inside a text node
 * or attribute value rather than as a real declaration) just produces a
 * refusal with a clear reason, never a silent misparse -- an acceptable,
 * rare trade-off for closing off an entire attack class by construction
 * rather than trusting per-engine entity-resolution behavior. See
 * ../browser/xmlToJson.client.js's header for why a DOCTYPE is refused at
 * all rather than parsed and stripped.
 *
 * @param {string} text raw, not-yet-parsed XML text.
 * @returns {boolean}
 */
export function containsDoctype(text) {
  return /<!DOCTYPE/i.test(text);
}

/**
 * @param {PlainXmlNode} node
 * @returns {string|object} a plain string for a leaf (no attributes, no
 *   child elements), otherwise an object per this module's header
 *   convention.
 */
export function nodeToJsonValue(node) {
  const attrs = {};
  for (const [name, value] of node.attrs) {
    attrs[`${ATTR_PREFIX}${name}`] = value;
  }

  const elementChildren = node.children.filter((c) => c.type === 'element');
  const text = node.children
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim();

  const hasAttrs = Object.keys(attrs).length > 0;
  const hasElementChildren = elementChildren.length > 0;

  if (!hasAttrs && !hasElementChildren) {
    return text;
  }

  const out = attrs;
  for (const child of elementChildren) {
    const key = child.node.tag;
    const value = nodeToJsonValue(child.node);
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      if (!Array.isArray(out[key])) out[key] = [out[key]];
      out[key].push(value);
    } else {
      out[key] = value;
    }
  }
  if (text) out[TEXT_KEY] = text;
  return out;
}

/**
 * @param {PlainXmlNode} rootNode the document's single root element (a
 *   well-formed XML document always has exactly one).
 * @returns {object} `{ [rootTag]: <converted value> }`.
 */
export function documentToJsonValue(rootNode) {
  return { [rootNode.tag]: nodeToJsonValue(rootNode) };
}

/**
 * @param {string} rawErrorText a DOMParser `<parsererror>` element's own
 *   textContent (Chromium's format: "This page contains the following
 *   errors:\nerror on line N at column M: <reason>\nBelow is a rendering
 *   ..."). Firefox/WebKit phrase this differently; the fallback below
 *   covers any format that doesn't match the "error on line" pattern.
 * @returns {string} a one-line, plain-English message.
 */
export function formatXmlParseError(rawErrorText) {
  const raw = typeof rawErrorText === 'string' ? rawErrorText : '';
  const m = raw.match(/error on line \d+ at column \d+:\s*([^\n]+)/i);
  const detail = (m ? m[1] : raw.split('\n').find((l) => l.trim())) || '';
  const reason = detail.trim() || 'the syntax couldn’t be parsed';
  return `That isn’t valid XML - ${reason}. Check the tags and try again.`;
}
