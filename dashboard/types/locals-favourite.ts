// Editorial "Locals' favourite" curation (admin-only, MANAGE_EDITORIAL).
// Mirrors backend LocalsFavouriteStatsDto / SetLocalsFavouriteResponseDto.

export interface LocalsFavouriteDestinationStat {
  destinationId: string;
  destinationName: string;
  totalLive: number;
  flagged: number;
  pct: number;
}

export interface LocalsFavouriteStats {
  totalLive: number;
  flagged: number;
  pct: number;
  target: number;
  perDestination: LocalsFavouriteDestinationStat[];
}

export interface SetLocalsFavouriteResponse {
  id: string;
  isLocalsFavourite: boolean;
}
