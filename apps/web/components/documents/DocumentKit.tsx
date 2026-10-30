import type { ReactNode } from 'react';
import { docBlank, docDate, docMontant, docPct, type ParametresImf } from '@imf/shared';
import styles from './documents.module.css';

export { styles as docStyles };

/** Formats partagés avec les documents éditables (documentsHtml). */
export const money = docMontant;
export const pct = docPct;
export const dateFr = docDate;
export const blank = docBlank;

/** En-tête institutionnel (paramètres IMF). */
export function DocHeader({ institution }: { institution: ParametresImf['institution'] }) {
  return (
    <div className={styles.header}>
      <div>
        <div className={styles.headerName}>{institution.raisonSociale}</div>
        <div>{institution.formeJuridique}</div>
        <div>{institution.siege}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div>RCCM {institution.rccm}</div>
        <div>Id. Nat. {institution.idNat}</div>
        <div>Agrément BCC {institution.agrementBcc}</div>
      </div>
    </div>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className={styles.p}>{children}</p>;
}

export function Signatures({ items }: { items: Array<{ titre: string; nom?: string; mention?: string }> }) {
  return (
    <div className={styles.signatures}>
      {items.map((s) => (
        <div key={s.titre} className={styles.signature}>
          <strong>{s.titre}</strong>
          {s.nom ? <div>{s.nom}</div> : null}
          {s.mention ? <div className={styles.muted}>{s.mention}</div> : null}
        </div>
      ))}
    </div>
  );
}
