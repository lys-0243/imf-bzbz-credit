'use client';

import { useEffect, useMemo } from 'react';
import {
  computeCf24Ratios,
  computeCf5Totaux,
  type Cf24Data,
  type Cf2Analyse,
  type Cf2RatioRow,
} from '@imf/shared';
import { dashStyles as styles } from './DashboardShell';
import { useFichesOptionnel } from './fiches/FichesPanel';

type Props = {
  analyse: Cf2Analyse;
  devise: string;
  disabled?: boolean;
  busy?: boolean;
  onChange: (next: Cf24Data) => void;
  onSave?: () => void | Promise<void>;
};

function formatNum(n: number): string {
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatRatioResult(row: Cf2RatioRow): string {
  if (row.value == null || !Number.isFinite(row.value)) return '—';
  if (row.asPercent) {
    return `${(row.value * 100).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return row.value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Fraction({
  top,
  bottom,
  topLabel,
  bottomLabel,
}: {
  top: string;
  bottom: string;
  topLabel?: string;
  bottomLabel?: string;
}) {
  return (
    <span className={styles.cf2RatioFraction} title={topLabel && bottomLabel ? `${topLabel} / ${bottomLabel}` : undefined}>
      <span className={styles.cf2RatioFracNum}>{top}</span>
      <span className={styles.cf2RatioFracDen}>{bottom}</span>
    </span>
  );
}

function RatioFunctionRow({
  row,
  devise,
}: {
  row: Cf2RatioRow;
  devise: string;
}) {
  const result = formatRatioResult(row);
  const normeWarn =
    row.ok === false ? styles.cf2RatioNormeWarn : undefined;

  return (
    <tr className={styles.cf2RatioRow}>
      <td className={styles.cf2RatioIndex}>{row.index}.</td>
      <td className={styles.cf2RatioLabel}>{row.label}</td>
      <td className={styles.cf2RatioEq}>=</td>
      <td>
        <Fraction
          top={row.numerateurLabel}
          bottom={row.denominateurLabel}
          topLabel={row.numerateurLabel}
          bottomLabel={row.denominateurLabel}
        />
      </td>
      <td className={styles.cf2RatioEq}>=</td>
      <td>
        <Fraction
          top={`${formatNum(row.numerateur)} ${devise}`}
          bottom={`${formatNum(row.denominateur)} ${devise}`}
        />
      </td>
      <td className={styles.cf2RatioEq}>=</td>
      <td className={styles.cf2RatioResult}>
        <strong>
          {result}
          {row.asPercent && result !== '—' ? ' %' : ''}
        </strong>
      </td>
      <td className={`${styles.cf2RatioNorme} ${normeWarn ?? ''}`.trim()}>
        {row.norme}
      </td>
    </tr>
  );
}

export function Cf24Section({
  analyse,
  devise,
  disabled,
  busy,
  onChange,
  onSave,
}: Props) {
  const cf24 = analyse.cf24;
  // Σ des biens mis en gage = total de la CF5.1 du demandeur (Excel I8 = CF5.1!W28),
  // caution financière calculée sur le montant proposé — comme le scoring et la synthèse.
  const fiches = useFichesOptionnel();
  useEffect(() => {
    fiches?.ensureLoaded();
  }, [fiches]);
  const cf5 = fiches?.forms?.CF5_1_DEMANDEUR ?? null;
  const cautionPct = fiches?.parametres?.conditions.cautionPct;
  const totalCf5 = useMemo(() => {
    if (!fiches) return undefined; // hors fiches : saisie manuelle en repli
    if (fiches.error) return undefined; // fiches indisponibles : saisie manuelle en repli
    if (!cf5 || cautionPct == null) return null; // chargement
    return computeCf5Totaux(cf5, {
      montantPropose: Number(String(analyse.cf25.montantPropose).replace(',', '.')) || 0,
      cautionPct,
    }).total;
  }, [fiches, cf5, cautionPct, analyse.cf25.montantPropose]);
  const ratios = useMemo(
    // CF5.1 connue : son total fait foi, même à 0 (pas de repli sur l'ancienne saisie CF 2.4).
    () => computeCf24Ratios(analyse, totalCf5 != null ? { valeurGaranties: totalCf5 } : {}),
    [analyse, totalCf5],
  );

  function patch(partial: Partial<Cf24Data>) {
    onChange({ ...cf24, ...partial });
  }

  return (
    <>
      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>
            2.9. Calculs &amp; commentaires
          </h3>
          <span className={styles.cf2RatioNormeHeader}>Norme</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={`${styles.detailDataTable} ${styles.cf2RatioTable}`}>
            <tbody>
              {ratios.map((row) => (
                <RatioFunctionRow key={row.key} row={row} devise={devise} />
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.assignHint} style={{ marginTop: 10 }}>
          Valeurs prises automatiquement depuis CF2.5 (mensualité, prêt, CMV,
          capacité, bilan) ; Σ gages depuis la CF5.1.
        </p>
        <div className={styles.tableWrap} style={{ marginTop: 8 }}>
          <table className={`${styles.detailDataTable} ${styles.cf1FormTable}`}>
            <tbody>
              <tr>
                <td className={styles.cf1FormLabel}>
                  Σ des valeurs des biens mis en gage
                </td>
                <td className={styles.cf1FormValue}>
                  {totalCf5 === undefined ? (
                    <div className={styles.cf1AmountField}>
                      <span className={styles.cf1DeviseBadge}>{devise}</span>
                      <input
                        type="number"
                        className={styles.cf1FormControl}
                        value={cf24.valeurGaranties}
                        disabled={disabled}
                        onChange={(e) =>
                          patch({ valeurGaranties: e.target.value })
                        }
                      />
                    </div>
                  ) : (
                    <div>
                      <strong>
                        {totalCf5 == null ? '…' : `${formatNum(totalCf5)} ${devise}`}
                      </strong>
                      <span
                        className={styles.assignHint}
                        style={{ display: 'block', margin: '4px 0 0' }}
                      >
                        {totalCf5 === 0
                          ? 'Aucun bien en CF5.1 — renseignez les biens mis en gage du demandeur.'
                          : 'Total de la CF5.1 — biens mis en gage du demandeur (caution comprise).'}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.detailTableBlock}>
        <h3 className={styles.detailTableTitle}>
          Commentaires de l&apos; AC sur les ratios et le Client
        </h3>
        <textarea
          className={`${styles.cf1FormControl} ${styles.cf2Textarea}`}
          rows={6}
          value={cf24.commentaires}
          disabled={disabled}
          placeholder="L'AC est tenu de donner son avis sur le client et/ou son business, aussi s'il y a des incohérences ou certains détails à surveiller…"
          onChange={(e) => patch({ commentaires: e.target.value })}
        />
      </div>

      {!disabled && onSave ? (
        <div className={styles.descenteFooterActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void onSave()}
            disabled={busy}
          >
            Enregistrer CF2.4
          </button>
        </div>
      ) : null}
    </>
  );
}
