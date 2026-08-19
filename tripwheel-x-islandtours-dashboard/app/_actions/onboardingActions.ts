'use server';

import { getUserProfile } from '@/app/_actions/userActions';
import {
  humaneMessage,
  NETWORK_MESSAGE,
} from '@/lib/api/humane-error';
import { serverAuthHeaders } from '@/lib/server/auth-headers';
import { headers } from 'next/headers';
import { OnboardingData } from '@/lib/validations/onboarding';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

async function safeJson(res: Response) {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// Reads the request-memoized profile (`getUserProfile` is React `cache()`-wrapped),
// so when the dashboard layout has already resolved the user this makes ZERO extra
// backend calls. A TOUR_OPERATOR with no operator record still needs onboarding.
export async function checkOnboardingStatus() {
  const cookie = (await headers()).get('cookie') || '';
  const user = await getUserProfile(cookie);

  if (!user) {
    return { needsOnboarding: false, error: 'Unauthorized' };
  }

  const userRole = (user as { role?: string }).role;
  if (userRole !== 'TOUR_OPERATOR') {
    return { needsOnboarding: false };
  }

  // In our backend, if operator is null, it means they need onboarding.
  return { needsOnboarding: !(user as { operator?: unknown }).operator };
}

export async function onboardOperator(data: OnboardingData) {
  const reqHeaders = await headers();
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/operators/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...serverAuthHeaders(reqHeaders.get('cookie') || ''),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await safeJson(response);
      return { success: false, error: humaneMessage(response.status, errorData) };
    }

    return { success: true };
  } catch (error) {
    console.error('Error onboarding operator:', error);
    return { success: false, error: NETWORK_MESSAGE };
  }
}
