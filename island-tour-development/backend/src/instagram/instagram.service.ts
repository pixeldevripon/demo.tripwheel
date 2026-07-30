import { CloudinaryService } from '@/media-gallery/cloudinary.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InstagramLayout, type Prisma } from '@prisma/client';
import {
  InstagramAccountResponseDto,
  InstagramPostResponseDto,
  PublicInstagramFeedResponseDto,
  PublicInstagramPostDto,
  ReorderInstagramPostsDto,
  UpdateInstagramAccountDto,
  UpdateInstagramPostDto,
} from './dto/instagram.dto';
import { deleteInstagramMirror } from './instagram-mirror.util';
import { InstagramSyncScheduler } from './instagram-sync.scheduler';

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
  videoPublicId: true,
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

const ACCOUNT_SELECT = {
  id: true,
  username: true,
  profileUrl: true,
  layout: true,
  syncFetchLimit: true,
  syncIntervalMinutes: true,
} satisfies Prisma.InstagramAccountSelect;

type AccountRow = Prisma.InstagramAccountGetPayload<{
  select: typeof ACCOUNT_SELECT;
}>;

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly scheduler: InstagramSyncScheduler,
  ) {}

  // ── Public read ─────────────────────────────────────────────────────────────

  /**
   * Everything the grid renders, in one call.
   *
   * `enabled` folds together the admin kill switch, a missing access token, and
   * "there is nothing to show", because all three mean the same thing to the
   * frontend: render no section at all. A handle row above an empty grid is
   * worse than no section.
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
        select: {
          username: true,
          profileUrl: true,
          layout: true,
          configAccessToken: true,
        },
      }),
    ]);

    const username = account?.username?.trim() || null;
    const profileUrl = resolveProfileUrl(account?.profileUrl, username);
    const layout = account?.layout ?? InstagramLayout.GALLERY;

    // `enableInstagram` is NOT NULL and defaults ON, so only a MISSING site_info
    // row needs a fallback here - an untouched install, where the column default
    // is the right answer. Same reading as getPublicSiteInfo; the two used to
    // disagree.
    if (siteInfo && !siteInfo.enableInstagram) {
      return { enabled: false, username, profileUrl, layout, posts: [] };
    }

    // No access token means the integration is not set up, so the section goes.
    // The token is the ONE thing an admin must supply for this feature to be a
    // real Instagram feed; without it the grid can only ever be whatever tiles
    // were hand-added, presented under a handle the platform cannot verify it
    // still owns and cannot keep current. That is worse than showing nothing.
    //
    // Presence of the stored value, deliberately not `safeDecrypt` (the check
    // `InstagramConfigService.resolve` makes): a rotated ENCRYPTION_KEY leaves a
    // token that no longer decrypts, and the honest signal for that is a sync
    // that fails loudly in the dashboard - not a public section that silently
    // disappears for a reason nobody would connect to the key.
    if (!account?.configAccessToken) {
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
      select: ACCOUNT_SELECT,
    });

    // Read-only endpoint: never upsert on GET, just describe the empty state.
    return toAccountResponse(account);
  }

  /**
   * The account form carries the LAYOUT and the sync tuning (posts-per-sync,
   * auto-sync cadence). The handle and profile link are auto-derived from the
   * connected account (resolved on seed), so they are never set here - only
   * displayed read-only. Changing the cadence re-registers the cron live.
   */
  async updateAccount(
    dto: UpdateInstagramAccountDto,
    adminId: string,
  ): Promise<InstagramAccountResponseDto> {
    const data = {
      ...(dto.layout !== undefined && { layout: dto.layout }),
      ...(dto.syncFetchLimit !== undefined && {
        syncFetchLimit: dto.syncFetchLimit,
      }),
      ...(dto.syncIntervalMinutes !== undefined && {
        syncIntervalMinutes: dto.syncIntervalMinutes,
      }),
    };
    const account = await this.prisma.instagramAccount.upsert({
      where: { id: ACCOUNT_ID },
      update: data,
      create: { id: ACCOUNT_ID, ...data },
      select: ACCOUNT_SELECT,
    });

    // A cadence change must take effect without a restart. Best-effort: a
    // scheduling hiccup must not fail the save the admin just made.
    if (dto.syncIntervalMinutes !== undefined) {
      try {
        await this.scheduler.applySchedule();
      } catch (err) {
        this.logger.error(
          `Failed to re-register the Instagram sync cron: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    this.logger.log(`Admin ${adminId} updated the Instagram section settings`);
    return toAccountResponse(account);
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

  /**
   * Curate a synced tile: hide/show, alt text, and the pinned destination. The
   * media, caption and permalink belong to the sync (a re-run would revert any
   * edit), so they are not editable here - the DTO does not carry them.
   */
  async updatePost(
    id: string,
    dto: UpdateInstagramPostDto,
    adminId: string,
  ): Promise<InstagramPostResponseDto> {
    await this.findPostOrThrow(id);
    if (dto.destinationId)
      await this.assertDestinationExists(dto.destinationId);

    const row = await this.prisma.instagramPost.update({
      where: { id },
      data: {
        ...(dto.altText !== undefined && {
          altText: dto.altText.trim() || null,
        }),
        ...(dto.destinationId !== undefined && {
          destinationId: dto.destinationId,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: POST_SELECT,
    });

    this.logger.log(`Admin ${adminId} curated Instagram tile ${id}`);
    return toPostResponse(row);
  }

  async removePost(id: string, adminId: string): Promise<{ message: string }> {
    const existing = await this.findPostOrThrow(id);
    await this.prisma.instagramPost.delete({ where: { id } });
    // Clean the mirrored Cloudinary assets, exactly as the sync's own "gone
    // post" path does - otherwise a manual delete leaks the asset pair forever,
    // and a delete-then-resync re-mirrors the post under a new public id.
    await deleteInstagramMirror(
      this.cloudinary,
      existing.imagePublicId,
      existing.videoPublicId,
    );

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

/** Shape the account row (or the empty state) into the response DTO. Defaults
 * mirror the schema (@default): layout GRID, 24 posts/sync, daily (1440 min). */
function toAccountResponse(
  row: AccountRow | null,
): InstagramAccountResponseDto {
  return {
    id: row?.id ?? ACCOUNT_ID,
    username: row?.username || null,
    profileUrl: row?.profileUrl || null,
    layout: row?.layout ?? InstagramLayout.GALLERY,
    syncFetchLimit: row?.syncFetchLimit ?? 24,
    syncIntervalMinutes: row?.syncIntervalMinutes ?? 1440,
  };
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
