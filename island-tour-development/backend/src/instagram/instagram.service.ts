import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InstagramLayout,
  InstagramMediaType,
  InstagramSource,
  type Prisma,
} from '@prisma/client';
import {
  CreateInstagramPostDto,
  InstagramAccountResponseDto,
  InstagramPostResponseDto,
  PublicInstagramFeedResponseDto,
  PublicInstagramPostDto,
  ReorderInstagramPostsDto,
  UpdateInstagramAccountDto,
  UpdateInstagramPostDto,
} from './dto/instagram.dto';

const ACCOUNT_ID = 'default';

/**
 * How many tiles each layout asks for when the caller does not say. The curated
 * band is a 2 x 3 Figma grid. The gallery is five columns on desktop and three
 * on phones, so 15 is the smallest count that fills the last row at BOTH widths
 * (3 rows of 5, 5 rows of 3) - and a ragged final row reads as a half-loaded
 * page in a layout whose job is to look like a solid wall. Keep this in step
 * with the column counts in `instagram-gallery.tsx`.
 */
const DEFAULT_LIMIT_BY_LAYOUT: Record<InstagramLayout, number> = {
  [InstagramLayout.GRID]: 6,
  [InstagramLayout.GALLERY]: 15,
};

/** Caption-derived alt text past this reads as noise in a screen reader. */
const MAX_DERIVED_ALT = 120;

const POST_SELECT = {
  id: true,
  source: true,
  mediaType: true,
  permalink: true,
  imageUrl: true,
  imagePublicId: true,
  videoUrl: true,
  caption: true,
  altText: true,
  width: true,
  height: true,
  displayOrder: true,
  isActive: true,
  isPinned: true,
  destinationId: true,
  postedAt: true,
  syncedAt: true,
  destination: { select: { name: true } },
} satisfies Prisma.InstagramPostSelect;

type PostRow = Prisma.InstagramPostGetPayload<{ select: typeof POST_SELECT }>;

/**
 * The brand Instagram grid (master 3.9), rendered first-party.
 *
 * Phase 1 serves admin-curated tiles: an image from the media library plus the
 * permalink it links out to. Phase 2 will add API-synced rows alongside them
 * (`source = API`) without changing this service's public contract - which is
 * why `getPublicFeed` never assumes a row knows anything Instagram-specific
 * beyond its permalink.
 */
