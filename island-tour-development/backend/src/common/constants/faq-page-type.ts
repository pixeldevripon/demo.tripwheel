export const FAQ_PAGE_TYPE = {
  DESTINATION: 'destination',
  CATEGORY: 'category',
  HUB: 'hub',
  TOUR: 'tour',
  COLLECTION: 'collection',
} as const;

export type FaqPageType = (typeof FAQ_PAGE_TYPE)[keyof typeof FAQ_PAGE_TYPE];
