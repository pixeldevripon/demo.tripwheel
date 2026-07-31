"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GridIcon, Menu05Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ALL_LOCALES, LOCALE_LABELS } from "@/lib/constants/locales";
import type { Locale } from "@/types/locale";
import type {
  MediaItem,
  MediaSort,
  MediaSortBy,
  MediaSortOrder,
  MediaTypeFilter,
} from "@/types/media";

// Type-filter + sort dropdowns are intentionally HIDDEN (not removed) - flip
// this to true to bring them back. The state/props wiring stays live so the
// gallery keeps its default sort (newest first) and 'all' type filter.
const SHOW_FILTER_CONTROLS = false;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "uploadedAt-desc", label: "Newest first" },
  { value: "uploadedAt-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "size-desc", label: "Largest first" },
  { value: "size-asc", label: "Smallest first" },
  { value: "type-asc", label: "Type" },
];

const TYPE_OPTIONS: { value: MediaTypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "svg", label: "SVG" },
];

interface MediaSearchControlsProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  setIsFormOpen: (open: boolean) => void;
  setSelectMode: (mode: boolean) => void;
  selectMode: boolean;
  handleBulkSelection: (action: "all" | "clear") => void;
  handleCancelSelection: () => void;
  mediaItems: MediaItem[];
  bulkSelectedItems?: MediaItem[];
  selector?: boolean;
  loading?: boolean;
  sort?: MediaSort;
  setSort?: (sort: MediaSort) => void;
  typeFilter?: MediaTypeFilter;
  setTypeFilter?: (type: MediaTypeFilter) => void;
  /**
   * Locale whose missing alt text to filter down to, or 'none' for no filter.
   * This is the media library's stand-in for a Translation Console view: the
   * console is a matrix over every entity of a type, which cannot enumerate a
   * library of thousands of assets.
   */
  untranslated?: Locale | 'none';
  setUntranslated?: (locale: Locale | 'none') => void;
}

const MediaSearchControls = ({
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
  setIsFormOpen,
  setSelectMode,
  selectMode,
  handleBulkSelection,
  handleCancelSelection,
  mediaItems,
  bulkSelectedItems = [],
  selector,
  loading,
  sort,
  setSort,
  typeFilter = "all",
  setTypeFilter,
  untranslated = "none",
  setUntranslated,
}: MediaSearchControlsProps) => {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 md:gap-4">
      {/* Search - full row on mobile, capped beside the controls on
                desktop */}
      <div className="relative w-full md:w-auto md:flex-1 md:max-w-md">
        <HugeiconsIcon
          icon={Search01Icon}
          size={16}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Search media..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-9 rounded-md border border-input !bg-background pl-8 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Type filter */}
      {SHOW_FILTER_CONTROLS && setTypeFilter && (
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as MediaTypeFilter)}
        >
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Missing-translation worklist. Only offers the six non-English locales:
          English lives on the asset itself, so "untranslated English" is not a
          state that exists.

          HIDDEN behind the same flag as the type and sort dropdowns (founder
          call 2026-07-31, after seeing it in place). The state, the query key and
          the backend `?untranslated=` filter all stay live, so flipping
          SHOW_FILTER_CONTROLS brings all three back with no rewiring. Until
          then, the per-asset locale pills in the media viewer are how you see
          what is translated. */}
      {SHOW_FILTER_CONTROLS && setUntranslated && (
        <Select
          value={untranslated}
          onValueChange={(v) => setUntranslated(v as Locale | 'none')}
        >
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Any language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Any language</SelectItem>
            {ALL_LOCALES.filter((l) => l !== 'en').map((l) => (
              <SelectItem key={l} value={l}>
                Needs {LOCALE_LABELS[l]} alt
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Sort */}
      {SHOW_FILTER_CONTROLS && sort && setSort && (
        <Select
          value={`${sort.sortBy}-${sort.sortOrder}`}
          onValueChange={(v) => {
            const [sortBy, sortOrder] = v.split("-") as [
              MediaSortBy,
              MediaSortOrder,
            ];
            setSort({ sortBy, sortOrder });
          }}
        >
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* View & Selection controls - hidden in selector mode */}
      {!selector && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
            title="Grid View"
          >
            <HugeiconsIcon icon={GridIcon} size={16} />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
            title="List View"
          >
            <HugeiconsIcon icon={Menu05Icon} size={16} />
          </Button>

          {!selectMode && (
            <Button
              variant="outline"
              onClick={() => setSelectMode(true)}
              className="flex items-center py-2 px-4 md:py-4 md:px-12"
            >
              Bulk Select
            </Button>
          )}

          {selectMode && bulkSelectedItems.length < mediaItems.length && (
            <Button
              variant="outline"
              onClick={() => handleBulkSelection("all")}
              className="flex items-center py-2 px-4 md:py-4 md:px-12"
            >
              Select All
            </Button>
          )}

          {!loading &&
            selectMode &&
            mediaItems.length === bulkSelectedItems.length && (
              <Button
                variant="outline"
                onClick={() => handleBulkSelection("clear")}
                className="flex items-center py-2 px-4 md:py-4 md:px-12"
              >
                Unselect All
              </Button>
            )}

          {selectMode && (
            <Button
              onClick={() => {
                setSelectMode(false);
                handleCancelSelection();
              }}
              className="flex items-center py-2 px-4 md:py-4 md:px-12"
            >
              Cancel
            </Button>
          )}
        </div>
      )}

      {/* Upload button - pushed to the row's right edge */}
      <Button onClick={() => setIsFormOpen(true)} className="ml-auto shrink-0">
        Upload Media
      </Button>
    </div>
  );
};

export default MediaSearchControls;
