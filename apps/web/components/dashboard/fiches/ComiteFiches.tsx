'use client';

import {
  DECISION_COMITE_LABELS,
  computeConditionsDeboursement,
  conditionsPret,
  demandeInitiale,
  newMembreComite,
  requiertApprobationCa,
  type ApproPcaData,
  type DecisionComiteData,
  type MembreComite,
} from '@imf/shared';
import { dashStyles as styles } from '../DashboardShell';
import {
  AddRowButton,
  FormBlock,
  FormRow,
  RemoveRowButton,
  SelectInput,
  TextArea,
  TextInput,
  formatMoney,
  formatPct,
  optionsFromLabels,
} from '../FormKit';
import { numOrNull, patchAt, type FicheProps } from './types';

function MembresTable({
  title,
  membres,
  disabled,
  onChange,
}: {
  title: string;
  membres: MembreComite[];
  disabled: boolean;
  onChange: (next: MembreComite[]) => void;
}) {
  return (
    <div className={styles.detailTableBlock}>
      <div className={styles.cf2TableHeader}>
        <h3 className={styles.detailTableTitle}>{title}</h3>
        {!disabled ? <AddRowButton onClick={() => onChange([...membres, newMembreComite()])} /> : null}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.detailDataTable}>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Position</th>
              <th>Signature</th>
              {!disabled ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {membres.length === 0 ? (
              <tr>
                <td colSpan={disabled ? 3 : 4}>—</td>
              </tr>
            ) : null}
            {membres.map((m, i) => (
              <tr key={m.id}>
                <td><TextInput value={m.nom} disabled={disabled} onChange={(nom) => onChange(patchAt(membres, i, { nom }))} /></td>
                <td><TextInput value={m.position} disabled={disabled} onChange={(position) => onChange(patchAt(membres, i, { position }))} /></td>
                <td />
                {!disabled ? (
                  <td>
                    <RemoveRowButton onClick={() => onChange(membres.filter((_, j) => j !== i))} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** « Décision du comité » — PV du comité de crédit. */
export function DecisionComiteFiche({ value, onChange, disabled, ctx, devise }: FicheProps<DecisionComiteData>) {
  const montant = numOrNull(value.montantApprouve);
  const frais = montant ? computeConditionsDeboursement(montant, ctx.parametres) : null;
  const conditions = conditionsPret({ ...ctx, formulaires: { ...ctx.formulaires, DECISION_COMITE: value } });
  const money = (n: number | null | undefined) => (n == null ? '—' : formatMoney(n, devise));
  const seuil = ctx.parametres.seuilApprobationCa;

  return (
    <>
      <FormBlock title="PV du comité de crédit">
        <FormRow label="Agence">
          <TextInput value={value.agence} disabled={disabled} onChange={(agence) => onChange({ ...value, agence })} />
        </FormRow>
        <FormRow label="Date du comité de crédit">
          <TextInput type="date" value={value.dateComite} disabled={disabled} onChange={(dateComite) => onChange({ ...value, dateComite })} />
        </FormRow>
        <FormRow label="Date de déboursement">
          <TextInput type="date" value={value.dateDeboursement} disabled={disabled} onChange={(dateDeboursement) => onChange({ ...value, dateDeboursement })} />
        </FormRow>
        <FormRow label="N° de crédit">
          <TextInput value={value.numeroCredit} disabled={disabled} onChange={(numeroCredit) => onChange({ ...value, numeroCredit })} />
        </FormRow>
        <FormRow label="N° découvert bancaire">
          <TextInput value={value.numeroDecouvert} disabled={disabled} onChange={(numeroDecouvert) => onChange({ ...value, numeroDecouvert })} />
        </FormRow>
      </FormBlock>

      <FormBlock title="Décision">
        <FormRow label="Décision du comité">
          <SelectInput value={value.decision} options={optionsFromLabels(DECISION_COMITE_LABELS)} disabled={disabled} onChange={(decision) => onChange({ ...value, decision })} />
        </FormRow>
        <FormRow label="Montant approuvé">
          <TextInput type="number" value={value.montantApprouve} disabled={disabled} onChange={(montantApprouve) => onChange({ ...value, montantApprouve })} />
        </FormRow>
        <FormRow label="Durée (mois)">
          <TextInput type="number" value={value.dureeMois} disabled={disabled} onChange={(dureeMois) => onChange({ ...value, dureeMois })} />
        </FormRow>
        <FormRow label="Taux mensuel (vide = grille)">
          <TextInput value={value.tauxMensuel} disabled={disabled} placeholder={formatPct(conditions.tauxMensuel, 2)} onChange={(tauxMensuel) => onChange({ ...value, tauxMensuel })} />
        </FormRow>
        <FormRow label="Mensualité / total remboursé">
          {money(conditions.mensualite)} / {money(conditions.totalRembourse)}
        </FormRow>
        {montant && requiertApprobationCa(montant, ctx.parametres) ? (
          <FormRow label="Approbation">
            <span className={`${styles.badge} ${styles.badgeWarn}`}>
              Montant supérieur à {money(seuil)} : approbation du Conseil d’administration requise
            </span>
          </FormRow>
        ) : null}
        <FormRow label="Observations du comité">
          <TextArea rows={4} value={value.observations} disabled={disabled} onChange={(observations) => onChange({ ...value, observations })} />
        </FormRow>
        <FormRow label="Raisons du rejet ou du report">
          <TextArea rows={3} value={value.raisonsRejetReport} disabled={disabled} onChange={(raisonsRejetReport) => onChange({ ...value, raisonsRejetReport })} />
        </FormRow>
      </FormBlock>

      <FormBlock title="Conditions de déboursement (paramètres IMF)">
        <FormRow label={`Caution (${formatPct(ctx.parametres.conditions.cautionPct, 0)})`}>{money(frais?.caution)}</FormRow>
        <FormRow label={`Frais de dossier (${formatPct(ctx.parametres.conditions.fraisDossierPct, 1)})`}>{money(frais?.fraisDossier)}</FormRow>
        <FormRow label={`Frais de décaissement (${formatPct(ctx.parametres.conditions.fraisDecaissementPct, 1)})`}>{money(frais?.fraisDecaissement)}</FormRow>
        <FormRow label={`TVA (${formatPct(ctx.parametres.conditions.tvaPct, 0)} des frais)`}>{money(frais?.tva)}</FormRow>
        <FormRow label="SMS alerte (par mois)">{money(frais?.smsMensuel ?? ctx.parametres.conditions.smsMensuel)}</FormRow>
      </FormBlock>

      <MembresTable title="Comité de crédit — membres votants" membres={value.comiteCredit.votants} disabled={disabled} onChange={(votants) => onChange({ ...value, comiteCredit: { ...value.comiteCredit, votants } })} />
      <MembresTable title="Comité de crédit — membres participants" membres={value.comiteCredit.participants} disabled={disabled} onChange={(participants) => onChange({ ...value, comiteCredit: { ...value.comiteCredit, participants } })} />
      <MembresTable title="Comité de gestion — membres votants" membres={value.comiteGestion.votants} disabled={disabled} onChange={(votants) => onChange({ ...value, comiteGestion: { ...value.comiteGestion, votants } })} />
      <MembresTable title="Comité de gestion — membres participants" membres={value.comiteGestion.participants} disabled={disabled} onChange={(participants) => onChange({ ...value, comiteGestion: { ...value.comiteGestion, participants } })} />
    </>
  );
}

/** « APPRO PCA » — demande d’approbation au Conseil d’administration. */
export function ApproPcaFiche({ value, onChange, disabled, ctx, devise }: FicheProps<ApproPcaData>) {
  const pv = ctx.formulaires.DECISION_COMITE;
  const conditions = conditionsPret({ ...ctx, formulaires: { ...ctx.formulaires, APPRO_PCA: { ...value, decision: '' } } });
  const money = (n: number | null | undefined) => (n == null ? '—' : formatMoney(n, devise));
  const demande = demandeInitiale(ctx);

  return (
    <>
      <FormBlock title={`Demande d’approbation de crédit supérieur à ${money(ctx.parametres.seuilApprobationCa)}`}>
        <FormRow label="N° du mémo">
          <TextInput value={value.numeroMemo} disabled={disabled} onChange={(numeroMemo) => onChange({ ...value, numeroMemo })} />
        </FormRow>
        <FormRow label="Agence">
          <TextInput value={value.agence} disabled={disabled} onChange={(agence) => onChange({ ...value, agence })} />
        </FormRow>
        <FormRow label="Responsable">
          <TextInput value={value.responsable} disabled={disabled} onChange={(responsable) => onChange({ ...value, responsable })} />
        </FormRow>
        <FormRow label="Date de la demande d’approbation">
          <TextInput type="date" value={value.dateDemande} disabled={disabled} onChange={(dateDemande) => onChange({ ...value, dateDemande })} />
        </FormRow>
        <FormRow label="Date du comité de crédit">{pv.dateComite || '—'}</FormRow>
        <FormRow label="N° de crédit">{pv.numeroCredit || '—'}</FormRow>
        <FormRow label="Destination">Conseil d’administration — Président du Conseil d’administration</FormRow>
      </FormBlock>

      <FormBlock title="Demande et proposition du comité">
        <FormRow label="Prêt sollicité">{money(demande.montant)} — {demande.dureeMois ?? '—'} mois</FormRow>
        <FormRow label="Proposition du comité de crédit">
          {money(numOrNull(pv.montantApprouve))} pour {pv.dureeMois || '—'} mois — taux {formatPct(conditions.tauxMensuel, 2)}
        </FormRow>
        <FormRow label="Observations du comité">{pv.observations || '—'}</FormRow>
        <FormRow label="Conditions de déboursement">
          Caution {money(conditions.frais?.caution)}, frais de dossier {money(conditions.frais?.fraisDossier)}, TVA {money(conditions.frais?.tva)}
        </FormRow>
      </FormBlock>

      <FormBlock title="Décision du Conseil d’administration">
        <FormRow label="Observations et commentaires des membres">
          <TextArea rows={4} value={value.observationsCa} disabled={disabled} onChange={(observationsCa) => onChange({ ...value, observationsCa })} />
        </FormRow>
        <FormRow label="Décision">
          <SelectInput value={value.decision} options={optionsFromLabels(DECISION_COMITE_LABELS)} disabled={disabled} onChange={(decision) => onChange({ ...value, decision })} />
        </FormRow>
        <FormRow label="Montant approuvé (vide = proposition du comité)">
          <TextInput type="number" value={value.montantApprouve} disabled={disabled} onChange={(montantApprouve) => onChange({ ...value, montantApprouve })} />
        </FormRow>
        <FormRow label="Durée approuvée (mois)">
          <TextInput type="number" value={value.dureeMois} disabled={disabled} onChange={(dureeMois) => onChange({ ...value, dureeMois })} />
        </FormRow>
      </FormBlock>

      <MembresTable title="Membres du Conseil" membres={value.membres} disabled={disabled} onChange={(membres) => onChange({ ...value, membres })} />
    </>
  );
}
