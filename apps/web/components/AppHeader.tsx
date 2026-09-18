'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function AppHeader({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login' || pathname?.startsWith('/login/');
  const isDashboard =
    pathname === '/agent' ||
    pathname?.startsWith('/agent/') ||
    pathname === '/analyste' ||
    pathname?.startsWith('/analyste/');

  if (isLogin || isDashboard) {
    return <>{children}</>;
  }

  return (
    <>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          margin: '0 0 24px',
          padding: '16px 24px 12px',
          borderBottom: '1px solid #ddd',
          fontFamily: 'var(--imf-font)',
        }}
      >
        <a href="/">IMF Crédit</a>
        <span>·</span>
        <a href="/agent">Agent</a>
        <a href="/analyste">Analyste</a>
        <a href="/reception">Réception</a>
        <a href="/conformite">Conformité</a>
        <a href="/direction">Direction</a>
        <span style={{ flex: 1 }} />
        <a href="/login">Connexion</a>
      </header>
      <main style={{ padding: '0 24px 24px' }}>{children}</main>
    </>
  );
}
