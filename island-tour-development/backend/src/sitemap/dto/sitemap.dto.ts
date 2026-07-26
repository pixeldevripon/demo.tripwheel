import { ApiProperty } from '@nestjs/swagger';

/** The indexable entity kinds a sitemap URL can point at. */
export type SitemapEntryType =
  | 'destination'
  | 'category'
  | 'hub'
  | 'collection'
  | 'tour'
  | 'page';

/**
 * One indexable, locale-LESS URL for the public site's sitemap. The frontend
 * expands each `path` across the 7 locales (adding hreflang alternates) and
 * assigns changeFrequency/priority by `type`, so this endpoint stays a pure
 * enumeration of what currently renders a 200.
 */
export class SitemapEntryDto {
  @ApiProperty({
    example: '/curacao/klein-curacao-boat-trip',
    description:
      'Locale-less canonical path with a leading slash. Destination pages are `/{dest}`; global pages (legal/policy) are `/{slug}`; everything else is `/{dest}/{slug}`.',
  })
  path!: string;

  @ApiProperty({
    example: '2026-07-20T14:12:00.000Z',
    description: 'ISO 8601 last-modified timestamp (entity updatedAt).',
  })
  lastModified!: string;

  @ApiProperty({
    example: 'tour',
    enum: ['destination', 'category', 'hub', 'collection', 'tour', 'page'],
  })
  type!: SitemapEntryType;
}
