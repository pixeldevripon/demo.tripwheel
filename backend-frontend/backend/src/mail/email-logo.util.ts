/**
 * Email-safe delivery of the dashboard-managed logo (SiteInfo.logo).
 *
 * The stored logo is a transparent Cloudinary asset. Gmail/Outlook dark mode
 * repaint the email card dark UNDER the image, so dark logo artwork becomes
 * invisible - and neither client honors color-scheme or prefers-color-scheme,
 * so CSS cannot fix it. The only robust fix is baking a light background into
 * the delivered pixels: dark mode never recolors the inside of an image.
 *
 * The injected chained transformation flattens the logo onto a white chip
 * with 20% padding (invisible on the white brand bar in light mode, a clean
 * white plate behind the logo in dark mode). Any later components already on
 * the URL (f_auto,q_auto) still run - the alpha is gone after the first step,
 * so the final auto format cannot reintroduce transparency.
 */

const CLOUDINARY_IMAGE_UPLOAD =
  /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** Flatten onto white + 20% pad; jpg output destroys the alpha channel. */
export const EMAIL_LOGO_CHIP = 'b_white,c_pad,f_jpg,h_ih_mul_1.2,w_iw_mul_1.2';

/**
 * Rewrite a Cloudinary logo URL so the email variant carries a baked-in white
 * background. Non-Cloudinary URLs (or empty values) pass through untouched -
 * the caller's text-logo fallback handles the null case. Idempotent.
 */
export function emailSafeLogoUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const match = CLOUDINARY_IMAGE_UPLOAD.exec(url);
  if (!match) return url;
  if (match[2].startsWith(`${EMAIL_LOGO_CHIP}/`)) return url;
  return `${match[1]}${EMAIL_LOGO_CHIP}/${match[2]}`;
}
