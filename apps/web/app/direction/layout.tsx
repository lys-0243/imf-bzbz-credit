import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata('Direction / CA', 'PV du comité, approbation du Conseil et documents de décaissement.');

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