@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public read ─────────────────────────────────────────────────────────────

  /**
   * Everything the grid renders, in one call.
   *
   * `enabled` folds together the admin kill switch and "there is nothing to
   * show", because both mean the same thing to the frontend: render no section
   * at all. A handle row above an empty grid is worse than no section.
   *
   * @param destinationSlug pass on a destination page to also pick up tiles
   *        pinned to it; omit for brand-wide tiles only.
   */
  async getPublicFeed(
    destinationSlug?: string,
    limit?: number,
  ): Promise<PublicInstagramFeedResponseDto> {
    const [siteInfo, account] = await Promise.all([
      this.prisma.siteInfo.findFirst({
        where: { id: 'default' },
        select: { enableInstagram: true },
      }),
      this.prisma.instagramAccount.findUnique({
        where: { id: ACCOUNT_ID },
        select: { username: true, profileUrl: true, layout: true },
      }),
    ]);

    const username = account?.username?.trim() || null;
    const profileUrl = resolveProfileUrl(account?.profileUrl, username);
    const layout = account?.layout ?? InstagramLayout.GRID;

    if (!siteInfo?.enableInstagram) {
      return { enabled: false, username, profileUrl, layout, posts: [] };
    }

    // An inactive destination must not widen the feed: fall back to brand-wide
    // rather than resolving a pinned set for an island that is switched off.
    const pinned = destinationSlug
      ? await this.prisma.destination.findUnique({
          where: { slug: destinationSlug },
          select: { id: true, isActive: true },
        })
      : null;

    const rows = await this.prisma.instagramPost.findMany({
      where: {
        isActive: true,
        ...(pinned?.isActive
          ? { OR: [{ destinationId: null }, { destinationId: pinned.id }] }
          : { destinationId: null }),
      },
      select: {
        id: true,
        mediaType: true,
        permalink: true,
        imageUrl: true,
        videoUrl: true,
        caption: true,
        altText: true,
        isPinned: true,
        width: true,
        height: true,
      },
      // Curated order wins. postedAt only breaks ties, so an API sync drops
      // newest-first inside a display slot without disturbing manual curation;
      // nulls last keeps manual rows from jumping ahead of dated ones.
      orderBy: [
        { displayOrder: 'asc' },
        { postedAt: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
      // The layout decides how many tiles read as complete when the caller
      // does not ask for a count.
      take: limit ?? DEFAULT_LIMIT_BY_LAYOUT[layout],
    });

    const posts: PublicInstagramPostDto[] = rows.map((row) => ({
      id: row.id,
      // Always the still. On a video tile it is the poster the grid paints
      // first (and all a reduced-motion visitor ever sees).
      imageUrl: row.imageUrl,
      videoUrl: row.videoUrl,
      href: row.permalink?.trim() || profileUrl || INSTAGRAM_HOME,
      alt: resolveAlt(row.altText, row.caption),
      mediaType: row.mediaType,
      isPinned: row.isPinned,
      width: row.width,
      height: row.height,
    }));

    return {
      enabled: posts.length > 0,
      username,
      profileUrl,
      layout,
      posts,
    };
  }

  // ── Account (admin) ─────────────────────────────────────────────────────────

  async getAccount(): Promise<InstagramAccountResponseDto> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: ACCOUNT_ID },
      select: { id: true, username: true, profileUrl: true, layout: true },
    });

    // Read-only endpoint: never upsert on GET, just describe the empty state.
    return {
      id: ACCOUNT_ID,
      username: account?.username || null,
      profileUrl: account?.profileUrl || null,
      layout: account?.layout ?? InstagramLayout.GRID,
    };
  }

  async updateAccount(
    dto: UpdateInstagramAccountDto,
    adminId: string,
  ): Promise<InstagramAccountResponseDto> {
    const data = {
      ...(dto.username !== undefined && {
        username: normalizeHandle(dto.username),
      }),
      ...(dto.profileUrl !== undefined && {
        profileUrl: dto.profileUrl.trim(),
      }),
      ...(dto.layout !== undefined && { layout: dto.layout }),
    };

    const account = await this.prisma.instagramAccount.upsert({
      where: { id: ACCOUNT_ID },
      update: data,
      create: { id: ACCOUNT_ID, ...data },
      select: { id: true, username: true, profileUrl: true, layout: true },
    });

    this.logger.log(`Admin ${adminId} updated the Instagram account settings`);
    return {
      id: account.id,
      username: account.username || null,
      profileUrl: account.profileUrl || null,
      layout: account.layout,
    };
  }

  // ── Posts (admin) ───────────────────────────────────────────────────────────

  /** Every tile, active or not, in curation order. */
  async listPosts(): Promise<InstagramPostResponseDto[]> {
    const rows = await this.prisma.instagramPost.findMany({
      select: POST_SELECT,
      orderBy: [
        { displayOrder: 'asc' },
        { postedAt: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
    });
    return rows.map(toPostResponse);
  }

  async createPost(
    dto: CreateInstagramPostDto,
    adminId: string,
  ): Promise<InstagramPostResponseDto> {
    if (dto.destinationId)
      await this.assertDestinationExists(dto.destinationId);

    // New tiles land at the end of the grid rather than silently sharing slot 0
    // with an existing one, which would make the order depend on the id tiebreak.
    const last = await this.prisma.instagramPost.findFirst({
      select: { displayOrder: true },
      orderBy: { displayOrder: 'desc' },
    });

    const videoUrl = dto.videoUrl?.trim() || null;

    const row = await this.prisma.instagramPost.create({
      data: {
        source: InstagramSource.MANUAL,
        mediaType: resolveMediaType(videoUrl, dto.mediaType),
        imageUrl: dto.imageUrl.trim(),
        videoUrl,
        imagePublicId: dto.imagePublicId?.trim() || null,
        permalink: dto.permalink?.trim() || '',
        caption: dto.caption?.trim() || null,
        altText: dto.altText?.trim() || null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        destinationId: dto.destinationId ?? null,
        isActive: dto.isActive ?? true,
        isPinned: dto.isPinned ?? false,
        displayOrder: (last?.displayOrder ?? -1) + 1,
      },
      select: POST_SELECT,
    });

    this.logger.log(`Admin ${adminId} added Instagram tile ${row.id}`);
    return toPostResponse(row);
  }

  async updatePost(
    id: string,
    dto: UpdateInstagramPostDto,
    adminId: string,
  ): Promise<InstagramPostResponseDto> {
    const existing = await this.findPostOrThrow(id);
    if (dto.destinationId)
      await this.assertDestinationExists(dto.destinationId);

    // An API-synced row's photo and caption belong to the sync job: editing them
    // here would be silently reverted on the next run. Curation fields (order,
    // visibility, pinning, alt text) stay editable on every row, which is the
    // whole point of keeping synced tiles in the same table.
    if (existing.source === InstagramSource.API) {
      const ownedBySync: (keyof UpdateInstagramPostDto)[] = [
        'imageUrl',
        'imagePublicId',
        'videoUrl',
        'permalink',
        'caption',
        'width',
        'height',
      ];
      const attempted = ownedBySync.filter((key) => dto[key] !== undefined);
      if (attempted.length) {
        throw new BadRequestException(
          `Synced tiles own these fields - the next sync would overwrite your edit: ${attempted.join(', ')}`,
        );
      }
    }

    // Attaching or clearing the video flips what kind of tile this is, so
    // mediaType is recomputed here rather than trusted from the client. Left
    // alone when neither the video nor the badge is part of the patch (a
    // visibility toggle must not retype the tile), and never touched on a
    // synced row.
    const videoUrl =
      dto.videoUrl === undefined ? undefined : dto.videoUrl?.trim() || null;
    const mediaType =
      videoUrl === undefined && dto.mediaType === undefined
        ? undefined
        : resolveMediaType(
            videoUrl === undefined ? existing.videoUrl : videoUrl,
            dto.mediaType,
          );

    const row = await this.prisma.instagramPost.update({
      where: { id },
      data: {
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl.trim() }),
        ...(dto.imagePublicId !== undefined && {
          imagePublicId: dto.imagePublicId.trim() || null,
        }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(mediaType !== undefined && { mediaType }),
        ...(dto.permalink !== undefined && {
          permalink: dto.permalink.trim(),
        }),
        ...(dto.caption !== undefined && {
          caption: dto.caption.trim() || null,
        }),
        ...(dto.altText !== undefined && {
          altText: dto.altText.trim() || null,
        }),
        ...(dto.width !== undefined && { width: dto.width }),
        ...(dto.height !== undefined && { height: dto.height }),
        ...(dto.destinationId !== undefined && {
          destinationId: dto.destinationId,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
      },
      select: POST_SELECT,
    });

    this.logger.log(`Admin ${adminId} updated Instagram tile ${id}`);
    return toPostResponse(row);
  }

  async removePost(id: string, adminId: string): Promise<{ message: string }> {
    await this.findPostOrThrow(id);
    await this.prisma.instagramPost.delete({ where: { id } });

    this.logger.log(`Admin ${adminId} removed Instagram tile ${id}`);
    return { message: 'Instagram tile removed' };
  }

  /**
   * Persist a drag-and-drop reorder. One transaction, so a half-applied order
   * can never leave two tiles fighting over the same slot.
   */
  async reorderPosts(
    dto: ReorderInstagramPostsDto,
    adminId: string,
  ): Promise<InstagramPostResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate tile id in the reorder payload');
    }

    const found = await this.prisma.instagramPost.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException(
        'Reorder payload references a tile that no longer exists',
      );
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.instagramPost.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );

    this.logger.log(`Admin ${adminId} reordered ${ids.length} Instagram tiles`);
    return this.listPosts();
  }

  // ── Guards ──────────────────────────────────────────────────────────────────

  private async findPostOrThrow(id: string): Promise<PostRow> {
    const row = await this.prisma.instagramPost.findUnique({
      where: { id },
      select: POST_SELECT,
    });
    if (!row) throw new NotFoundException('Instagram tile not found');
    return row;
  }

  private async assertDestinationExists(destinationId: string): Promise<void> {
    const destination = await this.prisma.destination.findUnique({
      where: { id: destinationId },
      select: { id: true },
    });
    if (!destination) {
      throw new BadRequestException(
        `No destination found with id "${destinationId}"`,
      );
    }
  }
}

