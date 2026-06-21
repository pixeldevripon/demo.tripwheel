import type { CompanyInformations, SiteInfo } from '@prisma/client';

/**
 * Supplier serializer (spec §4.1).
 *
 * ## What it does
 * Per OCTO, the platform itself is the single Supplier (decision D4) — we are a
 * reseller exposing one aggregated catalog, not per-operator suppliers. This maps
 * our `SiteInfo` + `CompanyInformations` settings onto the OCTO Supplier shape.
 *
 * ## Usage
 * `serializeSupplier(siteInfo, company, endpoint)` — `endpoint` is the OCTO base URL
 * (no trailing slash) the supplier advertises.
 */
export function serializeSupplier(
  siteInfo: SiteInfo,
  company: CompanyInformations | null,
  endpoint: string,
): Record<string, unknown> {
  const logo = siteInfo.logo?.trim() || null;

  return {
    id: 'island-tours',
    name: company?.companyName || siteInfo.siteName || 'Island Tours',
    endpoint,
    contact: {
      website: company?.companyWebsite || null,
      email: company?.companyEmail || null,
      telephone: company?.companyPhone || null,
      address: composeAddress(company),
    },
    shortDescription: siteInfo.siteTagline || siteInfo.siteDescription || null,
    media: logo
      ? [
          {
            src: logo,
            type: 'image/png',
            rel: 'LOGO',
            title: null,
            caption: null,
            copyright: null,
          },
        ]
      : null,
  };
}

function composeAddress(company: CompanyInformations | null): string | null {
  if (!company) return null;
  const parts = [
    company.companyAddress,
    company.companyCity,
    company.companyState,
    company.companyZip,
    company.companyCountry,
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(', ') : null;
}
