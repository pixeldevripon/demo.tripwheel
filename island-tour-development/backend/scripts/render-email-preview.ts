/**
 * render-email-preview.ts - renders the booking confirmation email to a local
 * HTML file so the design can be eyeballed against the locked wireframe.
 *
 * Run:  pnpm email:preview [paymentModel]   (from backend/)
 *       pnpm email:preview on_arrival
 *       pnpm email:preview on_arrival cash_only
 *
 * Only the BOOKING is fake. The token context comes from the real
 * `buildConfirmationEmailContext`, so this preview cannot drift from what the
 * send path actually mails - a preview built from a hand-written context would
 * happily look perfect while production shipped something else.
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  Currency,
  Locale,
  OnArrivalPayment,
  PaymentModel,
} from '@prisma/client';
import {
  buildConfirmationEmailContext,
  emailIconBase,
} from '../src/bookings/booking-email.context';
import { renderEmailTemplate } from '../src/mail/templates/email-template.renderer';

dotenv.config();

const TEMPLATE = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'mail',
    'templates',
    'booking-confirmation-email.template.html',
  ),
  'utf8',
);

const cloud = process.env.CLOUDINARY_CLOUD_NAME ?? 'demo';
const modelArg = (process.argv[2] ?? 'operator_link').toUpperCase();
const onArrivalArg = (process.argv[3] ?? 'card_or_cash').toUpperCase();

const paymentModel = PaymentModel[modelArg as keyof typeof PaymentModel];
if (!paymentModel) {
  throw new Error(
    `Unknown payment model "${process.argv[2]}". One of: ${Object.keys(
      PaymentModel,
    )
      .map((k) => k.toLowerCase())
      .join(', ')}`,
  );
}

const demoImage =
  'https://res.cloudinary.com/demo/image/upload/w_500,h_300,c_fill/sample.jpg';

// Local wall clock is stored Z-labelled - build the fixture the same way.
const start = new Date(Date.UTC(2026, 4, 22, 8, 0));

const ctx = buildConfirmationEmailContext({
  booking: {
    displayRef: 'IT-2026-04821',
    publicRef: 'demo-public-ref',
    island: 'curacao',
    currency: Currency.USD,
    customerLocale: Locale.en,
    contactFirstName: 'Denley',
    paymentModel,
    onArrivalPayment:
      paymentModel === PaymentModel.ON_ARRIVAL
        ? (OnArrivalPayment[onArrivalArg as keyof typeof OnArrivalPayment] ??
          OnArrivalPayment.CARD_OR_CASH)
        : null,
    depositPct: '30',
    depositAmount: '60.00',
    balanceAmount: '160.00',
    totalAmount: '220.00',
    tourStartDateTime: start,
    localDate: new Date(Date.UTC(2026, 4, 22)),
    startTime: '08:00',
    pickupRequested: true,
    pickupAddress: 'Hotel Brion, Otrobanda',
    pickupMinutesPrior: 45,
    pickupWindowStart: '07:15',
    pickupWindowEnd: '07:30',
    notes: 'Vegetarian lunch for one',
    cancelDeadline: new Date(Date.UTC(2026, 4, 20, 8, 0)),
    partyLines: ['2 adults', '1 child'],
  },
  tour: {
    name: 'Klein Curacao Day Trip',
    slug: 'klein-curacao-day-trip',
    heroImageUrl:
      'https://res.cloudinary.com/demo/image/upload/w_192,h_192,c_fill/sample.jpg',
    durationLabel: '9 hours',
    languageCodes: ['en'],
    checkInMinutesBefore: 30,
    meetingPoint: 'Sint Annabaai Pier',
    meetingPointLat: 12.1091,
    meetingPointLng: -68.9316,
    endPoint: 'Jan Thiel Beach',
    whatToBring: ['Swimwear', 'Towel', 'Reef-safe sunscreen', 'A hat'],
    knowBeforeYouGo: [
      'Bring a valid ID',
      'The crossing is about 90 minutes each way',
    ],
    operatorNote: 'Bring a towel and reef-safe sunscreen. We leave on time.',
  },
  operator: {
    name: 'Miss Ann Boat Trips',
    email: 'hello@missannboattrips.test',
    phone: '+5999 123 4567',
  },
  site: {
    logoUrl: `https://res.cloudinary.com/${cloud}/image/upload/v1784205640/logo_oizw6t.png`,
    whatsappNumber: '+599 9 123 4567',
    whatsappEnabled: true,
  },
  destination: { name: 'Curacao', slug: 'curacao' },
  relatedTours: [
    {
      name: 'Blue Room Snorkel Tour',
      slug: 'blue-room-snorkel-tour',
      imageUrl: demoImage,
      aggregateRating: 4.8,
      priceFrom: '45.00',
      currency: Currency.USD,
    },
    {
      name: 'Christoffel Sunrise Hike',
      slug: 'christoffel-sunrise-hike',
      imageUrl: demoImage,
      aggregateRating: 4.7,
      priceFrom: '35.00',
      currency: Currency.USD,
    },
  ],
  recommendation: {
    title: 'Palm Suite Apartment',
    imageUrl: demoImage,
    linkUrl: 'https://www.airbnb.com/rooms/123',
    external: true,
    ctaLabel: 'See availability on Airbnb',
    rating: 4.8,
    priceAmount: 160,
    currency: Currency.USD,
  },
  config: {
    frontendUrl: process.env.FRONTEND_URL ?? 'https://island.tours',
    apiUrl: process.env.BETTER_AUTH_URL ?? 'https://api.island.tours',
    emailIconBase: emailIconBase(),
  },
});

const label = paymentModel.toLowerCase();
const out = path.join(os.tmpdir(), `email-preview-${label}.html`);
fs.writeFileSync(out, renderEmailTemplate(TEMPLATE, ctx));
console.log(`rendered [${label}] -> ${out}`);