const INSTAGRAM_HOME = 'https://www.instagram.com/';

/**
 * The corner badge's meaning, resolved rather than trusted.
 *
 * VIDEO is owned by the video itself: a tile with a reel is a reel, and a tile
 * without one cannot claim to be, however the client asks. What IS the admin's
 * to say is whether a still tile links to a single photo or to a carousel -
 * that fact lives in the linked post, which we cannot see from here.
 */
function resolveMediaType(
  videoUrl: string | null,
  requested?: InstagramMediaType,
): InstagramMediaType {
  if (videoUrl) return InstagramMediaType.VIDEO;
  return requested === InstagramMediaType.CAROUSEL_ALBUM
    ? InstagramMediaType.CAROUSEL_ALBUM
    : InstagramMediaType.IMAGE;
}

function toPostResponse(row: PostRow): InstagramPostResponseDto {
  return {
    id: row.id,
    source: row.source,
    mediaType: row.mediaType,
    permalink: row.permalink || null,
    imageUrl: row.imageUrl,
    videoUrl: row.videoUrl,
    caption: row.caption,
    altText: row.altText,
    width: row.width,
    height: row.height,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    isPinned: row.isPinned,
    destinationId: row.destinationId,
    destinationName: row.destination?.name ?? null,
    postedAt: row.postedAt,
    syncedAt: row.syncedAt,
  };
}

