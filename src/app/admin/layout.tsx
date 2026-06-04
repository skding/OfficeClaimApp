import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <div style={{ minWidth: '100%' }}>
      {children}
    </div>
  );
}
