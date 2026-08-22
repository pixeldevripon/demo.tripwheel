'use client';

import { html } from '@codemirror/lang-html';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The code editor for a vendor snippet (Settings > Scripts).
 *
 * CodeMirror 6 with GitHub's own light/dark themes, following the dashboard's
 * `next-themes` setting. HTML mode, because a snippet is markup wrapping
 * JavaScript - `<script>` bodies get JS highlighting from the HTML mode's nested
 * parser, which a plain JS mode would not give for the tags around it.
 *
 * A snippet is code an admin PASTES rather than writes, so the editor is tuned
 * for reading what landed: line numbers to match a vendor's "line 3" support
 * reply, bracket matching to spot the unclosed tag the backend will reject, and
 * no autocomplete or auto-close-brackets, both of which corrupt pasted code by
 * inserting characters the vendor did not send.
 */

/**
 * Height, scaled to the viewport rather than fixed.
 *
 * A pasted snippet is 5 to 40 lines, and the useful thing is seeing all of it at
 * once - on a 1080p screen a fixed 220px wasted most of the dialog. `clamp`
 * gives the editor 42% of the viewport height, with a floor that still shows
 * ~10 lines on a short laptop and a ceiling so it never becomes the only thing
 * on a very tall monitor.
 *
 * `height` (not `minHeight`): with a fixed height a long snippet scrolls INSIDE
 * the editor. With min-height it would instead grow the dialog past the screen.
 *
 * KEEP IN STEP with the skeleton's `h-[...]` class below - they must be the same
 * value or the layout jumps when CodeMirror mounts. Tailwind arbitrary values
 * cannot contain spaces, hence the unspaced `clamp()` there.
 */
const EDITOR_HEIGHT = 'clamp(200px, 42vh, 560px)';

export function ScriptEditor({
  label,
  value,
  onChange,
  error,
  invalid,
  description,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Message rendered under the editor, with the invalid border. */
  error?: string;
  /**
   * Invalid border WITHOUT a message - for when the reason is rendered
   * elsewhere (Custom Scripts puts the server's verdict in a `SaveError` block
   * below, and repeating it here would say the same thing twice).
   */
  invalid?: boolean;
  description?: string;
  disabled?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  // CodeMirror renders a real DOM editor, so the server pass and the first
  // client pass cannot agree. Rendering a skeleton until mount keeps hydration
  // clean AND avoids flashing the light theme at a dark-mode admin, because
  // `resolvedTheme` is undefined until then.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const editor = mounted ? (
    <div
      className={`overflow-hidden rounded-md border ${
        error || invalid ? 'border-destructive' : 'border-line'
      }`}
      // The wrapper owns the border so CodeMirror's own focus ring does not
      // fight the dashboard's field styling.
      data-slot="script-editor"
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        editable={!disabled}
        theme={resolvedTheme === 'dark' ? githubDark : githubLight}
        extensions={[
          html({
            // `autoCloseTags` DEFAULTS TO TRUE, and it edits your code: typing
            // `<script>` silently appends `</script>`. That is the same class of
            // corruption `closeBrackets` and `autocompletion` are switched off
            // for below - a snippet has to survive byte for byte or the vendor
            // cannot support it. Turning the other three off and leaving this
            // one on would have quietly defeated the whole intent.
            autoCloseTags: false,
            // Off by default, and vendor snippets are full of `<meta ... />`.
            // With it off that `/` parses as a stray attribute, so the tag
            // highlights wrong and the fold/bracket matching goes with it.
            selfClosingTags: true,
          }),
        ]}
        height={EDITOR_HEIGHT}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
          bracketMatching: true,
          // OFF on purpose: both of these EDIT what you paste. Auto-closing
          // brackets turns a pasted `<script>` into `<script>>`, and
          // autocompletion fires on a vendor's minified code.
          closeBrackets: false,
          autocompletion: false,
          // Left ON (the default). It registers `defaultHighlightStyle` with
          // `fallback: true`, which means it only applies where the GitHub
          // theme has no rule - so it never overrides the theme's colours, and
          // it keeps anything the theme misses from rendering as plain text.
          syntaxHighlighting: true,
        }}
      />
    </div>
  ) : (
    // Same clamp as EDITOR_HEIGHT above - a skeleton of a different height
    // makes the dialog jump the moment CodeMirror mounts.
    <Skeleton className="h-[clamp(200px,42vh,560px)] w-full rounded-md" />
  );

  if (!label && !description && !error) return editor;

  return (
    <Field>
      {label && <Label>{label}</Label>}
      {editor}
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
