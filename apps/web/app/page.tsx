'use client';

import Link from 'next/link';
import AuthGate from '../components/AuthGate';
import { useAuth } from '../lib/auth';
import { ROLE_HOME } from '../components/RequireAuth';

export default function HomePage() {
  return (
    <AuthGate>
      <HomeInner />
    </AuthGate>
  );
}

function HomeInner() {
  const { user, loading } = useAuth();

  return (
    <div style={{ maxWidth: 560, paddingTop: 24 }}>
      <h1 style={{ fontFamily: 'var(--imf-font)' }}>Back-office crédit</h1>
      <p style={{ color: 'var(--imf-muted)' }}>
        Dashboard agent et analyste — sidebar dossiers + détail.
      </p>
      {loading ? null : user ? (
        <p>
          Connecté en tant que {user.displayName}.{' '}
          <Link href={ROLE_HOME[user.role] || '/'}>Aller à mon poste</Link>
        </p>
      ) : (
        <p>
          <Link href="/login">Se connecter</Link>
        </p>
      )}
    </div>
  );
}
