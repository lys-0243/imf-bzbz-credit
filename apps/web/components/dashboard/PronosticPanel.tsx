'use client';

import { useEffect, useState } from 'react';
import {
  PRONOSTIC_RECOMMANDATION_LABELS,
  formatMontantSouhaite,
  type DossierFacts,
  type EvaluationProposition,
  type PronosticAvis,
  type PronosticRecommandation,
  type RatioFait,
  NOM_ASSISTANT_IA,
} from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { dashStyles as styles } from './DashboardShell';

export type PronosticView = {
  id: string;
  source: 'IA' | 'REGLES';
  modele: string | null;
  avis: PronosticAvis;
  facts: DossierFacts;
  /** Ratios recalculés sur le montant proposé (absent sur les anciens pronostics). */
  evaluation?: EvaluationProposition | null;
  ajuste: boolean;
  erreurIa: string | null;
  createdAt: string;
  validationAgent?: {
    pronosticId: string | null;
    recommandation: PronosticRecommandation;
    montantRetenu: number | null;
    dureeRetenueMois: number | null;
    accordAvecIa: boolean | null;
    commentaire: string | null;
    createdAt: string;
  } | null;
};

const CONFIANCE_LABELS: Record<PronosticAvis['confiance'], string> = {
  FAIBLE: 'faible',
  MOYENNE: 'moyenne',
  ELEVEE: 'élevée',
};

function recommandationClass(r: PronosticRecommandation): string {
  if (r === 'ACCORD') return styles.badgeOk;
  if (r === 'REFUS') return `${styles.badge} ${styles.badgeWarn}`;
  return styles.badge;
}

