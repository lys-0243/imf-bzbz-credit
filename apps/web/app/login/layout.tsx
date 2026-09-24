import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata(
  'Connexion',
  'Connexion à la plateforme crédit IMF Bisou Bisou.',
);

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
