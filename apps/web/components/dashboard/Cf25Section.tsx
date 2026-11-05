'use client';

import { useMemo, type ReactNode } from 'react';
import {
  CF2_CA_SOURCE_LABELS,
  computeBilan,
  computeCompteResultat,
  newCf25Risque,
  resolveMensualite,
  resolveTauxPeriodique,
  type Cf25Data,
  type Cf25Risque,
  type Cf2Analyse,
} from '@imf/shared';
import { dashStyles as styles } from './DashboardShell';

type Props = {
  analyse: Cf2Analyse;
  devise: string;
  disabled?: boolean;
  busy?: boolean;
  onChange: (next: Cf25Data) => void;
  onSave?: () => void | Promise<void>;
};

function FormBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.detailTableBlock}>
      <h3 className={styles.detailTableTitle}>{title}</h3>
      <div className={styles.tableWrap}>
        <table className={`${styles.detailDataTable} ${styles.cf1FormTable}`}>
          <thead>
            <tr>
              <th>Champ</th>
              <th>Valeur</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function FormRow({
  label,
  children,
  total,
}: {
  label: string;
  children: ReactNode;
  /** Ligne de total — fond vert hachuré (charte). */
  total?: boolean;
}) {
  return (
    <tr className={total ? styles.cf2TotalRow : undefined}>
      <td className={styles.cf1FormLabel}>{label}</td>
      <td className={styles.cf1FormValue}>{children}</td>
    </tr>
  );
}

