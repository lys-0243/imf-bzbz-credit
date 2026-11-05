'use client';

import {
  GARANTIE_TYPE_LABELS,
  GARANTIE_TYPES,
  computeCf5Totaux,
  newCf5Bien,
  valeurBien,
  type Cf5Data,
  type GarantieEtat,
} from '@imf/shared';
import { dashStyles as styles } from '../DashboardShell';
import {
  AddRowButton,
  FormBlock,
  FormRow,
  RemoveRowButton,
  SelectInput,
  TextInput,
  formatMoney,
} from '../FormKit';
import { patchAt, type FicheProps } from './types';

const ETAT_OPTIONS: Array<{ value: GarantieEtat; label: string }> = [
  { value: '', label: '—' },
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'BON', label: 'Bon' },
  { value: 'MAUVAIS', label: 'Mauvais' },
];

const TYPE_OPTIONS = [
  { value: '' as const, label: '—' },
  ...GARANTIE_TYPES.map((t) => ({ value: t, label: `${t} — ${GARANTIE_TYPE_LABELS[t]}` })),
];

export function Cf5Fiche({
  value,
  onChange,
  disabled,
  ctx,
  devise,
  proprietaire,
}: FicheProps<Cf5Data> & { proprietaire: 'demandeur' | 'garant' }) {
  const calc = {
    montantPropose: Number(ctx.analyse?.cf25.montantPropose) || 0,
    cautionPct: ctx.parametres.conditions.cautionPct,
  };
  const totaux = computeCf5Totaux(value, calc);
  const set = (i: number, patch: Partial<Cf5Data['biens'][number]>) =>
    onChange({ ...value, biens: patchAt(value.biens, i, patch) });

  return (
    <>
      <p className={styles.assignHint}>
        Évaluation de la garantie du {proprietaire}.
        {proprietaire === 'demandeur'
          ? ' Le total alimente le ratio de garantie CF 2.4 (Excel CF2.4 I8 = CF5.1 W28).'
          : ''}
      </p>
      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>Biens mis en gage</h3>
          {!disabled ? (
            <AddRowButton onClick={() => onChange({ ...value, biens: [...value.biens, newCf5Bien()] })} />
          ) : null}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.detailDataTable}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Description (couleur, modèle, n° de série)</th>
                <th>Date de fabrication</th>
                <th>État</th>
                <th>Prix d’achat</th>
                <th>Valeur marchande estimée</th>
                <th>Source</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {value.biens.map((b, i) => {
                const auto = b.auto === 'CAUTION_FINANCIERE';
                return (
                  <tr key={b.id}>
                    <td>
                      <SelectInput value={b.type} options={TYPE_OPTIONS} disabled={disabled || auto} onChange={(type) => set(i, { type })} />
                    </td>
                    <td><TextInput value={b.description} disabled={disabled || auto} onChange={(description) => set(i, { description })} /></td>
                    <td><TextInput value={b.dateFabrication} disabled={disabled} onChange={(dateFabrication) => set(i, { dateFabrication })} /></td>
                    <td><SelectInput value={b.etat} options={ETAT_OPTIONS} disabled={disabled} onChange={(etat) => set(i, { etat })} /></td>
                    <td><TextInput type="number" value={b.prixAchat} disabled={disabled || auto} onChange={(prixAchat) => set(i, { prixAchat })} /></td>
                    <td>
                      {auto ? (
                        <span title={`${Math.round(calc.cautionPct * 100)} % du montant proposé (CF 2.5)`}>
                          {formatMoney(valeurBien(b, calc), devise)} (calculée)
                        </span>
                      ) : (
                        <TextInput type="number" value={b.valeurMarchande} disabled={disabled} onChange={(valeurMarchande) => set(i, { valeurMarchande })} />
                      )}
                    </td>
                    <td><TextInput value={b.source} disabled={disabled} onChange={(source) => set(i, { source })} /></td>
                    {!disabled ? (
                      <td>
                        <RemoveRowButton onClick={() => onChange({ ...value, biens: value.biens.filter((_, j) => j !== i) })} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              <tr className={styles.cf2TotalRow}>
                <td colSpan={5}>Total</td>
                <td>{formatMoney(totaux.total, devise)}</td>
                <td colSpan={disabled ? 1 : 2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <FormBlock title="Totaux par type de garantie">
        {GARANTIE_TYPES.map((t) => (
          <FormRow key={t} label={`${t} — ${GARANTIE_TYPE_LABELS[t]}`}>
            {formatMoney(totaux.parType[t], devise)}
          </FormRow>
        ))}
      </FormBlock>

      <FormBlock title="Signatures">
        <FormRow label="Propriétaire de la garantie">
          <TextInput value={value.signatures.proprietaire} disabled={disabled} onChange={(proprietaire) => onChange({ ...value, signatures: { ...value.signatures, proprietaire } })} />
        </FormRow>
        <FormRow label="Conjoint(e) du propriétaire">
          <TextInput value={value.signatures.conjoint} disabled={disabled} onChange={(conjoint) => onChange({ ...value, signatures: { ...value.signatures, conjoint } })} />
        </FormRow>
        <FormRow label="Témoin">
          <TextInput value={value.signatures.temoin} disabled={disabled} onChange={(temoin) => onChange({ ...value, signatures: { ...value.signatures, temoin } })} />
        </FormRow>
        <FormRow label="Agent de crédit">
          <TextInput value={value.signatures.agent} disabled={disabled} onChange={(agent) => onChange({ ...value, signatures: { ...value.signatures, agent } })} />
        </FormRow>
        <FormRow label="Date">
          <TextInput type="date" value={value.signatures.date} disabled={disabled} onChange={(date) => onChange({ ...value, signatures: { ...value.signatures, date } })} />
        </FormRow>
      </FormBlock>
    </>
  );
}
