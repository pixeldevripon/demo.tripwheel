'use client';

/**
 * WYSIWYG editor for Pages bodies (TipTap v3) - full tool parity with the
 * wattup simple-editor template, adapted:
 *
 *   - Toolbar composes the dashboard's OWN shadcn kit (Button, DropdownMenu,
 *     Popover, Tooltip) instead of the template's parallel
 *     `tiptap-ui-primitive` kit, whose SCSS overrode shadcn `:root` tokens
 *     app-wide and broke dark mode. Nothing styles outside `.it-page-editor`.
 *   - TABLE support is wired (the template shipped the packages unused).
 *   - IMAGES go through the media library (MediaSelector), not the template's
 *     ad-hoc `/api/upload-image` drop zone - the standing rule is that every
 *     media field uses the library.
 *   - The content area renders under `.it-page-prose` on a white surface, the
 *     value-inlined mirror of the public site's page typography, so the
 *     editor IS the live preview of the published page (in both dashboard
 *     themes - the public page is always light).
 *
 * Tool set (wattup parity): undo/redo, headings H1-H4, bullet/ordered/task
 * lists, blockquote, code block, bold/italic/strike/inline-code/underline,
 * multicolor highlight, link, superscript/subscript, text align, image,
 * tables, divider. The backend sanitizer's allowlist
 * (`page-html.util.ts`) is kept in lockstep with this vocabulary - anything
 * the toolbar can produce survives the save.
 *
 * Controlled HTML-string component (`value` / `onChange(getHTML())`); RHF
 * integration wraps it via Controller in page-form.
 */
import MediaSelector from '@/components/common/media-selector';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { PAGE_HIGHLIGHT_COLORS } from '@/lib/page-highlight-colors';
import type { MediaItem } from '@/types/media';
import {
    CheckListIcon,
    CodeIcon,
    CodeSquareIcon,
    ColumnDeleteIcon,
    ColumnInsertIcon,
    Delete02Icon,
    HighlighterIcon,
    Image01Icon,
    LeftToRightListBulletIcon,
    LeftToRightListNumberIcon,
    Link01Icon,
    MinusSignIcon,
    QuoteDownIcon,
    RedoIcon,
    RowDeleteIcon,
    RowInsertIcon,
    Table01Icon,
    TextAlignCenterIcon,
    TextAlignJustifyCenterIcon,
    TextAlignLeftIcon,
    TextAlignRightIcon,
    TextBoldIcon,
    TextItalicIcon,
    TextStrikethroughIcon,
    TextUnderlineIcon,
    UndoIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import {
    Table,
    TableCell,
    TableHeader,
    TableRow,
} from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState, type ReactNode } from 'react';
import { ResizableImage } from './resizable-image';

import './rich-text-editor.css';

interface RichTextEditorProps {
    /** HTML string (the stored, sanitized body). */
    value: string;
    /** Fires with `editor.getHTML()` on every document change. */
    onChange: (html: string) => void;
}

/** Only the schemes the backend sanitizer lets through. */
function isAllowedHref(href: string): boolean {
    return /^(https?:\/\/|mailto:)/i.test(href);
}

