'use client';

import { etapeDeEtat, PARCOURS_ETAPES, type DossierEtat, type ParcoursEtapeKey } from '@imf/shared';
import { dateCourte, type DossierPoste } from '../../lib/poste';
import s from './poste.module.css';

type Statut = 'fait' | 'courant' | 'avenir' | 'saute' | 'rejet';

function cleEtape(etat: DossierEtat | null): ParcoursEtapeKey | null {
  if (!etat) return null;
  if (etat === 'ENREGISTRE') return 'RECEPTION';
  if (etat === 'A_DECAISSER' || etat === 'REJETE') return 'CLOTURE';
  return etapeDeEtat(etat);
}

export function ParcoursStepper({ d }: { d: DossierPoste }) {
  const ordre = PARCOURS_ETAPES.map((e) => e.key);
  const courant = cleEtape(d.etat) ?? 'RECEPTION';
  const iCourant = ordre.indexOf(courant);
  const passeConseil = d.etat === 'CONSEIL' || d.transitions.some((t) => t.toEtat === 'CONSEIL');
  const conseilApplicable =
    passeConseil ||
    (d.etat !== 'A_DECAISSER' &&
      d.etat !== 'REJETE' &&
      d.seuil.montantUsd != null &&
      d.seuil.montantUsd > d.seuil.seuilConseilUsd);
  const rejet = d.transitions.find((t) => t.toEtat === 'REJETE');
  const iRejet = rejet ? ordre.indexOf(cleEtape(rejet.fromEtat) ?? 'CLOTURE') : -1;

  const etapes = PARCOURS_ETAPES.map((e, i) => {
    let statut: Statut;
    if (d.etat === 'REJETE') {
      statut = e.key === 'CLOTURE' ? 'rejet' : i <= iRejet ? 'fait' : 'saute';
    } else if (i < iCourant) statut = 'fait';
    else if (i === iCourant) statut = e.key === 'CLOTURE' ? 'fait' : 'courant';
    else statut = 'avenir';
    if (e.key === 'CONSEIL' && !conseilApplicable && statut !== 'courant') statut = 'saute';

    const sortie = [...d.transitions]
      .reverse()
      .find((t) => cleEtape(t.fromEtat) === e.key && t.nature !== 'retour' && cleEtape(t.toEtat) !== e.key);
    const retours = d.transitions.filter((t) => t.nature === 'retour' && cleEtape(t.toEtat) === e.key).length;
    let meta = '';
    if (statut === 'courant') {
      const jours = Math.floor((Date.now() - new Date(d.etatDepuis).getTime()) / 86_400_000);
      meta = jours ? `en cours · ${jours} j` : 'en cours';
    } else if (e.key === 'RECEPTION') {
      meta = dateCourte(d.createdAt);
    } else if (sortie && statut === 'fait') {
      meta = `${sortie.acteur?.displayName?.split(' ')[0] ?? ''} · ${dateCourte(sortie.createdAt)}`;
    } else if (statut === 'saute' && e.key === 'CONSEIL') {
      meta = `≤ ${d.seuil.seuilConseilUsd} $`;
    } else if (statut === 'rejet') {
      meta = rejet ? dateCourte(rejet.createdAt) : '';
    }
    return { ...e, statut, meta, retours };
  });

  const cls: Record<Statut, string> = {
    fait: s.stepDone,
    courant: s.stepCurrent,
    avenir: '',
    saute: s.stepSkip,
    rejet: s.stepRejet,
  };

  return (
    <ol className={s.stepper} aria-label="Parcours du dossier">
      {etapes.map((e, i) => (
        <li key={e.key} className={`${s.step} ${cls[e.statut]}`} aria-current={e.statut === 'courant' ? 'step' : undefined}>
          <span className={s.stepDot} aria-hidden>
            {e.statut === 'fait' ? '✓' : e.statut === 'rejet' ? '✕' : i + 1}
          </span>
          <span className={s.stepLabel}>{e.statut === 'rejet' ? 'Rejeté' : e.label}</span>
          {e.meta ? <span className={s.stepMeta}>{e.meta}</span> : null}
          {e.retours ? <span className={s.stepReturn}>↺ {e.retours} retour(s)</span> : null}
        </li>
      ))}
    </ol>
  );
}
