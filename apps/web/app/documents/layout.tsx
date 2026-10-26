import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata(
  'Documents',
  'Documents imprimables du dossier de crédit (lettre, contrats, PV, transfert).',
);

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return children;
}
