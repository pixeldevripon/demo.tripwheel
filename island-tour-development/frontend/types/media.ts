export interface MediaItem {
  id: string;
  url: string;
  publicId: string;
  resourceType: string;
  uploadedAt: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  fileName?: string;
  altText?: string;
  caption?: string;
  originalName?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  size?: number;
  format?: string;
}

export interface MediaListResponse {
  data: MediaItem[];
  total: number;
  page: number;
  limit: number;
}
