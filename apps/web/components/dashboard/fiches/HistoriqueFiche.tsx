'use client';

import {
  arrieresParMensualite,
  computeBilan,
  computeCompteResultat,
  newHistoriqueCycle,
  ratiosDossier,
  type CyclePrecedent,
  type HistoriqueData,
} from '@imf/shared';
import { dashStyles as styles } from '../DashboardShell';
import {
  AddRowButton,
  FormBlock,
  FormRow,
  RemoveRowButton,
  TextArea,
  TextInput,
  formatMoney,
  formatPct,
} from '../FormKit';
import { patchAt, type FicheProps } from './types';

type Colonne = {
  titre: string;
  cr: CyclePrecedent['compteResultat'];
  bilan: CyclePrecedent['bilan'];
  ratios: CyclePrecedent['ratios'];
};

const CR_ROWS: Array<[keyof NonNullable<Colonne['cr']>, string]> = [
  ['chiffreAffaires', 'Chiffre d’affaires / ventes'],
  ['cmv', 'Coût des marchandises vendues'],
  ['profitBrut', 'Profit brut'],
  ['depensesExploitation', 'Dépenses opérationnelles'],
  ['profitNetExploitation', 'Profit net'],
  ['depensesPrivees', 'Total des dépenses privées'],
  ['capacitePaiement', 'Capacité de paiement'],
];

const BILAN_ROWS: Array<[keyof NonNullable<Colonne['bilan']>, string]> = [
  ['actifsCirculants', 'Actifs circulants'],
  ['caisse', 'Caisse'],
  ['banque', 'Banque'],
  ['creances', 'Créances & prépaiements'],
  ['stock', 'Stock'],
  ['actifsImmobilises', 'Actifs immobilisés'],
  ['totalActifs', 'Total actifs'],
  ['dettesCourtTerme', 'Dettes à court terme'],
  ['dettesLongTerme', 'Dettes à long terme'],
  ['capitalPropre', 'Capital propre'],
];

export function HistoriqueFiche({
  value,
  onChange,
  disabled,
  ctx,
  devise,
  cycles,
}: FicheProps<HistoriqueData> & { cycles: CyclePrecedent[] }) {
  const a = ctx.analyse;
  const actuel: Colonne = {
    titre: `Actuel (${ctx.reference})`,
    cr: a ? computeCompteResultat(a) : null,
    bilan: a ? computeBilan(a) : null,
    ratios: ratiosDossier(ctx).map((r) => ({ key: r.key, label: r.label, value: r.value, asPercent: r.asPercent })),
  };
  const colonnes: Colonne[] = [
    actuel,
    ...cycles.map((c) => ({ titre: `${c.reference} (${new Date(c.createdAt).toLocaleDateString('fr-FR')})`, cr: c.compteResultat, bilan: c.bilan, ratios: c.ratios })),
  ];
  const money = (n: number | undefined | null) => (n == null ? '—' : formatMoney(n, devise));
  const ratioKeys = actuel.ratios.length ? actuel.ratios : colonnes.find((c) => c.ratios.length)?.ratios ?? [];

  const tableau = (titre: string, rows: Array<[string, string]>, get: (c: Colonne, k: string) => string) => (
    <div className={styles.detailTableBlock}>
      <h3 className={styles.detailTableTitle}>{titre}</h3>
      <div className={styles.tableWrap}>
        <table className={styles.detailDataTable}>
          <thead>
            <tr>
              <th />
              {colonnes.map((c) => (
                <th key={c.titre}>{c.titre}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, label]) => (
              <tr key={k}>
                <td>{label}</td>
                {colonnes.map((c) => (
                  <td key={c.titre}>{get(c, k)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      {cycles.length === 0 ? (
        <p className={styles.assignHint}>Aucun cycle précédent enregistré pour ce client sur la plateforme.</p>
      ) : null}
      {tableau('1. Cash flow', CR_ROWS, (c, k) => money(c.cr?.[k as keyof NonNullable<Colonne['cr']>]))}
      {tableau('2. Bilan', BILAN_ROWS, (c, k) => money(c.bilan?.[k as keyof NonNullable<Colonne['bilan']>]))}
      {tableau(
        '3. Ratios',
        ratioKeys.map((r) => [r.key, r.label] as [string, string]),
        (c, k) => {
          const r = c.ratios.find((x) => x.key === k);
          if (!r || r.value == null) return '—';
          return r.asPercent ? formatPct(r.value) : r.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
        },
      )}

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>4. Historique de crédit et de retard de paiement</h3>
          {!disabled ? (
            <AddRowButton onClick={() => onChange({ ...value, cycles: [...value.cycles, newHistoriqueCycle()] })} />
          ) : null}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.detailDataTable}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Montant déboursé</th>
                <th>Mensualité</th>
                <th>Échéances approuvées</th>
                <th>Échéance réelle de paiement</th>
                <th>Total jours d’arriérés</th>
                <th>Arriérés par mensualité</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {value.cycles.map((c, i) => {
                const set = (patch: Partial<typeof c>) => onChange({ ...value, cycles: patchAt(value.cycles, i, patch) });
                const parMens = arrieresParMensualite(c);
                return (
                  <tr key={c.id}>
                    <td><TextInput value={c.reference} disabled={disabled} onChange={(reference) => set({ reference })} /></td>
                    <td><TextInput type="number" value={c.montantDebourse} disabled={disabled} onChange={(montantDebourse) => set({ montantDebourse })} /></td>
                    <td><TextInput type="number" value={c.mensualite} disabled={disabled} onChange={(mensualite) => set({ mensualite })} /></td>
                    <td><TextInput type="number" value={c.echeancesApprouvees} disabled={disabled} onChange={(echeancesApprouvees) => set({ echeancesApprouvees })} /></td>
                    <td><TextInput value={c.echeanceReellePaiement} disabled={disabled} onChange={(echeanceReellePaiement) => set({ echeanceReellePaiement })} /></td>
                    <td><TextInput type="number" value={c.totalJoursArrieres} disabled={disabled} onChange={(totalJoursArrieres) => set({ totalJoursArrieres })} /></td>
                    <td>{parMens == null ? '—' : parMens.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</td>
                    {!disabled ? (
                      <td>
                        <RemoveRowButton onClick={() => onChange({ ...value, cycles: value.cycles.filter((_, j) => j !== i) })} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FormBlock title="Commentaire">
        <FormRow label="Observations sur l’historique">
          <TextArea value={value.commentaire} disabled={disabled} onChange={(commentaire) => onChange({ ...value, commentaire })} />
        </FormRow>
      </FormBlock>
    </>
  );
}
