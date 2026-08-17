// Mirrors backend: src/settings/dto/settings.dto.ts (platform-wide singletons).
// Admin-managed system settings. Operator-scoped settings live in types/operator-settings.ts.

export interface SiteInfo {
  id: string;
  siteName: string | null;
  siteTagline: string | null;
  siteDescription: string | null;
  bookingFormStyle: string | null;
  logo: string | null;
  favicon: string | null;
  enableWhatsappChat: boolean;
  whatsappNumber: string | null;
  enableInstagram: boolean;
  /**
   * "Your local host" - the looping avatar beside the WhatsApp button in the
   * FAQ block. Site-wide, not homepage content: that block renders on the home,
   * destination and collection pages. Null on either keeps the bundled avatar.
   */
  faqHostImage: string | null;
  faqHostVideo: string | null;
  faqs: unknown;
}

export interface UpdateSiteInfoPayload {
  siteName?: string;
  siteTagline?: string;
  siteDescription?: string;
  bookingFormStyle?: string;
  logo?: string;
  favicon?: string;
  enableWhatsappChat?: boolean;
  whatsappNumber?: string;
  enableInstagram?: boolean;
  faqHostImage?: string;
  faqHostVideo?: string;
}

export interface SiteSEO {
  id: string;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
  googleSearchConsole: string | null;
  facebookPixelId: string | null;
  schemaType: string | null;
  customSchema: string | null;
  autoGenerateSitemap: string | null;
  robotsTxt: string | null;
  cookiebotCbid: string | null;
}

export type UpdateSiteSEOPayload = Partial<Omit<SiteSEO, 'id'>>;

export interface SocialMediaSettings {
  id: string;
  facebookUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
}

export type UpdateSocialMediaPayload = Partial<Omit<SocialMediaSettings, 'id'>>;

