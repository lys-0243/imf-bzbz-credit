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
    <div>
      <h1>Back-office crédit</h1>
      <p>
        Poste agent (descente, checklist, rapport) et inbox analyste disponibles.
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
