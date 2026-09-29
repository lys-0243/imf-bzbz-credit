import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata(
  'Responsable crédit',
  'Affectation manuelle des dossiers aux agents.',
);

export default function ResponsableCreditLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
