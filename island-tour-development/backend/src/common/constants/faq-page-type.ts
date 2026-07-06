import { FaqPageType } from '@prisma/client';

// Named accessors for the FaqPageType enum members (the polymorphic discriminator
// on the shared Faq table). Values come straight from the Prisma enum so they can
// never drift from the schema.
export const FAQ_PAGE_TYPE = {
  DESTINATION: FaqPageType.destination,
  CATEGORY: FaqPageType.category,
  HUB: FaqPageType.hub,
  TOUR: FaqPageType.tour,
  COLLECTION: FaqPageType.collection,
} as const;

export type { FaqPageType };
