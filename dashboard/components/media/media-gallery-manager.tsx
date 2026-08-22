"use client";

import { useMediaInfinite, prependMediaToCache } from "@/hooks/media/use-media";
import { useUploadStore } from "@/lib/stores/use-upload-store";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import MediaGallery from "./media-gallery";
import type { Locale } from "@/types/locale";
import type { MediaItem, MediaSort, MediaTypeFilter } from "@/types/media";
import { DEFAULT_MEDIA_SORT } from "@/types/media";
import MediaSearchControls from "./media-search-controls";

interface MediaGalleryManagerProps {
  selector?: boolean;
  onMediaSelect?: (items: MediaItem[]) => void;
  currentSelection?: MediaItem[];
  multiple?: boolean;
  maxFiles?: number;
  /**
   * Restrict the picker to one asset kind. Seeds the type filter and locks it,
   * so a field that can only accept a video never shows images to choose from.
   * Omit for the full library (the /media page).
   */
  kind?: MediaTypeFilter;
}

/** Noun used in selector toasts, so a video picker never says "image". */
const KIND_NOUN: Record<MediaTypeFilter, { one: string; many: string }> = {
  all: { one: 'file', many: 'files' },
  image: { one: 'image', many: 'images' },
  video: { one: 'video', many: 'videos' },
  audio: { one: 'audio file', many: 'audio files' },
  svg: { one: 'SVG', many: 'SVGs' },
};

const MediaGalleryManager = ({
  selector = false,
  onMediaSelect,
  currentSelection,
  multiple,
  maxFiles,
  kind,
}: MediaGalleryManagerProps) => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectMode, setSelectMode] = useState(false);
  const [bulkSelectedItems, setBulkSelectedItems] = useState<MediaItem[]>([]);
  const [sort, setSort] = useState<MediaSort>(DEFAULT_MEDIA_SORT);
  // A kind-restricted picker starts (and stays) on that kind - see the locked
  // control in MediaSearchControls.
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>(kind ?? "all");
  // "Which assets still need alt text in <locale>" - the worklist the
  // Translation Console cannot provide at this scale. 'none' = no filter.
  const [untranslated, setUntranslated] = useState<Locale | "none">("none");
  // While the single-item viewer is open the gallery IS the page - hide the
  // search-controls bar so nothing sits above (or scrolls behind) it.
  const [viewerOpen, setViewerOpen] = useState(false);

  // ── TanStack Query - pages through the whole library ────────────────────
  // refetchOnWindowFocus: true (set in QueryClient defaults + hook) means
  // the gallery automatically refreshes when the user returns to this tab.
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMediaInfinite(sort, typeFilter, untranslated);
  // Dedupe across pages: offset pagination overlaps when uploads/deletes
  // shift rows between fetches (the last item of server-page 1 slides onto
  // page 2), which would produce duplicate React keys in the grid.
  const mediaItems = useMemo(() => {
    const all = data?.pages.flatMap((page) => page.data) ?? [];
    const seen = new Set<string>();
    return all.filter((item) =>
      seen.has(item.id) ? false : (seen.add(item.id), true),
    );
  }, [data]);
  const totalCount = data?.pages[0]?.total ?? mediaItems.length;

  const isUploading = useUploadStore((s) => s.uploadingFiles.length > 0);

  // Sync external selection (selector mode)
  useEffect(() => {
    setBulkSelectedItems(currentSelection || []);
  }, [currentSelection]);

  /* ── Handle newly uploaded files ─────────────────────────────────── */
  function handleUploadSuccess(newItems: MediaItem[]) {
    // Insert directly into TanStack Query cache - no extra network round-trip
    prependMediaToCache(queryClient, newItems);
  }

  /* ── Insert selected items into parent form ──────────────────────── */
  function handleInsertToForm() {
    const noun = KIND_NOUN[kind ?? 'image'];
    if (bulkSelectedItems.length === 0) {
      toast.warning(`Please select at least one ${noun.one}`);
      return;
    }
    if (!multiple && bulkSelectedItems.length > 1) {
      toast.warning(`Only one ${noun.one} can be selected`);
      return;
    }
    if (multiple && maxFiles && bulkSelectedItems.length > maxFiles) {
      toast.warning(`Maximum ${maxFiles} ${noun.many} allowed`);
      return;
    }
    onMediaSelect?.(bulkSelectedItems);
  }

  /* ── Bulk selection helpers ──────────────────────────────────────── */
  function handleBulkSelection(action: "all" | "clear") {
    if (action === "clear") {
      setBulkSelectedItems([]);
    } else {
      const lower = searchTerm.toLowerCase();
      const filtered = searchTerm
        ? mediaItems.filter(
            (item) =>
              item?.originalName?.toLowerCase().includes(lower) ||
              item?.fileName?.toLowerCase().includes(lower),
          )
        : mediaItems;
      setBulkSelectedItems(filtered);
    }
  }

  function handleCancelSelection() {
    setBulkSelectedItems([]);
    setSelectMode(false);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {!viewerOpen && (
        <div className="mt-2 shrink-0">
          <MediaSearchControls
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            viewMode={viewMode}
            setViewMode={setViewMode}
            setIsFormOpen={setIsFormOpen}
            setSelectMode={setSelectMode}
            selectMode={selectMode}
            handleBulkSelection={handleBulkSelection}
            handleCancelSelection={handleCancelSelection}
            mediaItems={mediaItems}
            bulkSelectedItems={bulkSelectedItems}
            selector={selector}
            loading={isLoading}
            sort={sort}
            setSort={setSort}
            typeFilter={typeFilter}
            // Omitting the setter hides the type dropdown entirely, which is
            // how a kind-restricted picker stays restricted - the field asked
            // for a video, so offering "All types" would only invite a
            // selection the field cannot accept.
            setTypeFilter={kind ? undefined : setTypeFilter}
            untranslated={untranslated}
            // Hidden in a picker: someone choosing an image for a field is not
            // working through a translation backlog.
            setUntranslated={selector ? undefined : setUntranslated}
          />
        </div>
      )}

      <MediaGallery
        onViewerOpenChange={setViewerOpen}
        searchTerm={searchTerm}
        viewMode={viewMode}
        isFormOpen={isFormOpen}
        setIsFormOpen={setIsFormOpen}
        selectMode={selectMode}
        bulkSelectedItems={bulkSelectedItems}
        setbulkSelectedItems={setBulkSelectedItems}
        mediaItems={mediaItems}
        totalCount={totalCount}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        loading={isLoading && !isUploading}
        selector={selector}
        handleInserToForm={handleInsertToForm}
        currentSelection={currentSelection}
        multiple={multiple}
        maxFiles={maxFiles}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
};

export default MediaGalleryManager;