function AmountField({
  value,
  devise,
  disabled,
  onChange,
}: {
  value: string;
  devise: string;
  disabled?: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <div className={styles.cf1AmountField}>
      <span className={styles.cf1DeviseBadge}>{devise}</span>
      <input
        type="number"
        className={styles.cf1FormControl}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function formatMoney(n: number, devise: string): string {
  return `${n.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${devise}`;
}

function formatPct(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

export function Cf25Section({
  analyse,
  devise,
  disabled,
  busy,
  onChange,
  onSave,
}: Props) {
  const cf25 = analyse.cf25;
  const cr = useMemo(() => computeCompteResultat(analyse), [analyse]);
  const bilan = useMemo(() => computeBilan(analyse), [analyse]);
  const mensualiteCalc = useMemo(() => resolveMensualite(cf25), [cf25]);
  const tauxRatio = useMemo(
    () => resolveTauxPeriodique(cf25.tauxPeriodique),
    [cf25.tauxPeriodique],
  );

  function patch(partial: Partial<Cf25Data>) {
    onChange({ ...cf25, ...partial });
  }

  function updateRisque(idx: number, partial: Partial<Cf25Risque>) {
    patch({
      risques: cf25.risques.map((row, i) =>
        i === idx ? { ...row, ...partial } : row,
      ),
    });
  }

  return (
    <>
      <FormBlock title="3.1 Compte de résultat">
        <FormRow label="Chiffre d’affaires / ventes">
          <div>
            <strong>{formatMoney(cr.chiffreAffaires, devise)}</strong>
            <span
              className={styles.assignHint}
              style={{ display: 'block', marginTop: 4 }}
            >
              Source : {CF2_CA_SOURCE_LABELS[cr.chiffreAffairesSource]}
            </span>
          </div>
        </FormRow>
        <FormRow label="Marge retenue">
          <div>
            <strong>{formatPct(cr.margeTousProduits)}</strong>
            <span
              className={styles.assignHint}
              style={{ display: 'block', marginTop: 4 }}
            >
              Source : CF2.3 — marge brute moyenne (tous produits)
            </span>
          </div>
        </FormRow>
        <FormRow label="Coût des marchandises vendues">
          <div>
            <strong>{formatMoney(cr.cmv, devise)}</strong>
            <span
              className={styles.assignHint}
              style={{ display: 'block', marginTop: 4 }}
            >
              CA × (1 − marge retenue
              {cr.margeTousProduits != null
                ? ` = ${formatPct(cr.margeTousProduits)}`
                : ''}
              )
            </span>
          </div>
        </FormRow>
        <FormRow label="Profit brut d’exploitation">
          <strong>{formatMoney(cr.profitBrut, devise)}</strong>
        </FormRow>
        <FormRow label="Dépenses d’exploitation">
          <strong>{formatMoney(cr.depensesExploitation, devise)}</strong>
        </FormRow>
        <FormRow label="Profit net d’exploitation">
          <strong>{formatMoney(cr.profitNetExploitation, devise)}</strong>
        </FormRow>
        <FormRow label="Produits hors exploitation (autres revenus)">
          <strong>{formatMoney(cr.autresRevenus, devise)}</strong>
        </FormRow>
        <FormRow label="Dépenses hors exploitation (privées)">
          <strong>{formatMoney(cr.depensesPrivees, devise)}</strong>
        </FormRow>
        <FormRow label="Profit net (capacité de paiement)">
          <strong>{formatMoney(cr.capacitePaiement, devise)}</strong>
        </FormRow>
        <FormRow label="Commentaires">
          <textarea
            className={styles.cf1FormControl}
            rows={3}
            value={cf25.commentairesCompteResultat}
            disabled={disabled}
            onChange={(e) =>
              patch({ commentairesCompteResultat: e.target.value })
            }
          />
        </FormRow>
      </FormBlock>

      <FormBlock title="3.2 Bilan — actifs circulants">
        <FormRow label="Caisse">
          <div>
            <AmountField
              value={cf25.caisse}
              devise={devise}
              disabled={disabled}
              onChange={(caisse) => patch({ caisse })}
            />
            <span
              className={styles.assignHint}
              style={{ display: 'block', marginTop: 4 }}
            >
              {(cf25.caisse ?? '').trim() === ''
                ? `Sinon espèces CF2.2 → ${formatMoney(bilan.caisse, devise)}`
                : `Retenue : ${formatMoney(bilan.caisse, devise)}`}
            </span>
          </div>
        </FormRow>
        <FormRow label="Banque (CA, SA, FDA)">
          <AmountField
            value={cf25.banque}
            devise={devise}
            disabled={disabled}
            onChange={(banque) => patch({ banque })}
          />
        </FormRow>
        <FormRow label="Créances & prépaiements">
          <AmountField
            value={cf25.creances}
            devise={devise}
            disabled={disabled}
            onChange={(creances) => patch({ creances })}
          />
        </FormRow>
        <FormRow label="Stock">
          <div>
            <AmountField
              value={cf25.stock}
              devise={devise}
              disabled={disabled}
              onChange={(stock) => patch({ stock })}
            />
            <span
              className={styles.assignHint}
              style={{ display: 'block', marginTop: 4 }}
            >
              {(cf25.stock ?? '').trim() === ''
                ? `Sinon stock CF2.2 → ${formatMoney(bilan.stock, devise)}`
                : `Retenu : ${formatMoney(bilan.stock, devise)}`}
            </span>
          </div>
        </FormRow>
        <FormRow label="A. Actifs circulants" total>
          <strong>{formatMoney(bilan.actifsCirculants, devise)}</strong>
        </FormRow>
      </FormBlock>

      <FormBlock title="3.2 Bilan — actifs immobilisés">
        <FormRow label="Meubles">
          <AmountField
            value={cf25.meubles}
            devise={devise}
            disabled={disabled}
            onChange={(meubles) => patch({ meubles })}
          />
        </FormRow>
        <FormRow label="Équipement & outils">
          <AmountField
            value={cf25.equipement}
            devise={devise}
            disabled={disabled}
            onChange={(equipement) => patch({ equipement })}
          />
        </FormRow>
        <FormRow label="Véhicules">
          <AmountField
            value={cf25.vehicules}
            devise={devise}
            disabled={disabled}
            onChange={(vehicules) => patch({ vehicules })}
          />
        </FormRow>
        <FormRow label="Local commercial">
          <AmountField
            value={cf25.localCommercial}
            devise={devise}
            disabled={disabled}
            onChange={(localCommercial) => patch({ localCommercial })}
          />
        </FormRow>
        <FormRow label="Autres (garantie)">
          <AmountField
            value={cf25.autresImmobilises}
            devise={devise}
            disabled={disabled}
            onChange={(autresImmobilises) => patch({ autresImmobilises })}
          />
        </FormRow>
        <FormRow label="B. Actifs immobilisés" total>
          <strong>{formatMoney(bilan.actifsImmobilises, devise)}</strong>
        </FormRow>
        <FormRow label="C. Total actifs (A + B)" total>
          <strong>{formatMoney(bilan.totalActifs, devise)}</strong>
        </FormRow>
      </FormBlock>

      <FormBlock title="3.2 Bilan — passif">
        <FormRow label="Dettes court terme (≤ 3 mois)">
          <AmountField
            value={cf25.dettesCourtTerme}
            devise={devise}
            disabled={disabled}
            onChange={(dettesCourtTerme) => patch({ dettesCourtTerme })}
          />
        </FormRow>
        <FormRow label="Dettes long terme (> 3 mois)">
          <AmountField
            value={cf25.dettesLongTerme}
            devise={devise}
            disabled={disabled}
            onChange={(dettesLongTerme) => patch({ dettesLongTerme })}
          />
        </FormRow>
        <FormRow label="D. Total dettes" total>
          <strong>{formatMoney(bilan.totalDettes, devise)}</strong>
        </FormRow>
        <FormRow label="E. Capital propre (C − D)" total>
          <strong>{formatMoney(bilan.capitalPropre, devise)}</strong>
        </FormRow>
        <FormRow label="F. Total passifs (D + E)" total>
          <strong>{formatMoney(bilan.totalPassifs, devise)}</strong>
        </FormRow>
        <FormRow label="Commentaires bilan">
          <textarea
            className={styles.cf1FormControl}
            rows={3}
            value={cf25.commentairesBilan}
            disabled={disabled}
            onChange={(e) => patch({ commentairesBilan: e.target.value })}
          />
        </FormRow>
      </FormBlock>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>
            3.3 Principaux risques
          </h3>
          {!disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() =>
                patch({ risques: [...cf25.risques, newCf25Risque()] })
              }
            >
              Ajouter
            </button>
          ) : null}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.detailDataTable}>
            <thead>
              <tr>
                <th>Risque</th>
                <th>Mitigation / commentaire</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {cf25.risques.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.titre}
                      disabled={disabled}
                      placeholder={`Risque ${idx + 1}`}
                      onChange={(e) =>
                        updateRisque(idx, { titre: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.mitigation}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRisque(idx, { mitigation: e.target.value })
                      }
                    />
                  </td>
                  {!disabled ? (
                    <td>
                      <button
                        type="button"
                        className={styles.checklistIconBtn}
                        title="Retirer"
                        disabled={cf25.risques.length <= 1}
                        onClick={() =>
                          patch({
                            risques: cf25.risques.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        ✕
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormBlock title="3.4 Proposition du prêt">
        <FormRow label="Montant proposé">
          <AmountField
            value={cf25.montantPropose}
            devise={devise}
            disabled={disabled}
            onChange={(montantPropose) => patch({ montantPropose })}
          />
        </FormRow>
        <FormRow label="Échéance (mois)">
          <input
            type="number"
            className={styles.cf1FormControl}
            value={cf25.echeanceMois}
            disabled={disabled}
            onChange={(e) => patch({ echeanceMois: e.target.value })}
          />
        </FormRow>
        <FormRow label="Taux périodique">
          <div>
            <div className={styles.cf1AmountField}>
              <span className={styles.cf1DeviseBadge}>%</span>
              <input
                type="number"
                step="0.01"
                className={styles.cf1FormControl}
                value={cf25.tauxPeriodique}
                disabled={disabled}
                onChange={(e) => patch({ tauxPeriodique: e.target.value })}
              />
            </div>
            <span
              className={styles.assignHint}
              style={{ display: 'block', marginTop: 4 }}
            >
              Excel S37
              {tauxRatio != null
                ? ` = ${tauxRatio.toLocaleString('fr-FR', {
                    maximumFractionDigits: 4,
                  })}`
                : ''}
            </span>
          </div>
        </FormRow>
        <FormRow label="Mensualité">
          <div>
            <strong>
              {mensualiteCalc > 0
                ? formatMoney(mensualiteCalc, devise)
                : '—'}
            </strong>
            <span
              className={styles.assignHint}
              style={{ display: 'block', marginTop: 4 }}
            >
              Formule de calcul :
              =(D38×(1+S37)^H38×S37)/((1+S37)^H38−1) — D38 = montant proposé,
              H38 = échéance (mois), S37 = taux périodique
            </span>
          </div>
        </FormRow>
        <FormRow label="Date">
          <div>
            <input
              className={styles.cf1FormControl}
              value={cf25.dateProposition}
              disabled
              readOnly
              placeholder="Renseignée à l’enregistrement"
            />
            <span
              className={styles.assignHint}
              style={{ display: 'block', marginTop: 4 }}
            >
              Date et heure posées automatiquement à l’enregistrement de CF2.5
            </span>
          </div>
        </FormRow>
        <FormRow label="Signature de l’agent de crédit">
          <input
            className={styles.cf1FormControl}
            value={cf25.signatureAgent}
            disabled={disabled}
            onChange={(e) => patch({ signatureAgent: e.target.value })}
          />
        </FormRow>
      </FormBlock>

      {!disabled && onSave ? (
        <div className={styles.descenteFooterActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void onSave()}
            disabled={busy}
          >
            Enregistrer CF2.5
          </button>
        </div>
      ) : null}
    </>
  );
}
