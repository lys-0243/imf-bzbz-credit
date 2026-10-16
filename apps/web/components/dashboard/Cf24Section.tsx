'use client';

import { useMemo } from 'react';
import {
  computeCf24Ratios,
  type Cf24Data,
  type Cf2Analyse,
  type Cf2RatioRow,
} from '@imf/shared';
import { dashStyles as styles } from './DashboardShell';

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
  const ratios = useMemo(() => computeCf24Ratios(analyse), [analyse]);

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
          capacité, bilan). Σ gages : saisie manuelle en attendant CF5.1.
        </p>
        <div className={styles.tableWrap} style={{ marginTop: 8 }}>
          <table className={`${styles.detailDataTable} ${styles.cf1FormTable}`}>
            <tbody>
              <tr>
                <td className={styles.cf1FormLabel}>
                  Σ des valeurs des biens mis en gage
                </td>
                <td className={styles.cf1FormValue}>
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