export interface CompanyInformations {
  id: string;
  companyName: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyWebsite: string | null;
  companyAddress: string | null;
  companyCity: string | null;
  companyState: string | null;
  companyZip: string | null;
  companyCountry: string | null;
  companyVat: string | null;
  companySize: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateCompanyInformationsPayload = Partial<
  Omit<CompanyInformations, 'id' | 'createdAt' | 'updatedAt'>
>;

/** GET response - secrets are masked by the backend (e.g. "********1234") or null. */
export interface StripeConfiguration {
  id: string;
  paymentLabel: string;
  publishableKey: string;
  secretKey: string | null;
  webhookSecret: string | null;
  paymentMethods: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateStripeConfigurationPayload {
  paymentLabel?: string;
  publishableKey?: string;
  /** Omit to keep the existing key; only send when the admin enters a new value. */
  secretKey?: string;
  webhookSecret?: string;
  paymentMethods?: string[];
}

/** Which PSP charges travellers at checkout. Never retroactive: existing payments keep their own provider. */
export type PaymentProvider = 'STRIPE' | 'MOLLIE';

export interface PaymentProviderSettings {
  id: string;
  activeProvider: PaymentProvider;
  updatedAt: string;
}

export interface UpdatePaymentProviderPayload {
  activeProvider: PaymentProvider;
}

export interface MollieConfiguration {
  id: string;
  paymentLabel: string;
  apiKey: string | null;
  /** Mollie profile id (pfl_..., public) - enables the inline Components card form. */
  profileId: string;
  paymentMethods: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMollieConfigurationPayload {
  paymentLabel?: string;
  apiKey?: string;
  profileId?: string;
  paymentMethods?: string[];
}

// ── Payment connection status (test connection + method board) ──────────────

/**
 * Traveller-facing brand marks - the 8 badges the public site's footer shows.
 * Mirrors the backend's `src/settings/payment-method-brands.ts`; change one,
 * change the other.
 */
export type PaymentMethodBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'paypal'
  | 'ideal'
  | 'applepay'
  | 'googlepay'
  | 'klarna';

/**
 * active = activated on the PSP account; inactive = the PSP offers it but the
 * account has not activated it; unsupported = the PSP does not offer it at all
 * (e.g. Google Pay on Mollie).
 */
export type PaymentMethodState = 'active' | 'inactive' | 'unsupported';

export interface PaymentMethodStatus {
  key: PaymentMethodBrand;
  status: PaymentMethodState;
  /**
   * "This still needs something" despite the status: Apple Pay activated
   * with no validated payment-method domain, or an activation Stripe is
   * still reviewing. Null = nothing owed.
   */
  attention: string | null;
}

export interface PaymentProviderConnection {
  /** Credential set complete per the activation contract. */
  configured: boolean;
  /** Human labels of the credentials still missing. */
  missing: string[];
  /** The live probe against the STORED credentials succeeded. */
  ok: boolean;
  mode: 'live' | 'test' | null;
  accountLabel: string | null;
  /** Sanitized probe failure reason (null when ok or unconfigured). */
  error: string | null;
  methods: PaymentMethodStatus[];
}

export interface PaymentConnectionStatus {
  activeProvider: PaymentProvider;
  checkedAt: string;
  /** Null only when the probe was filtered to the other provider. */
  stripe: PaymentProviderConnection | null;
  mollie: PaymentProviderConnection | null;
}

/** GET response - apiKey is masked by the backend or null. */
export interface MailchimpConfiguration {
  id: string;
  apiKey: string | null;
  audienceId: string | null;
  serverPrefix: string | null;
}

export interface UpdateMailchimpConfigurationPayload {
  apiKey?: string;
  audienceId?: string;
  serverPrefix?: string;
}

// ── Integrations (Meta CAPI + AI translation) ───────────────────────────────

/**
 * Providers the backend's translation router knows (mirrors
 * backend/src/content-translation/providers/provider-catalog.ts - keep in
 * sync). Gemini is the default/fallback; `custom` is any OpenAI-compatible
 * endpoint via translationBaseUrl.
 */
export type TranslationProvider =
  | 'gemini'
  | 'anthropic'
  | 'openai'
  | 'groq'
  | 'openrouter'
  | 'mistral'
  | 'deepseek'
  | 'custom';

/** GET response - secrets are masked by the backend (bullet prefix + last 4) or null. */
export interface IntegrationsConfiguration {
  id: string;
  metaCapiToken: string | null;
  metaCapiTestCode: string | null;
  /** '' = the backend default (gemini). */
  translationProvider: string | null;
  translationApiKey: string | null;
  translationModel: string | null;
  /** Only used by provider 'custom' (any OpenAI-compatible endpoint). */
  translationBaseUrl: string | null;
  /** Google Ads API - cancellation retractions. The three secrets come back masked. */
  googleAdsDeveloperToken: string | null;
  googleAdsCustomerId: string | null;
  googleAdsLoginCustomerId: string | null;
  googleAdsClientId: string | null;
  googleAdsClientSecret: string | null;
  googleAdsRefreshToken: string | null;
  googleAdsConversionActionId: string | null;
}

export interface UpdateIntegrationsConfigurationPayload {
  /** Omit to keep the stored secret; only send when a new value is entered. */
  metaCapiToken?: string;
  metaCapiTestCode?: string;
  translationProvider?: string;
  translationApiKey?: string;
  translationModel?: string;
  translationBaseUrl?: string;
  googleAdsDeveloperToken?: string;
  googleAdsCustomerId?: string;
  googleAdsLoginCustomerId?: string;
  googleAdsClientId?: string;
  googleAdsClientSecret?: string;
  googleAdsRefreshToken?: string;
  googleAdsConversionActionId?: string;
}

// ── Platform reviews (Trustpilot / Google) ─────────────────────────────────

/** GET response - apiKey is masked by the backend or null. */
export interface PlatformReviewsConfig {
  id: string;
  provider: 'trustpilot' | 'google' | null;
  apiKey: string | null;
  businessId: string | null;
  enabled: boolean;
  displayPages: string[];
  fetchedAt: string | null;
  lastError: string | null;
  reviewCount: number | null;
  rating: number | null;
}

export interface UpdatePlatformReviewsPayload {
  provider?: 'trustpilot' | 'google';
  /** Omit to keep the stored key; masked echoes are ignored; '' clears. */
  apiKey?: string;
  businessId?: string;
  enabled?: boolean;
  displayPages?: string[];
}

export interface RefreshPlatformReviewsResult {
  ok: boolean;
  reviewCount?: number;
  rating?: number;
  error?: string;
}

// ── Post-tour review requests (cadence) ────────────────────────────────────

/**
 * The schedule for the post-tour review invitation. `enabled` is the master
 * switch and ships FALSE - the job mails real customers, so a person turns it
 * on deliberately rather than a deploy turning it on by accident.
 */
export interface ReviewRequestSettings {
  id: string;
  enabled: boolean;
  /** Local hour in the TOUR's timezone (0-23) for the first touch. */
  firstSendLocalHour: number;
  /** Days after the tour before the first touch. 1 = the morning after. */
  firstSendDelayDays: number;
  reminderEnabled: boolean;
  /** Days after the first touch before the single reminder. */
  reminderAfterDays: number;
  /** Stop chasing a booking older than this. */
  giveUpAfterDays: number;
  /** Max invitations processed per hourly run. */
  batchSize: number;
  updatedAt: string;
}

export interface UpdateReviewRequestsPayload {
  enabled?: boolean;
  firstSendLocalHour?: number;
  firstSendDelayDays?: number;
  reminderEnabled?: boolean;
  reminderAfterDays?: number;
  giveUpAfterDays?: number;
  batchSize?: number;
}
