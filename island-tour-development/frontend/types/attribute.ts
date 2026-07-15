import type { AttributeDataType, FilterDisplayType } from '@/types/enums';
export type { AttributeDataType, FilterDisplayType } from '@/types/enums';

export interface AttributeDefinition {
  id: string;
  key: string;
  displayName: string;
  dataType: AttributeDataType;
  allowedValues: string[];
  appliesToCategories: string[]; // category slugs; [] = global
  isFilterable: boolean;
  isSortable: boolean;
  filterDisplayType: FilterDisplayType | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AttributeDefinitionQuery {
  category?: string;
  globalOnly?: boolean;
  filterableOnly?: boolean;
}

export interface CreateAttributeDefinitionPayload {
  key: string;
  displayName: string;
  dataType: AttributeDataType;
  allowedValues?: string[];
  appliesToCategories?: string[];
  isFilterable?: boolean;
  isSortable?: boolean;
  filterDisplayType?: FilterDisplayType | null;
  sortOrder?: number;
}

export interface UpdateAttributeDefinitionPayload {
  displayName?: string;
  dataType?: AttributeDataType;
  allowedValues?: string[];
  appliesToCategories?: string[];
  isFilterable?: boolean;
  isSortable?: boolean;
  filterDisplayType?: FilterDisplayType | null;
  sortOrder?: number;
  isActive?: boolean;
}

// ── Per-tour attribute values ──────────────────────────────────────────────────

export interface TourAttribute {
  key: string;
  value: string; // scalar, or a JSON-array string for ENUM_MULTI
  displayName: string | null;
  dataType: AttributeDataType | null;
  /** Derived from a first-class Tour field (managed in Details). Read-only. */
  derived: boolean;
}

export interface SetTourAttributesPayload {
  attributes: { key: string; value: string }[];
}