function formatRatio(valeur: number | null, enPourcentage: boolean): string {
  if (valeur == null) return '—';
  return enPourcentage
    ? `${(valeur * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
    : valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className={styles.pronosticListTitle}>{title}</h3>
      <ul className={styles.pronosticList}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function RatioTable({ title, ratios }: { title: string; ratios: RatioFait[] }) {
  if (!ratios.length) return null;
  return (
    <table className={styles.detailDataTable}>
      <thead>
        <tr>
          <th>{title}</th>
          <th>Valeur</th>
          <th>Norme</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        {ratios.map((r) => (
          <tr key={r.key}>
            <td>{r.label}</td>
            <td>{formatRatio(r.valeur, r.enPourcentage)}</td>
            <td>{r.norme}</td>
            <td>
              {r.respecte == null ? (
                '—'
              ) : r.respecte ? (
                <span className={styles.badgeOk}>Conforme</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeWarn}`}>
                  Hors norme
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Avis IA consultatif : la décision reste humaine. */
export function PronosticPanel({
  dossierId,
  canRegenerate = false,
  onChange,
  endpoint,
  beforeGenerate,
}: {
  dossierId: string;
  canRegenerate?: boolean;
  onChange?: (pronostic: PronosticView | null) => void;
  /** Défaut : `/scoring/dossiers/:id/pronostic` (agent : `/agent/dossiers/:id/pronostic`). */
  endpoint?: string;
  /** Exécuté avant la génération (ex. enregistrer la checklist et le rapport). */
  beforeGenerate?: () => Promise<void>;
}) {
  const url = endpoint ?? `/scoring/dossiers/${dossierId}/pronostic`;
  const [pronostic, setPronostic] = useState<PronosticView | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(p: PronosticView | null) {
    setPronostic(p);
    onChange?.(p);
  }

  useEffect(() => {
    let cancelled = false;
    setPronostic(undefined);
    (async () => {
      try {
        const p = await apiFetch<PronosticView | null>(url);
        if (!cancelled) update(p ?? null);
      } catch (e) {
        if (!cancelled) {
          update(null);
          setError(e instanceof ApiError ? e.message : 'Avis indisponible');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      await beforeGenerate?.();
      const p = await apiFetch<PronosticView>(url, { method: 'POST' });
      update(p);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Génération impossible');
    } finally {
      setBusy(false);
    }
  }

  const regenerateBtn = canRegenerate ? (
    <button
      type="button"
      className={`${styles.btn} ${styles.btnSecondary}`}
      disabled={busy}
      onClick={regenerate}
    >
      {busy ? 'Analyse en cours…' : pronostic ? 'Régénérer l’avis' : 'Générer l’avis'}
    </button>
  ) : null;

  if (pronostic === undefined) {
    return (
      <div className={styles.assignPanel}>
        <h2 className={styles.assignTitle}>Avis IA</h2>
        <p className={styles.assignHint}>Chargement de l’avis…</p>
      </div>
    );
  }

  if (!pronostic) {
    return (
      <div className={styles.assignPanel}>
        <h2 className={styles.assignTitle}>Avis IA</h2>
        <p className={styles.assignHint}>
          Aucun avis n’a encore été généré pour ce dossier.
        </p>
        {regenerateBtn}
        {error ? <p className={styles.listError}>{error}</p> : null}
      </div>
    );
  }

  const { avis, facts } = pronostic;
  const evaluation = pronostic.evaluation ?? null;
  const devise = facts.demande.devise;
  const montantMax =
    evaluation?.montantMax ??
    facts.referenceIa?.montantMaxConseille ??
    facts.proposition.montantMaxConseille;
  const validation = pronostic.validationAgent ?? null;

  return (
    <div className={styles.assignPanel}>
      <div className={styles.pronosticHead}>
        <h2 className={styles.assignTitle}>
          Avis IA (consultatif){' '}
          <span className={recommandationClass(avis.recommandation)}>
            {PRONOSTIC_RECOMMANDATION_LABELS[avis.recommandation]}
          </span>
        </h2>
        {regenerateBtn}
      </div>
      <p className={styles.assignMeta}>
        {pronostic.source === 'IA'
          ? `Généré par ${NOM_ASSISTANT_IA}`
          : `Généré par les règles CF 2.4 (${NOM_ASSISTANT_IA} indisponible)`}
        {` · confiance ${CONFIANCE_LABELS[avis.confiance]} · ${new Date(
          pronostic.createdAt,
        ).toLocaleString('fr-FR')}`}
        {pronostic.ajuste ? ' · montant ajusté par les garde-fous' : ''}
      </p>

      <div className={styles.pronosticFigures}>
        <div className={styles.pronosticFigure}>
          <span className={styles.pronosticFigureLabel}>Montant suggéré</span>
          <span className={styles.pronosticFigureValue}>
            {formatMontantSouhaite(avis.montantSuggere, devise)}
          </span>
        </div>
        <div className={styles.pronosticFigure}>
          <span className={styles.pronosticFigureLabel}>Durée suggérée</span>
          <span className={styles.pronosticFigureValue}>
            {avis.dureeSuggereeMois ? `${avis.dureeSuggereeMois} mois` : '—'}
          </span>
        </div>
        <div className={styles.pronosticFigure}>
          <span className={styles.pronosticFigureLabel}>
            Maximum conseillé (DSR 40 %)
          </span>
          <span className={styles.pronosticFigureValue}>
            {formatMontantSouhaite(montantMax, devise)}
          </span>
        </div>
        {evaluation?.mensualite != null ? (
          <div className={styles.pronosticFigure}>
            <span className={styles.pronosticFigureLabel}>Mensualité</span>
            <span className={styles.pronosticFigureValue}>
              {formatMontantSouhaite(evaluation.mensualite, devise)}
            </span>
          </div>
        ) : null}
        <div className={styles.pronosticFigure}>
          <span className={styles.pronosticFigureLabel}>Montant demandé</span>
          <span className={styles.pronosticFigureValue}>
            {formatMontantSouhaite(facts.demande.montant, devise)}
          </span>
        </div>
      </div>

      <p className={styles.pronosticText}>{avis.justification}</p>

      <div className={styles.pronosticLists}>
        <List title="Conditions proposées" items={avis.conditions} />
        <List title="Points forts" items={avis.pointsForts} />
        <List title="Points de vigilance" items={avis.pointsVigilance} />
      </div>

      {evaluation ? (
        <RatioTable
          title="Ratios sur le montant proposé (IA)"
          ratios={evaluation.ratios}
        />
      ) : null}
      <RatioTable
        title={
          evaluation
            ? 'Ratios sur la proposition de l’agent (CF 2.5)'
            : 'Ratio CF 2.4'
        }
        ratios={facts.ratios}
      />

      {validation ? (
        <div>
          <h3 className={styles.pronosticListTitle}>Validation de l’agent</h3>
          <p className={styles.assignMeta}>
            {PRONOSTIC_RECOMMANDATION_LABELS[validation.recommandation]}
            {validation.montantRetenu != null
              ? ` · ${formatMontantSouhaite(validation.montantRetenu, devise)}`
              : ''}
            {validation.dureeRetenueMois ? ` · ${validation.dureeRetenueMois} mois` : ''}
            {validation.accordAvecIa === false
              ? ' · s’écarte de l’avis IA'
              : validation.accordAvecIa
                ? ' · conforme à l’avis IA'
                : ''}
            {` · ${new Date(validation.createdAt).toLocaleString('fr-FR')}`}
            {validation.pronosticId && validation.pronosticId !== pronostic.id
              ? ' · validée sur un avis antérieur'
              : ''}
          </p>
          {validation.commentaire ? (
            <p className={styles.pronosticText}>{validation.commentaire}</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className={styles.listError}>{error}</p> : null}
    </div>
  );
}
