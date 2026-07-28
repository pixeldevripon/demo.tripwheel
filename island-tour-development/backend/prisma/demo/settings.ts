// DEMO SEED — singleton settings rows (site info, SEO, social, company), the
// lead-webhook points, payment-config placeholders (no real secrets), and a few
// media-gallery rows. All keyed by the fixed 'default' id where applicable.

import {
  InstagramMediaType,
  InstagramSource,
  InstagramSyncStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { encrypt } from '../../src/common/utils/crypto.util';
import { DEMO_WEBHOOK_HOST, log, photo, prisma, section } from './_shared';

export async function seedSettings(): Promise<void> {
  section('Settings + webhooks + media');

  const homeFaqs = [
    {
      q: 'Can I cancel if my plans change?',
      a: 'Yes — every tour includes free cancellation, no questions asked, up to the window shown on the tour page.',
    },
    {
      q: 'How much do I pay today?',
      a: 'On most tours you pay as little as 20% today to secure your spot, and the rest later.',
    },
    {
      q: 'How do I reach you?',
      a: 'Message us on WhatsApp between 08:00 and 20:00 — we are locals, here to help.',
    },
  ];

  await prisma.siteInfo.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      siteName: 'Island Tours',
      siteTagline: 'Chosen by locals. Made for travelers.',
      siteDescription:
        'Book the best Caribbean tours and activities, hand-picked by locals. Free cancellation, instant confirmation, pay as little as 20% today.',
      bookingFormStyle: 'v2',
      enableWhatsappChat: true,
      whatsappNumber: '+59995601234',
      enableInstagram: true,
      faqs: homeFaqs,
    },
  });

  await prisma.siteSEO.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      metaTitle: 'Island Tours — Caribbean Tours & Activities',
      metaDescription:
        'Discover and book Caribbean tours picked by locals. Free cancellation on every tour, instant confirmation, and pay as little as 20% today.',
      metaKeywords:
        'caribbean tours, curacao tours, aruba activities, sint maarten excursions',
      canonicalUrl: 'https://islandtours.example',
      robotsMeta: 'index,follow',
      ogTitle: 'Island Tours — Caribbean Tours & Activities',
      ogDescription:
        'Tours picked by locals. Free cancellation, instant confirmation.',
      ogImage: photo('aerialCoast', 1200, 630),
      twitterTitle: 'Island Tours',
      twitterDescription: 'Caribbean tours picked by locals.',
      twitterImage: photo('aerialAtoll', 1200, 630),
      schemaType: 'TravelAgency',
      autoGenerateSitemap: 'true',
    },
  });

  await prisma.socialMedia.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      facebookUrl: 'https://facebook.com/islandtours',
      instagramUrl: 'https://instagram.com/islandtours',
      twitterUrl: 'https://x.com/islandtours',
      linkedinUrl: 'https://linkedin.com/company/islandtours',
    },
  });

  await prisma.companyInformations.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      companyName: 'Island Tours B.V.',
      companyEmail: 'hello@islandtours.example',
      companyPhone: '+59995601234',
      companyWebsite: 'https://islandtours.example',
      companyAddress: 'Handelskade 1',
      companyCity: 'Willemstad',
      companyState: 'Curaçao',
      companyZip: '0000',
      companyCountry: 'Curaçao',
      companyVat: 'CW-DEMO-0001',
      companySize: '11-50',
    },
  });

  // Payment-config + messaging singletons exist but carry NO real secrets.
  await prisma.stripeConfiguration.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      paymentLabel: 'Stripe',
      publishableKey: '',
      secretKey: '',
      webhookSecret: '',
      paymentMethods: ['card'],
    },
  });
  await prisma.mollieConfiguration.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      paymentLabel: 'Mollie',
      apiKey: '',
      paymentMethods: ['creditcard', 'ideal'],
    },
  });
  await prisma.mailchimp.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', apiKey: '', audienceId: '', serverPrefix: '' },
  });

  // ── Lead-catch webhooks ──
  await prisma.webhooks.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  for (const type of ['zapier_leads_catch_url', 'n8n_leads_catch_url']) {
    await prisma.webhookPoint.upsert({
      where: { webhooksId_type: { webhooksId: 'default', type } },
      update: {},
      create: {
        type,
        url: `https://${DEMO_WEBHOOK_HOST}/leads/${type}`,
        webhooksId: 'default',
      },
    });
  }

  // ── Media gallery (a few assets, owned by the admin) ──
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: { id: true },
  });
  let mediaCount = 0;
  if (admin) {
    // Topical asset per slot (island heroes get their island's signature shot).
    const assets: [name: string, photoName: Parameters<typeof photo>[0]][] = [
      ['hero-curacao', 'willemstad'],
      ['hero-aruba', 'beachPalms'],
      ['hero-sxm', 'aerialCoast'],
      ['logo-light', 'sailboat'],
      ['logo-dark', 'sunsetSea'],
      ['og-default', 'aerialAtoll'],
    ];
    for (const [a, p] of assets) {
      const publicId = `demo/${a}`;
      const existing = await prisma.mediaGallery.findUnique({
        where: { publicId },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.mediaGallery.create({
        data: {
          url: photo(p, 1600, 900),
          publicId,
          resourceType: 'image',
          userId: admin.id,
        },
      });
      mediaCount++;
    }
  }

  // ── Instagram grid (auto-sync demo: a CONNECTED demo account + synced tiles) ──
  //
  // Phase 2 is now the only path - tiles come from the sync, not a manual
  // picker. So the demo seeds the account as CONNECTED to the demo provider
  // (INSTAGRAM_APP_ID=demo) with a fake, ENCRYPTED, 60-day token, and seeds the
  // tiles as source=API with the SAME igMediaIds the demo provider returns. That
  // makes the dashboard show "Connected (demo)" out of the box, AND makes a
  // later "Sync now" idempotent - it upserts these very rows instead of
  // duplicating them.
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  await prisma.instagramAccount.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      username: 'island.tours_',
      // Left empty on purpose: the service derives the profile link from the
      // handle, and the demo data should exercise that path.
      profileUrl: '',
      igUserId: 'demo-ig-user',
      accessToken: encrypt('demo-instagram-token'),
      tokenExpiresAt: new Date(Date.now() + SIXTY_DAYS_MS),
      lastSyncedAt: new Date(),
      lastSyncStatus: InstagramSyncStatus.OK,
    },
  });

  // The first tile carries a video, so the demo grid exercises the reel path
  // (poster painted first, muted loop over it) and not just stills. igMediaIds
  // mirror InstagramDemoProvider.DEMO_MEDIA so a demo sync updates-not-duplicates.
  const DEMO_REEL =
    'https://res.cloudinary.com/dsfms7jb4/video/upload/v1784296702/sunset-cruise_qojtp4.mp4';

  const igTiles: [
    slot: string,
    photoName: Parameters<typeof photo>[0],
    caption: string,
    videoUrl?: string,
  ][] = [
    ['01', 'sunsetSea', 'Last light off the south shore', DEMO_REEL],
    ['02', 'willemstad', 'Sunrise over the Handelskade, Willemstad'],
    ['03', 'catamaranDeck', 'Deck days on the west-coast catamaran run'],
    ['04', 'turtleReef', 'Playa Piskado regulars #turtles'],
    ['05', 'jeepTrail', 'Dust, cactus and coastline on the buggy trail'],
    ['06', 'beachChairs', 'Slow afternoon at Cas Abao'],
  ];

  let igCount = 0;
  for (const [slot, photoName, caption, videoUrl] of igTiles) {
    const igMediaId = `demo-ig-media-${slot}`;
    const existing = await prisma.instagramPost.findUnique({
      where: { igMediaId },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.instagramPost.create({
      data: {
        source: InstagramSource.API,
        igMediaId,
        imageUrl: photo(photoName, 768, 960), // 4:5 gallery portrait
        ...(videoUrl && {
          videoUrl,
          mediaType: InstagramMediaType.VIDEO,
        }),
        imagePublicId: `demo/ig-${slot}`,
        caption,
        width: 768,
        height: 960,
        postedAt: new Date(Date.now() - igCount * 24 * 60 * 60 * 1000),
        syncedAt: new Date(),
        displayOrder: igCount,
      },
    });
    igCount++;
  }

  log(
    `Settings singletons + 2 webhook points + ${mediaCount} media rows + ${igCount} Instagram tiles seeded.`,
  );
}
