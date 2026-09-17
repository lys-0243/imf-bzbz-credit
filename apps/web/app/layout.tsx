import type { ReactNode } from 'react';
import AppHeader from '../components/AppHeader';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AppHeader>{children}</AppHeader>
      </body>
    </html>
  );
}
