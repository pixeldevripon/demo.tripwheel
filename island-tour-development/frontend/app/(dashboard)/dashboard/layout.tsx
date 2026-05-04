import DashboardWrapper from '@/components/dashboard/dashbaord-wraper';
import { authClient } from '@/lib/auth-client';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();

  const { data: sessionData } = await authClient.getSession({
    fetchOptions: { headers: reqHeaders },
  });

  if (!sessionData?.session) {
    redirect('/login');
  }

  const { user } = sessionData;
  const userRole = (user as unknown as { role?: string }).role;

  return (
    <DashboardWrapper
      userName={user.name}
      userEmail={user.email}
      userRole={userRole}
    >
      {children}
    </DashboardWrapper>
  );
}

