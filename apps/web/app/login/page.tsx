'use client';

import { Suspense } from 'react';
import { AuthProvider } from '../../lib/auth';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <div
            style={{
              minHeight: '100vh',
              display: 'grid',
              placeItems: 'center',
              background: '#284080',
              color: '#fff',
              fontFamily: 'var(--imf-font)',
            }}
          >
            Chargement…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthProvider>
  );
}
