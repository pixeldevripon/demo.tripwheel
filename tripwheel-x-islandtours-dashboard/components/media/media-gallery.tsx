"use client";

import {
  useDeleteMedia,
  useBulkDeleteMedia,
  mediaKeys,
  removeMediaFromCache,
} from "@/hooks/media/use-media";
import { useUploadStore } from "@/lib/stores/use-upload-store";
import { Button } from "@/components/ui/button";
import { Delete02Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import BulkActionSpinner from "./bulk-action-spinner";
import DeleteConfirmationDialog from "./delete-confirmation-dialog";
import MasonrySkeletonWithStyles from "./loading-skeleton";
import MediaGridUi from "./media-grid-ui";
import type { MediaItem } from "@/types/media";
import MediaListUi from "./media-list-ui";
import { MediaUploader } from "./media-uploader";
import MediaViewer from "./media-viewer";
import NoMediaUi from "./no-media-ui";

interface MediaGalleryProps {
  searchTerm?: string;
  viewMode?: "grid" | "list";
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  selectMode?: boolean;
  bulkSelectedItems?: MediaItem[];
  setbulkSelectedItems: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  mediaItems: MediaItem[];
  /** Total item count on the server (may exceed loaded items). */
  totalCount?: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  selector?: boolean;
  handleInserToForm?: () => void;
  currentSelection?: MediaItem[];
  multiple?: boolean;
  maxFiles?: number;
  /** Called after upload - parent inserts items into TQ cache */
  onUploadSuccess: (items: MediaItem[]) => void;
  /**
   * Notifies the parent when the single-item viewer opens/closes so it can
   * hide the chrome above the gallery (search controls) while viewing.
   */
  onViewerOpenChange?: (open: boolean) => void;
}

export default function MediaGallery({
  searchTerm = "",
  viewMode = "grid",
  isFormOpen,
  setIsFormOpen,
  selectMode,
  bulkSelectedItems = [],
  setbulkSelectedItems,
  mediaItems,
  totalCount,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  loading,
  selector,
  handleInserToForm,
  currentSelection,
  multiple,
  maxFiles,
  onUploadSuccess,
  onViewerOpenChange,
}: MediaGalleryProps) {
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [isShowConfirm, setIsShowConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  // Let the parent hide the search-controls bar while the viewer is open
  // (the viewer replaces the page content, not just the grid).
  useEffect(() => {
    onViewerOpenChange?.(selectedItem !== null);
  }, [selectedItem, onViewerOpenChange]);

  // Upload state comes from Zustand - persists across tab switches
  const { uploadingFiles } = useUploadStore();

  // TanStack Query delete mutations
  const deleteMutation = useDeleteMedia();
  const bulkDeleteMutation = useBulkDeleteMedia();
  const isDeleting = deleteMutation.isPending || bulkDeleteMutation.isPending;

  // Infinite scroll only in selector mode (fixed-height dialog). The full
  // media page has no inner scroll container - paging is via the Load more
  // button so the page grows naturally.
  useEffect(() => {
    if (!selector) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasNextPage || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, onLoadMore, selector]);

  const filteredItems = useMemo(() => {
    if (!mediaItems?.length) return [];
    if (!searchTerm?.trim()) return mediaItems;
    const lower = searchTerm.toLowerCase();
    return mediaItems.filter(
      (item) =>
        item?.originalName?.toLowerCase().includes(lower) ||
        item?.fileName?.toLowerCase().includes(lower) ||
        item?.publicId?.toLowerCase().includes(lower),
    );
  }, [mediaItems, searchTerm]);

  /* ─── Selection ─────────────────────────────────────────────────── */
  const handleItemSelection = (selected: MediaItem) => {
    if (!selected) return;
    if (selector) {
      if (!multiple) {
        setbulkSelectedItems([selected]);
        return;
      }
      const current = bulkSelectedItems ?? currentSelection ?? [];
      const isAlready = current.some(
        (i) => i.id === selected.id || i.url === selected.url,
      );
      if (isAlready) {
        setbulkSelectedItems((prev) =>
          prev.filter((i) => i.id !== selected.id && i.url !== selected.url),
        );
      } else {
        if (current.length >= (maxFiles ?? Infinity)) {
          toast.warning(`Maximum ${maxFiles} images allowed`);
          return;
        }
        setbulkSelectedItems((prev) => [...prev, selected]);
      }
    } else {
      setbulkSelectedItems((prev) => {
        const isAlready = prev.some((i) => i.id === selected.id);
        return isAlready
          ? prev.filter((i) => i.id !== selected.id)
          : [...prev, selected];
      });
    }
  };

  const handleItemClick = (item: MediaItem) => {
    if (selectMode) {
      handleItemSelection(item);
    } else if (!selector) {
      setSelectedItem(item);
    }
  };

  /* ─── Delete - optimistic update + server confirm ───────────────── */
  const handleDeleteItem = (id: string) => {
    setIsShowConfirm(true);
    setItemToDelete(id);
  };

  const handleBulkDelete = () => {
    if (bulkSelectedItems.length === 0) return;
    setIsShowConfirm(true);
    setItemToDelete("bulk");
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const currentId = itemToDelete;
    setIsShowConfirm(false);

    if (currentId === "bulk") {
      const ids = bulkSelectedItems.map((i) => i.id);
      // Optimistic: remove from cache immediately
      removeMediaFromCache(queryClient, ids);
      setbulkSelectedItems([]);
      bulkDeleteMutation.mutate(ids, {
        onError: () => {
          // Rollback: invalidate so fresh data loads
          queryClient.invalidateQueries({ queryKey: mediaKeys.all });
        },
      });
    } else {
      // Optimistic: remove from cache immediately
      removeMediaFromCache(queryClient, [currentId]);
      setItemToDelete(null);
      deleteMutation.mutate(currentId, {
        onError: () => {
          queryClient.invalidateQueries({ queryKey: mediaKeys.all });
        },
      });
    }
  };

  const handleCopyUrl = async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.url);
      toast.success("Copied");
    } catch {}
  };

  /* ─── Loading ───────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="border rounded-lg shadow">
        <div className="min-h-[60vh] mx-auto flex justify-center items-center p-6">
          <MasonrySkeletonWithStyles />
        </div>
      </div>
    );
  }

  if (selectedItem) {
    const viewerIndex = filteredItems.findIndex(
      (i) => i.id === selectedItem.id,
    );
    // Read the item fresh from the cache-backed list so metadata saves
    // flow straight back into the open viewer (selectedItem is a
    // snapshot from click time).
    const viewerItem =
      viewerIndex >= 0 ? filteredItems[viewerIndex] : selectedItem;
    return (
      <MediaViewer
        item={viewerItem}
        onClose={() => setSelectedItem(null)}
        onPrev={
          viewerIndex > 0
            ? () => setSelectedItem(filteredItems[viewerIndex - 1])
            : undefined
        }
        onNext={
          viewerIndex >= 0 && viewerIndex < filteredItems.length - 1
            ? () => setSelectedItem(filteredItems[viewerIndex + 1])
            : undefined
        }
        onDelete={() => {
          const id = selectedItem.id;
          setSelectedItem(null);
          handleDeleteItem(id);
        }}
      />
    );
  }

  return (
    <>
      {/* Bulk-select action bar */}
      {!selector && selectMode && (
        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
          <div className="flex items-center space-x-4">
            <h4 className="text-sm font-medium text-foreground">
              {bulkSelectedItems.length} item
              {bulkSelectedItems.length !== 1 ? "s" : ""} selected
            </h4>
            {bulkSelectedItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setbulkSelectedItems([])}
                disabled={isDeleting}
                className="text-primary border-border hover:bg-accent"
              >
                Clear Selection
              </Button>
            )}
          </div>
          {bulkSelectedItems.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center"
            >
              {isDeleting ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="h-4 w-4 mr-2 animate-spin"
                  />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    size={16}
                    className="mr-2"
                  />
                  Delete Selected ({bulkSelectedItems.length})
                </>
              )}
            </Button>
          )}
        </div>
      )}

      <div
        className={`border border-border rounded-lg shadow-sm relative ${
          // In the dialog this has to shrink with the dialog, so it joins the
          // flex column instead of sizing itself.
          selector ? "flex min-h-0 flex-1 flex-col" : ""
        }`}
      >
        {/* Selector dialog scrolls internally (fixed-height modal);
                    the media page grows with its content and scrolls with the
                    document - no inner scrollbar.

            The selector branch used to be `min-h-[60vh] max-h-[70/75vh]`, which
            measured the VIEWPORT while the dialog is `h-[92dvh]` minus a header,
            padding and a toolbar that WRAPS as the window narrows. Nothing kept
            those in step, so `min-h-[60vh]` could force the panel taller than the
            space it had and the parent's `overflow-hidden` cropped the bottom -
            worse the narrower the window got, because the wrapping toolbar ate
            more of the budget. `flex-1 min-h-0` takes exactly the room that is
            left instead of guessing at it. */}
        <div
          className={
            selector
              // NO `mx-auto` here. As a flex item, auto side margins absorb the
              // free space, so the box shrink-wraps its content and centres -
              // which collapsed the grid to a single narrow column. It is a
              // harmless no-op on the block-layout branch below, and a layout
              // bug here.
              ? "min-h-0 w-full flex-1 overflow-y-auto p-6"
              : "min-h-[60vh] mx-auto p-6"
          }
        >
          {itemToDelete === "bulk" && isDeleting ? (
            <BulkActionSpinner
              bulkSelectedItems={bulkSelectedItems.length}
              title="Deleting Media Files"
              state="Deleting"
            />
          ) : !filteredItems?.length && !uploadingFiles.length ? (
            <NoMediaUi
              searchTerm={searchTerm}
              setIsFormOpen={setIsFormOpen}
              isDeleting={isDeleting}
            />
          ) : viewMode === "list" ? (
            <MediaListUi
              filteredItems={filteredItems}
              bulkSelectedItems={bulkSelectedItems}
              isDeleting={isDeleting}
              itemToDelete={itemToDelete}
              handleItemSelection={handleItemSelection}
              handleEditItem={(item) => setSelectedItem(item)}
              handleItemClick={handleItemClick}
              handleDeleteItem={handleDeleteItem}
              selectMode={selectMode}
            />
          ) : (
            <MediaGridUi
              filteredItems={filteredItems}
              bulkSelectedItems={bulkSelectedItems}
              isDeleting={isDeleting}
              itemToDelete={itemToDelete}
              handleItemSelection={handleItemSelection}
              handleEditItem={(item) => setSelectedItem(item)}
              handleItemClick={handleItemClick}
              handleDeleteItem={handleDeleteItem}
              selectMode={selectMode}
              handleCopyUrl={handleCopyUrl}
              selector={selector}
            />
          )}

          {/* Infinite-scroll sentinel + progress line. Also shown when a
                        search over the loaded subset comes up empty but more pages
                        exist on the server, so deeper items remain reachable. */}
          {(filteredItems.length > 0 || hasNextPage) && (
            <div
              ref={loadMoreRef}
              className="flex flex-col items-center gap-2 py-6"
            >
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-sm text-content-muted">
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                  />
                  Loading more...
                </div>
              ) : hasNextPage ? (
                <Button variant="outline" size="sm" onClick={onLoadMore}>
                  Load more
                </Button>
              ) : null}
              {typeof totalCount === "number" && !searchTerm && (
                <p className="text-xs text-content-subtle">
                  Showing {mediaItems.length} of {totalCount} items
                </p>
              )}
            </div>
          )}
        </div>

        {/* Hidden uploader - triggered by Upload button in toolbar */}
        <MediaUploader
          folder="users/media"
          multiple
          maxFiles={maxFiles || 50}
          selector={selector}
          setbulkSelectedItems={setbulkSelectedItems}
          setIsFormOpen={setIsFormOpen}
          isFormOpen={isFormOpen}
          bulkSelectedItems={bulkSelectedItems}
          onUploadSuccess={onUploadSuccess}
        />

        {/* Selector insert bar */}
        {selector && bulkSelectedItems.length > 0 && (
          <div className="p-3">
            <hr className="outline-0 border-t border-primary/30" />
            <div className="flex justify-end mt-2 items-center gap-4">
              <h5 className="font-normal text-sm">Selected {bulkSelectedItems.length} items</h5>
              <Button onClick={handleInserToForm} size="lg" className="rounded">
                Insert
              </Button>
            </div>
          </div>
        )}
      </div>

      {isShowConfirm && (
        <DeleteConfirmationDialog
          open={isShowConfirm}
          setOpen={setIsShowConfirm}
          handleDeleteCancel={() => setIsShowConfirm(false)}
          handleDeleteConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}
