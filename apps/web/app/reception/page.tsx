import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata(
  'Réception',
  'Enregistrement des demandes de crédit.',
);

const RECEPTION_URL =
  process.env.NEXT_PUBLIC_RECEPTION_URL || 'http://localhost:8081';

export default function ReceptionPage() {
  return (
    <div>
      <h1>Réception</h1>
      <p>
        L’enregistrement des dossiers se fait dans l’application réception,
        disponible sur mobile et dans le navigateur.
      </p>
      <p>
        <a href={RECEPTION_URL}>Ouvrir l’application réception web</a>
      </p>
    </div>
  );
}
