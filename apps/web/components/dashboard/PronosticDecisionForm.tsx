'use client';

import { useRef, useState } from 'react';
import {
  PRONOSTIC_RECOMMANDATIONS,
  PRONOSTIC_RECOMMANDATION_LABELS,
  decisionDiverge,
  type PronosticRecommandation,
} from '@imf/shared';
import { dashStyles as styles } from './DashboardShell';
import type { PronosticView } from './PronosticPanel';

/**
 * Décision humaine au vu du pronostic (agent avant soumission, puis RC) :
 * pré-remplie avec l'avis et le montant proposés par l'IA, modifiable.
 */
export function usePronosticDecision() {
  const [pronostic, setPronostic] = useState<PronosticView | null>(null);
  const [recommandation, setRecommandation] =
    useState<PronosticRecommandation>('ACCORD_CONDITIONNEL');
  const [montantRetenu, setMontantRetenu] = useState('');
  const [dureeRetenue, setDureeRetenue] = useState('');
  const [commentaire, setCommentaire] = useState('');
  /** Pronostic ayant servi au pré-remplissage : ne pas écraser les saisies. */
  const prefilledId = useRef<string | null>(null);

  function onPronostic(p: PronosticView | null) {
    setPronostic(p);
    if (!p || p.id === prefilledId.current) return;
    prefilledId.current = p.id;
    setRecommandation(p.avis.recommandation);
    setMontantRetenu(
      p.avis.montantSuggere != null ? String(p.avis.montantSuggere) : '',
    );
    setDureeRetenue(
      p.avis.dureeSuggereeMois != null ? String(p.avis.dureeSuggereeMois) : '',
    );
  }

  function reset() {
    setPronostic(null);
    setCommentaire('');
    prefilledId.current = null;
  }

  const montantRetenuNum =
    recommandation === 'REFUS' || montantRetenu.trim() === ''
      ? null
      : Number(montantRetenu.replace(',', '.'));
  const diverge = pronostic
    ? decisionDiverge(pronostic.avis, {
        recommandation,
        montantRetenu: Number.isFinite(montantRetenuNum) ? montantRetenuNum : null,
      })
    : false;

  /** Message d'erreur si la décision est incomplète, sinon `null`. */
  function validate(opts: { montantObligatoire?: boolean } = {}): string | null {
    if (montantRetenuNum != null && !Number.isFinite(montantRetenuNum)) {
      return 'Montant retenu invalide';
    }
    if (opts.montantObligatoire && recommandation !== 'REFUS' && montantRetenuNum == null) {
      return 'Indiquez le montant retenu';
    }
    if (diverge && !commentaire.trim()) {
      return 'Expliquez pourquoi votre décision s’écarte de l’avis IA';
    }
    return null;
  }

  /** Corps JSON attendu par les endpoints de soumission. */
  function body() {
    const duree = Number.parseInt(dureeRetenue, 10);
    return {
      recommandation,
      ...(montantRetenuNum != null ? { montantRetenu: montantRetenuNum } : {}),
      ...(Number.isFinite(duree) && duree > 0 ? { dureeRetenueMois: duree } : {}),
      ...(commentaire.trim() ? { commentaire: commentaire.trim() } : {}),
    };
  }

  return {
    pronostic,
    onPronostic,
    reset,
    recommandation,
    setRecommandation,
    montantRetenu,
    setMontantRetenu,
    dureeRetenue,
    setDureeRetenue,
    commentaire,
    setCommentaire,
    diverge,
    validate,
    body,
  };
}

export type PronosticDecision = ReturnType<typeof usePronosticDecision>;

export function PronosticDecisionFields({
  decision,
  disabled,
  idPrefix,
}: {
  decision: PronosticDecision;
  disabled?: boolean;
  idPrefix: string;
}) {
  const refus = decision.recommandation === 'REFUS';
  return (
    <>
      <div className={styles.pronosticDecisionGrid}>
        <label className={styles.assignMeta}>
          Votre décision
          <select
            className={styles.pronosticInput}
            value={decision.recommandation}
            onChange={(e) =>
              decision.setRecommandation(e.target.value as PronosticRecommandation)
            }
            disabled={disabled}
          >
            {PRONOSTIC_RECOMMANDATIONS.map((r) => (
              <option key={r} value={r}>
                {PRONOSTIC_RECOMMANDATION_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.assignMeta}>
          Montant retenu
          <input
            className={styles.pronosticInput}
            inputMode="decimal"
            value={decision.montantRetenu}
            onChange={(e) => decision.setMontantRetenu(e.target.value)}
            disabled={disabled || refus}
          />
        </label>
        <label className={styles.assignMeta}>
          Durée retenue (mois)
          <input
            className={styles.pronosticInput}
            inputMode="numeric"
            value={decision.dureeRetenue}
            onChange={(e) => decision.setDureeRetenue(e.target.value)}
            disabled={disabled || refus}
          />
        </label>
      </div>
      <label className={styles.assignMeta} htmlFor={`${idPrefix}-commentaire`}>
        {decision.diverge
          ? 'Commentaire (obligatoire : votre décision s’écarte de l’avis IA)'
          : 'Commentaire de décision (facultatif)'}
      </label>
      <textarea
        id={`${idPrefix}-commentaire`}
        className={styles.assignTextarea}
        rows={2}
        value={decision.commentaire}
        onChange={(e) => decision.setCommentaire(e.target.value)}
        disabled={disabled}
        placeholder="Justification, conditions retenues…"
      />
    </>
  );
}
