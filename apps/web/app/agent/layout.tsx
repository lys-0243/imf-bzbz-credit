import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata(
  'Espace agent',
  'Espace agent terrain — dossiers, descentes et rapports.',
);

export default function AgentLayout({ children }: { children: ReactNode }) {
  return children;
}
