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
  instagramWidgetId: string | null;
  enableInstagram: boolean;
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
  instagramWidgetId?: string;
  enableInstagram?: boolean;
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
}

export type UpdateSiteSEOPayload = Partial<Omit<SiteSEO, 'id'>>;

export interface SocialMediaSettings {
  id: string;
  facebookUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
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

export interface MollieConfiguration {
  id: string;
  paymentLabel: string;
  apiKey: string | null;
  paymentMethods: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMollieConfigurationPayload {
  paymentLabel?: string;
  apiKey?: string;
  paymentMethods?: string[];
}

/** GET response - smtpPassword is masked by the backend or null. */
export interface SmtpConfiguration {
  id: string;
  smtpHost: string | null;
  smtpPort: string | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpSecure: boolean;
}

export interface UpdateSmtpConfigurationPayload {
  smtpHost?: string;
  smtpPort?: string;
  smtpUsername?: string;
  /** Omit to keep the existing password; only send when a new value is entered. */
  smtpPassword?: string;
  smtpSecure?: boolean;
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
