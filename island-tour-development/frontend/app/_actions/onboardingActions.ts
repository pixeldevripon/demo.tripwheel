'use server';

import { authClient } from '@/lib/auth-client';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { OnboardingData } from '@/lib/validations/onboarding';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

async function safeJson(res: Response) {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (e) {
    return null;
  }
}

async function getAuthHeaders() {
  const reqHeaders = await headers();
  return {
    headers: {
      cookie: reqHeaders.get('cookie') || '',
    },
  };
}

export async function checkOnboardingStatus() {
  const reqHeaders = await headers();
  const { data: sessionData } = await authClient.getSession({
    fetchOptions: { headers: reqHeaders },
  });

  if (!sessionData?.session) {
    return { needsOnboarding: false, error: 'Unauthorized' };
  }

  const { user } = sessionData;
  const userRole = (user as any).role;

  if (userRole !== 'TOUR_OPERATOR') {
    return { needsOnboarding: false };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/users/me`, {
      headers: {
        cookie: reqHeaders.get('cookie') || '',
      },
    });

    if (!response.ok) {
      return { needsOnboarding: false, error: 'Failed to fetch user profile' };
    }

    const userData = await safeJson(response);
    if (!userData) {
      return { needsOnboarding: false, error: 'Failed to parse user profile' };
    }
    // In our backend, if operator is null, it means they need onboarding
    return { needsOnboarding: !userData.operator };
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return { needsOnboarding: false, error: 'Internal server error' };
  }
}

export async function onboardOperator(data: OnboardingData) {
  const reqHeaders = await headers();
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/operators/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: reqHeaders.get('cookie') || '',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await safeJson(response);
      return { success: false, error: errorData?.message || 'Failed to onboard' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error onboarding operator:', error);
    return { success: false, error: 'Internal server error' };
  }
}
