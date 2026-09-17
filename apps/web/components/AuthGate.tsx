'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuth } from '../lib/auth';
import { RequireAuth } from './RequireAuth';

function SessionBar() {
  const { user, logout, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <p style={{ fontSize: 14, marginBottom: 16 }}>
        <Link href="/login">Se connecter</Link>
      </p>
    );
  }
  return (
    <p style={{ fontSize: 14, marginBottom: 16 }}>
      {user.displayName} ({user.role}){' '}
      <button type="button" onClick={logout}>
        Déconnexion
      </button>
    </p>
  );
}

export default function AuthGate({
  children,
  roles,
  hideSession = false,
}: {
  children: ReactNode;
  roles?: string[];
  hideSession?: boolean;
}) {
  return (
    <AuthProvider>
      {hideSession ? null : <SessionBar />}
      {roles?.length ? (
        <RequireAuth roles={roles}>{children}</RequireAuth>
      ) : (
        children
      )}
    </AuthProvider>
  );
}
