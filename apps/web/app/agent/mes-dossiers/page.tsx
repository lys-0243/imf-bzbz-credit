import { redirect } from 'next/navigation';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata('Mes dossiers');

export default function AgentMesDossiersRedirect() {
  redirect('/agent/dossiers-en-cours');
}