/** Accepts "@handle", "handle", or a pasted profile URL; stores the bare handle. */
function normalizeHandle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const fromUrl = trimmed.match(
    /^https?:\/\/(?:www\.)?instagram\.com\/([^/?#]+)/i,
  );
  return (fromUrl ? fromUrl[1] : trimmed).replace(/^@/, '').trim();
}

/** An explicit override wins; otherwise the handle builds the link. */
function resolveProfileUrl(
  stored: string | null | undefined,
  username: string | null,
): string | null {
  const explicit = stored?.trim();
  if (explicit) return explicit;
  return username ? `${INSTAGRAM_HOME}${username}` : null;
}

/**
 * Alt text, in preference order: the admin's override, then the caption with
 * the parts that make bad alt text stripped out (hashtags, @mentions, URLs),
 * then a generic label. Never empty - these tiles are links, so an empty alt
 * leaves a screen reader announcing the URL.
 */
function resolveAlt(altText: string | null, caption: string | null): string {
  const override = altText?.trim();
  if (override) return override;

  const cleaned = (caption ?? '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#@][\p{L}\p{N}._]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Instagram post';
  return cleaned.length > MAX_DERIVED_ALT
    ? `${cleaned.slice(0, MAX_DERIVED_ALT).trimEnd()}...`
    : cleaned;
}
