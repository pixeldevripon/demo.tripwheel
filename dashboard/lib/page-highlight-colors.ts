/**
 * Highlight swatches for the Pages rich-text editor.
 *
 * These are DOCUMENT DATA, not theme styling: the chosen value is written
 * into the stored HTML as `<mark style="background-color: …">` and rendered
 * verbatim on the public site, so they live outside the component (the
 * dashboard bans color literals in components) and outside the theme (a
 * dashboard re-theme must not change published page content). The backend
 * sanitizer allows exactly this shape; the swatch preview classes live in
 * components/pages/rich-text-editor.css keyed by `key`.
 */
export const PAGE_HIGHLIGHT_COLORS = [
  { key: 'yellow', name: 'Yellow', value: '#fef08a' },
  { key: 'green', name: 'Green', value: '#bbf7d0' },
  { key: 'blue', name: 'Blue', value: '#bfdbfe' },
  { key: 'pink', name: 'Pink', value: '#fbcfe8' },
  { key: 'orange', name: 'Orange', value: '#fed7aa' },
  { key: 'purple', name: 'Purple', value: '#e9d5ff' },
] as const;
