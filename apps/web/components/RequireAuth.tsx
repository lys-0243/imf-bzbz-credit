'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

const ROLE_HOME: Record<string, string> = {
  AGENT: '/agent',
  ANALYSTE: '/analyste',
  RECEPTION: '/reception',
  CONFORMITE: '/conformite',
  DG: '/direction',
  CA: '/direction',
  ADMIN: '/agent',
};

export function RequireAuth({
  roles,
  children,
}: {
  roles?: string[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (roles?.length && !roles.includes(user.role)) {
      router.replace(ROLE_HOME[user.role] || '/');
    }
  }, [user, loading, roles, router, pathname]);

  if (loading) return <p>Chargement…</p>;
  if (!user) return null;
  if (roles?.length && !roles.includes(user.role)) return null;
  return <>{children}</>;
}

export { ROLE_HOME };
