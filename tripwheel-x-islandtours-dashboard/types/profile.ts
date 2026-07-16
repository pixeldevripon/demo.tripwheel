export type UserRole = 'USER' | 'TOUR_OPERATOR' | 'ADMIN';

export interface OperatorSocialMedia {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
}

export interface OperatorProfile {
  id: string;
  socialMedia?: OperatorSocialMedia | null;
  companyInfo?: Record<string, unknown> | null;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  phone?: string | null;
  location?: string | null;
  timezone?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
  operator?: OperatorProfile | null;
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string | null;
  location?: string | null;
  timezone?: string;
  image?: string | null;
}

export interface SocialMediaPayload {
  instagramUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
}
