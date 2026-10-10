import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata(
  'Administration',
  'Back-office — comptes, zones et journal d’activité.',
);

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
