'use client';

/**
 * Media-library image node with drag-to-resize.
 *
 * Extends the stock TipTap Image with a `width` attribute and a React
 * NodeView that shows a corner handle while the image is selected. Dragging
 * writes `width` (px) onto the node, so the stored HTML is a plain
 * `<img src width="640">` - exactly what the backend sanitizer allows and
 * what the public `.it-page-prose img { max-width: 100% }` rule caps, so a
 * width can never overflow the page column.
 */
import { Image as TiptapImage } from '@tiptap/extension-image';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import { useRef } from 'react';

const MIN_WIDTH = 80;

function ResizableImageView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  const startResize = (event: React.PointerEvent) => {
    event.preventDefault();
    const img = imgRef.current;
    if (!img) return;

    const startX = event.clientX;
    const startWidth = img.getBoundingClientRect().width;
    // The prose column is the natural maximum - the public page caps there
    // anyway (max-width: 100%), so the editor should not pretend otherwise.
    const maxWidth = img.parentElement?.parentElement
      ? img.parentElement.parentElement.getBoundingClientRect().width
      : Number.POSITIVE_INFINITY;

    const onMove = (e: PointerEvent) => {
      const next = Math.round(
        Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + (e.clientX - startX))),
      );
      updateAttributes({ width: next });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <NodeViewWrapper
      className={`it-page-image-node${selected ? ' is-selected' : ''}`}
      data-drag-handle
    >
      {/* The real <img> - width flows from the node attribute. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) ?? ''}
        width={(node.attrs.width as number) ?? undefined}
        draggable={false}
      />
      {selected && (
        <span
          role="presentation"
          className="it-page-image-handle"
          onPointerDown={startResize}
        />
      )}
    </NodeViewWrapper>
  );
}

/** Image extension with a persisted `width` attribute + resize NodeView. */
export const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width');
          return width ? Number.parseInt(width, 10) : null;
        },
        renderHTML: (attributes) =>
          attributes.width ? { width: attributes.width as number } : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
