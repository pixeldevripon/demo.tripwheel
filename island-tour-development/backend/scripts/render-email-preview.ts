/**
 * render-email-preview.ts - renders the booking confirmation email to a local
 * HTML file so the design can be eyeballed against the locked wireframe.
 *
 * Run:  pnpm email:preview [paymentModel]   (from backend/)
 *       pnpm email:preview on_arrival
 *
 * Preview only - never imported by the app. The real send path builds its token
 * context from the booking record.
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  renderEmailTemplate,
  type EmailTemplateContext,
} from '../src/mail/templates/email-template.renderer';

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
const ICON_BASE = `https://res.cloudinary.com/${cloud}/image/upload/f_png,w_34/islandtours/email/icons`;

const paymentModel = process.argv[2] ?? 'operator_link';

const ctx: EmailTemplateContext = {
  emailIconBase: ICON_BASE,
  siteLogoUrl: `https://res.cloudinary.com/${cloud}/image/upload/v1784205640/logo_oizw6t.png`,
  firstName: 'Denley',
  bookingRef: 'IT-2026-04821',
  tourName: 'Klein Curacao Day Trip',
  operatorName: 'Miss Ann Boat Trips',
  featuredImageUrl:
    'https://res.cloudinary.com/demo/image/upload/w_192,h_192,c_fill/sample.jpg',
  dateLong: 'Friday, 22 May 2026',
  dateShort: '22 May 2026',
  startTime: '08:00',
  locale: 'en',
  hasPickup: true,
  pickupLocation: 'Hotel Brion',
  pickupTime: '07:15',
  meetingPoint: 'Sint Annabaai Pier',
  mapUrl: 'https://maps.google.com/?q=Hotel+Brion',
  arrivalBufferMin: 5,
  endPoint: 'Jan Thiel Beach',
  partyBreakdown: '2 adults, 1 child',
  duration: '9 hours',
  tourLanguage: 'English',
  specialRequests: 'Vegetarian lunch for one',
  operatorNote: 'Bring a towel and reef-safe sunscreen. We leave on time.',
  paymentModel,
  onArrivalPayment: paymentModel === 'on_arrival' ? 'card_or_cash' : '',
  depositPct: 30,
  depositAmount: '$60.00',
  balanceAmount: '$160.00',
  totalAmount: '$220.00',
  paidAmount: '$220.00',
  paymentMethodLine: 'Visa ending 4242',
  whatsappUrl: 'https://wa.me/8801913509868',
  tourUrl: 'https://island.tours/curacao/klein-curacao-day-trip',
  calendarUrl: 'https://island.tours/ics/IT-2026-04821',
  cancelUrl: 'https://island.tours/cancel/abc',
  accountUrl: 'https://island.tours/bookings',
  bookingsUrl: 'https://island.tours/bookings',
  browseUrl: 'https://island.tours/curacao/tours',
  allToursUrl: 'https://island.tours/curacao/tours',
  whatToBring: 'Swimwear, towel, reef-safe sunscreen, a hat',
  knowBeforeYouGo:
    'Bring a valid ID. The crossing is about 90 minutes each way.',
  freeCancellationDeadline: 'Wednesday 20 May, 08:00',
  cancelDeadlineDateTime: 'Wednesday 20 May 2026, 08:00',
  operatorPhone: '+5999 123 4567',
  operatorEmail: 'hello@missannboattrips.test',
  islandName: 'Curacao',
  relatedTourOneImageUrl:
    'https://res.cloudinary.com/demo/image/upload/w_500,h_300,c_fill/sample.jpg',
  relatedTourOneName: 'Blue Room Snorkel Tour',
  relatedTourOneRating: '4.8',
  relatedTourOnePrice: 'from $45',
  relatedTourTwoImageUrl:
    'https://res.cloudinary.com/demo/image/upload/w_500,h_300,c_fill/sample.jpg',
  relatedTourTwoName: 'Christoffel Sunrise Hike',
  relatedTourTwoRating: '4.7',
  relatedTourTwoPrice: 'from $35',
};

const out = path.join(os.tmpdir(), `email-preview-${paymentModel}.html`);
fs.writeFileSync(out, renderEmailTemplate(TEMPLATE, ctx));
console.log(`rendered [${paymentModel}] -> ${out}`);
