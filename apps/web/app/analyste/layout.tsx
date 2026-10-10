import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata(
  'Espace analyste',
  'Espace analyste crédit — revue des dossiers et scoring.',
);

export default function AnalysteLayout({ children }: { children: ReactNode }) {
  return children;
}
