import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'STAFF') {
    redirect('/');
  }

  return (
    <div style={{ minWidth: '100%' }}>
      {children}
    </div>
  );
}
