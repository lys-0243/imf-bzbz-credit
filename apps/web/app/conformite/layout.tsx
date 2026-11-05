import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata('Conformité', 'Contrôle réglementaire et validation des dossiers.');

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
