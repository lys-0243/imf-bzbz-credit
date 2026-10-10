import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata(
  'Réception',
  'Enregistrement des demandes de crédit.',
);

export default function ReceptionPage() {
  return (
    <div>
      <h1>Réception</h1>
      <p>
        L’enregistrement des dossiers se fait via l’application mobile
        (produits actifs du catalogue). Le back-office web réception arrive
        prochainement.
      </p>
    </div>
  );
}
