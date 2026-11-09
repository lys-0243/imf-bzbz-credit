import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata(
  'Réception',
  'Enregistrement des demandes de crédit.',
);

export default function ReceptionLayout({ children }: { children: ReactNode }) {
  return children;
}