function ToolbarButton({
    label,
    onClick,
    active = false,
    disabled = false,
    children,
}: {
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type='button'
                    variant={active ? 'secondary' : 'ghost'}
                    size='icon'
                    className='size-8'
                    disabled={disabled}
                    onClick={onClick}
                    aria-label={label}
                    aria-pressed={active}>
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
    const editor = useEditor({
        // App Router SSR: render the editor only on the client.
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
                link: { openOnClick: false, defaultProtocol: 'https' },
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Highlight.configure({ multicolor: true }),
            Superscript,
            Subscript,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            ResizableImage,
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value,
        onUpdate: ({ editor: e }) => onChange(e.getHTML()),
        editorProps: {
            // The prose class is what makes the content area render exactly like
            // the published page.
            attributes: { class: 'it-page-prose' },
        },
    });

    // External value change (form reset, record loaded) -> resync the document.
    // Guarded so the editor's own onUpdate echo never loops.
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '', { emitUpdate: false });
        }
    }, [editor, value]);

    // Reactive toolbar state - one selector, re-renders only when these flip.
    const state = useEditorState({
        editor,
        selector: ({ editor: e }) =>
            e
                ? {
                      bold: e.isActive('bold'),
                      italic: e.isActive('italic'),
                      underline: e.isActive('underline'),
                      strike: e.isActive('strike'),
                      code: e.isActive('code'),
                      codeBlock: e.isActive('codeBlock'),
                      highlight: e.isActive('highlight'),
                      superscript: e.isActive('superscript'),
                      subscript: e.isActive('subscript'),
                      h1: e.isActive('heading', { level: 1 }),
                      h2: e.isActive('heading', { level: 2 }),
                      h3: e.isActive('heading', { level: 3 }),
                      h4: e.isActive('heading', { level: 4 }),
                      bulletList: e.isActive('bulletList'),
                      orderedList: e.isActive('orderedList'),
                      taskList: e.isActive('taskList'),
                      blockquote: e.isActive('blockquote'),
                      link: e.isActive('link'),
                      inTable: e.isActive('table'),
                      alignLeft: e.isActive({ textAlign: 'left' }),
                      alignCenter: e.isActive({ textAlign: 'center' }),
                      alignRight: e.isActive({ textAlign: 'right' }),
                      alignJustify: e.isActive({ textAlign: 'justify' }),
                      canUndo: e.can().undo(),
                      canRedo: e.can().redo(),
                      linkHref: (e.getAttributes('link').href as string) ?? '',
                  }
                : null,
    });

    const [linkOpen, setLinkOpen] = useState(false);
    const [linkDraft, setLinkDraft] = useState('');
    const [imageOpen, setImageOpen] = useState(false);

    if (!editor || !state) {
        return (
            <div className='it-page-editor'>
                <div className='it-page-editor-content'>
                    <div className='text-sm text-muted-foreground'>
                        Loading editor…
                    </div>
                </div>
            </div>
        );
    }

    const blockLabel = state.h1
        ? 'Heading 1'
        : state.h2
          ? 'Heading 2'
          : state.h3
            ? 'Heading 3'
            : state.h4
              ? 'Heading 4'
              : 'Paragraph';

    const applyLink = () => {
        const href = linkDraft.trim();
        if (!href) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else if (isAllowedHref(href)) {
            editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href })
                .run();
        }
        setLinkOpen(false);
    };

    const insertImage = (items: MediaItem[]) => {
        const item = items[0];
        if (!item?.url) return;
        editor
            .chain()
            .focus()
            .setImage({
                src: item.url,
                alt: item.altText || item.originalName || item.fileName || '',
            })
            .run();
    };

    return (
        <div className='it-page-editor'>
            <div className='it-page-editor-toolbar'>
                <ToolbarButton
                    label='Undo'
                    disabled={!state.canUndo}
                    onClick={() => editor.chain().focus().undo().run()}>
                    <HugeiconsIcon icon={UndoIcon} />
                </ToolbarButton>
                <ToolbarButton
                    label='Redo'
                    disabled={!state.canRedo}
                    onClick={() => editor.chain().focus().redo().run()}>
                    <HugeiconsIcon icon={RedoIcon} />
                </ToolbarButton>

                <Separator orientation='vertical' className='mx-1 h-6' />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='h-8 min-w-28 justify-start'>
                            {blockLabel}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='start'>
                        <DropdownMenuItem
                            onClick={() =>
                                editor.chain().focus().setParagraph().run()
                            }>
                            Paragraph
                        </DropdownMenuItem>
                        {([1, 2, 3, 4] as const).map(level => (
                            <DropdownMenuItem
                                key={level}
                                onClick={() =>
                                    editor
                                        .chain()
                                        .focus()
                                        .toggleHeading({ level })
                                        .run()
                                }>
                                Heading {level}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Separator orientation='vertical' className='mx-1 h-6' />

                <ToolbarButton
                    label='Bullet list'
                    active={state.bulletList}
                    onClick={() =>
                        editor.chain().focus().toggleBulletList().run()
                    }>
                    <HugeiconsIcon icon={LeftToRightListBulletIcon} />
                </ToolbarButton>
                <ToolbarButton
                    label='Numbered list'
                    active={state.orderedList}
                    onClick={() =>
                        editor.chain().focus().toggleOrderedList().run()
                    }>
                    <HugeiconsIcon icon={LeftToRightListNumberIcon} />
                </ToolbarButton>
                <ToolbarButton
                    label='Task list'
                    active={state.taskList}
                    onClick={() =>
                        editor.chain().focus().toggleTaskList().run()
                    }>
                    <HugeiconsIcon icon={CheckListIcon} />
                </ToolbarButton>
                <ToolbarButton
                    label='Blockquote'
                    active={state.blockquote}
                    onClick={() =>
                        editor.chain().focus().toggleBlockquote().run()
                    }>
                    <HugeiconsIcon icon={QuoteDownIcon} />
                </ToolbarButton>
                <ToolbarButton
                    label='Code block'
                    active={state.codeBlock}
                    onClick={() =>
                        editor.chain().focus().toggleCodeBlock().run()
                    }>
                    <HugeiconsIcon icon={CodeSquareIcon} />
                </ToolbarButton>

                <Separator orientation='vertical' className='mx-1 h-6' />

                <ToolbarButton
                    label='Bold'
                    active={state.bold}
                    onClick={() => editor.chain().focus().toggleBold().run()}>
                    <HugeiconsIcon icon={TextBoldIcon} />
                </ToolbarButton>
                <ToolbarButton
                    label='Italic'
                    active={state.italic}
                    onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <HugeiconsIcon icon={TextItalicIcon} />
                </ToolbarButton>
                <ToolbarButton
                    label='Strikethrough'
                    active={state.strike}
                    onClick={() => editor.chain().focus().toggleStrike().run()}>
                    <HugeiconsIcon icon={TextStrikethroughIcon} />
                </ToolbarButton>
                <ToolbarButton
                    label='Inline code'
                    active={state.code}
                    onClick={() => editor.chain().focus().toggleCode().run()}>
                    <HugeiconsIcon icon={CodeIcon} />
                </ToolbarButton>
                <ToolbarButton
                    label='Underline'
                    active={state.underline}
                    onClick={() =>
                        editor.chain().focus().toggleUnderline().run()
                    }>
                    <HugeiconsIcon icon={TextUnderlineIcon} />
                </ToolbarButton>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type='button'
                            variant={state.highlight ? 'secondary' : 'ghost'}
                            size='icon'
                            className='size-8'
                            aria-label='Highlight'>
                            <HugeiconsIcon icon={HighlighterIcon} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className='w-auto p-2' align='start'>
                        <div className='flex items-center gap-1.5'>
                            {PAGE_HIGHLIGHT_COLORS.map(c => (
                                <Tooltip key={c.key}>
                                    <TooltipTrigger asChild>
                                        <button
                                            type='button'
                                            aria-label={`Highlight ${c.name}`}
                                            className={`size-6 rounded-full border border-black/10 it-page-swatch-${c.key}`}
                                            onClick={() =>
                                                editor
                                                    .chain()
                                                    .focus()
                                                    .toggleHighlight({
                                                        color: c.value,
                                                    })
                                                    .run()
                                            }
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent>{c.name}</TooltipContent>
                                </Tooltip>
                            ))}
                            <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                className='h-6 px-2 text-xs'
                                disabled={!state.highlight}
                                onClick={() =>
                                    editor
                                        .chain()
                                        .focus()
                                        .unsetHighlight()
                                        .run()
                                }>
                                None
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

                <Popover
                    open={linkOpen}
                    onOpenChange={open => {
                        setLinkOpen(open);
                        if (open) setLinkDraft(state.linkHref);
                    }}>
                    <PopoverTrigger asChild>
                        <Button
                            type='button'
                            variant={state.link ? 'secondary' : 'ghost'}
                            size='icon'
                            className='size-8'
                            aria-label='Link'>
                            <HugeiconsIcon icon={Link01Icon} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className='w-80' align='start'>
                        <div className='flex flex-col gap-2'>
                            <Input
                                value={linkDraft}
                                onChange={e => setLinkDraft(e.target.value)}
                                placeholder='https://… or mailto:…'
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        applyLink();
                                    }
                                }}
                            />
                            {linkDraft.trim() &&
                                !isAllowedHref(linkDraft.trim()) && (
                                    <p className='text-xs text-destructive'>
                                        Links must start with https://, http://
                                        or mailto:
                                    </p>
                                )}
                            <div className='flex items-center justify-between'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    disabled={!state.link}
                                    onClick={() => {
                                        editor
                                            .chain()
                                            .focus()
                                            .extendMarkRange('link')
                                            .unsetLink()
                                            .run();
                                        setLinkOpen(false);
                                    }}>
                                    Remove
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    disabled={
                                        !!linkDraft.trim() &&
                                        !isAllowedHref(linkDraft.trim())
                                    }
                                    onClick={applyLink}>
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                <ToolbarButton
                    label='Superscript'
                    active={state.superscript}
                    onClick={() =>
                        editor.chain().focus().toggleSuperscript().run()
                    }>
                    <span className='text-xs font-medium leading-none'>
                        x<sup>2</sup>
                    </span>
                </ToolbarButton>
                <ToolbarButton
                    label='Subscript'
                    active={state.subscript}
                    onClick={() =>
                        editor.chain().focus().toggleSubscript().run()
                    }>
                    <span className='text-xs font-medium leading-none'>
                        x<sub>2</sub>
                    </span>
                </ToolbarButton>

                <Separator orientation='vertical' className='mx-1 h-6' />

                {(
                    [
                        {
                            dir: 'left',
                            active: state.alignLeft,
                            icon: TextAlignLeftIcon,
                        },
                        {
                            dir: 'center',
                            active: state.alignCenter,
                            icon: TextAlignCenterIcon,
                        },
                        {
                            dir: 'right',
                            active: state.alignRight,
                            icon: TextAlignRightIcon,
                        },
                        {
                            dir: 'justify',
                            active: state.alignJustify,
                            icon: TextAlignJustifyCenterIcon,
                        },
                    ] as const
                ).map(({ dir, active, icon }) => (
                    <ToolbarButton
                        key={dir}
                        label={dir === 'justify' ? 'Justify' : `Align ${dir}`}
                        active={active}
                        onClick={() =>
                            active
                                ? editor.chain().focus().unsetTextAlign().run()
                                : editor.chain().focus().setTextAlign(dir).run()
                        }>
                        <HugeiconsIcon icon={icon} />
                    </ToolbarButton>
                ))}

                <Separator orientation='vertical' className='mx-1 h-6' />

                <ToolbarButton
                    label='Insert image'
                    onClick={() => setImageOpen(true)}>
                    <HugeiconsIcon icon={Image01Icon} />
                </ToolbarButton>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type='button'
                            variant={state.inTable ? 'secondary' : 'ghost'}
                            size='icon'
                            className='size-8'
                            aria-label='Table'>
                            <HugeiconsIcon icon={Table01Icon} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='start'>
                        <DropdownMenuItem
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .insertTable({
                                        rows: 3,
                                        cols: 3,
                                        withHeaderRow: true,
                                    })
                                    .run()
                            }>
                            <HugeiconsIcon icon={Table01Icon} /> Insert table
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            disabled={!state.inTable}
                            onClick={() =>
                                editor.chain().focus().addRowAfter().run()
                            }>
                            <HugeiconsIcon icon={RowInsertIcon} /> Add row below
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={!state.inTable}
                            onClick={() =>
                                editor.chain().focus().deleteRow().run()
                            }>
                            <HugeiconsIcon icon={RowDeleteIcon} /> Delete row
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={!state.inTable}
                            onClick={() =>
                                editor.chain().focus().addColumnAfter().run()
                            }>
                            <HugeiconsIcon icon={ColumnInsertIcon} /> Add column
                            right
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={!state.inTable}
                            onClick={() =>
                                editor.chain().focus().deleteColumn().run()
                            }>
                            <HugeiconsIcon icon={ColumnDeleteIcon} /> Delete
                            column
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={!state.inTable}
                            onClick={() =>
                                editor.chain().focus().toggleHeaderRow().run()
                            }>
                            Toggle header row
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant='destructive'
                            disabled={!state.inTable}
                            onClick={() =>
                                editor.chain().focus().deleteTable().run()
                            }>
                            <HugeiconsIcon icon={Delete02Icon} /> Delete table
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <ToolbarButton
                    label='Divider'
                    onClick={() =>
                        editor.chain().focus().setHorizontalRule().run()
                    }>
                    <HugeiconsIcon icon={MinusSignIcon} />
                </ToolbarButton>
            </div>

            <div className='it-page-editor-content'>
                <EditorContent editor={editor} />
            </div>

            {/* Media-library picker for image insertion (single image, image kind). */}
            <MediaSelector
                open={imageOpen}
                onOpenChange={setImageOpen}
                onMediaSelect={insertImage}
                kind='image'
            />
        </div>
    );
}

