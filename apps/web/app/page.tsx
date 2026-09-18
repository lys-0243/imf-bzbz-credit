import { pageMetadata } from '../lib/seo';
import HomeClient from './HomeClient';

export const metadata = pageMetadata(
  'Accueil',
  'Plateforme crédit IMF Bisou Bisou — accès aux espaces agent et analyste.',
);

export default function HomePage() {
  return <HomeClient />;
}
