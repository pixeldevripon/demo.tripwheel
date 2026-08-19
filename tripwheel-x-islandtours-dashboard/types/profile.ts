export type UserRole = 'USER' | 'TOUR_OPERATOR' | 'ADMIN';

export interface OperatorProfile {
  id: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  emailVerified?: boolean;
  createdAt?: string;
  operator?: OperatorProfile | null;
}

/** PATCH /users/me - the profile page only ever writes name and image. */
export interface UpdateProfilePayload {
  name?: string;
  image?: string | null;
}
