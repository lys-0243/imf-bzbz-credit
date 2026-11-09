'use client';

import { DOSSIER_ETAT_LABELS } from '@imf/shared';
import { dateHeure, ROLE_LABELS, type DossierPoste } from '../../lib/poste';
import s from './poste.module.css';

type Point = { id?: string; constat?: string; exigence?: string; correction?: string; commentaire?: string; gravite?: string };

/** Points à corriger / non-conformités joints à un retour. */
export function PointsRetour({ details }: { details: unknown }) {
  const points = Array.isArray(details) ? (details as Point[]) : [];
  if (!points.length) return null;
  return (
    <ul className={s.bullets} style={{ marginTop: 6 }}>
      {points.map((p, i) => (
        <li key={p.id ?? i}>
          {p.gravite ? <strong>{p.gravite.toLowerCase()} — </strong> : null}
          {p.constat ?? p.exigence}
          {p.correction || p.commentaire ? <span className={s.hint}> → {p.correction ?? p.commentaire}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function ParcoursChronologie({ d }: { d: DossierPoste }) {
  const items = [...d.transitions].reverse();
  return (
    <div className={s.card}>
      <h3 className={s.cardTitle} style={{ marginBottom: 12 }}>
        Chronologie du dossier
      </h3>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {items.map((t) => (
          <li
            key={t.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px minmax(0,1fr)',
              gap: 16,
              padding: '12px 0',
              borderBottom: '1px solid #f1f1f1',
            }}
          >
            <span className={s.hint}>{dateHeure(t.createdAt)}</span>
            <div>
              <div className={s.chips}>
                {t.nature === 'retour' ? (
                  <span className={`${s.chip} ${s.chipRed}`}>↺ Retour</span>
                ) : t.nature === 'rejet' ? (
                  <span className={`${s.chip} ${s.chipRed}`}>✕ Rejet</span>
                ) : null}
                <strong>
                  {t.fromEtat ? `${DOSSIER_ETAT_LABELS[t.fromEtat]} → ` : ''}
                  {DOSSIER_ETAT_LABELS[t.toEtat]}
                </strong>
              </div>
              <p className={s.itemFix} style={{ marginTop: 4 }}>
                {t.acteur ? `${t.acteur.displayName} (${ROLE_LABELS[t.acteur.role] ?? t.acteur.role})` : 'Système'}
              </p>
              {t.comment ? <p className={s.itemText} style={{ marginTop: 4 }}>{t.comment}</p> : null}
              <PointsRetour details={t.details} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
