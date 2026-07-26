import sanitizeHtml from 'sanitize-html';

/**
 * Write-path sanitizer for Page bodies (pages.service).
 *
 * The stored body is rendered by the public site with
 * `dangerouslySetInnerHTML` — server-side, unsanitized — so THIS is the single
 * gate between admin input and every visitor's browser. Sanitizing on write
 * (not read) keeps the public render SEO-visible with no client sanitizer and
 * no empty first paint, and means the column can be trusted everywhere.
 *
 * The allowlist is exactly the vocabulary the dashboard TipTap editor can
 * produce and the `.it-page-prose` stylesheet styles: headings, paragraphs,
 * lists (incl. task lists), marks (bold/italic/underline/strike/inline code/
 * highlight/sup/sub), links, blockquote, hr, code blocks, tables and
 * media-library images. Keep the three in lockstep — editor toolbar,
 * this allowlist, prose CSS. Anything else — scripts, styles, event
 * handlers, iframes — is dropped, not escaped.
 */
const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'blockquote',
  'hr',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  // Inline code + code blocks.
  'code',
  'pre',
  // Highlight (multicolor), superscript, subscript.
  'mark',
  'sup',
  'sub',
  // Media-library images.
  'img',
  // Task-list plumbing: TipTap renders
  // <li data-type="taskItem"><label><input type=checkbox><span></span></label><div><p>…
  'label',
  'input',
  'span',
  'div',
];

/** Only the alignments the editor's TextAlign extension can set. */
const TEXT_ALIGN = [/^(left|right|center|justify)$/];

/** Hex / rgb(a) colors only — what the highlight swatches emit. */
const CSS_COLOR = [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([0-9,.\s%]+\)$/];

export function sanitizePageHtml(html: string): string {
  return sanitizeHtml(html, {
    // NO presentational wrappers survive: a disallowed tag is unwrapped with
    // its children kept (the legacy `<div class="overflow-x-auto">` scrollers
    // dissolve to bare tables; the public renderer re-wraps every table at
    // render time). `div` IS allowed — attribute-less — because TipTap task
    // items carry their text inside one.
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      ul: ['data-type'],
      li: ['data-type', 'data-checked'],
      input: ['type', 'checked', 'disabled'],
      mark: ['data-color', 'style'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
    },
    // `style` is allowlisted per-property, never free-form: text alignment on
    // blocks (the TextAlign extension) and the highlight color on <mark>.
    allowedStyles: {
      p: { 'text-align': TEXT_ALIGN },
      h1: { 'text-align': TEXT_ALIGN },
      h2: { 'text-align': TEXT_ALIGN },
      h3: { 'text-align': TEXT_ALIGN },
      h4: { 'text-align': TEXT_ALIGN },
      mark: { 'background-color': CSS_COLOR },
    },
    // http(s) + mailto only — no javascript:, data:, etc. Images are https
    // only (they come from the media library / Cloudinary).
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
    // An image whose src was stripped (disallowed scheme) must not survive as
    // an empty <img> - it would render as a blank placeholder box.
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
    transformTags: {
      // Force safe rel on links that open a new tab.
      a: (tagName, attribs) => ({
        tagName,
        attribs:
          attribs.target === '_blank'
            ? { ...attribs, rel: 'noopener noreferrer' }
            : attribs,
      }),
      // The only <input> in the vocabulary is a task-list checkbox, and on
      // the public page it is content, not a control: force the type and
      // render it disabled.
      input: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...(attribs.checked !== undefined && { checked: attribs.checked }),
          type: 'checkbox',
          disabled: 'disabled',
        },
      }),
    },
  }).trim();
}
