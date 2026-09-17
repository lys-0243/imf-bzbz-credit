import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import type { CreditType } from '@imf/shared';
import { api } from '../api';
import { DateField } from '../components/DateField';
import { BoolField, Field, Section, SelectField } from '../components/Form';
import {
  CLIENT_STATUTS,
  defaultIndividuelPayload,
  defaultSalairePayload,
  ETATS_CIVILS,
  PRET_AUTRE_INSTITUTION,
  SEXES,
  TYPES_PIECE,
  type Commune,
  type IndividuelForm,
  type SalaireForm,
} from '../formDefaults';

const TYPE_LABELS: Record<CreditType, string> = {
  DARE_DARE: 'Dare-Dare',
  INDIVIDUEL: 'Individuel',
  SALAIRE: 'Salaire',
};

type Props = {
  type: CreditType;
  onCreated: (id: string) => void;
  onCancel: () => void;
};

function filled(v: string | undefined) {
  return Boolean(v && String(v).trim());
}

function validateIndStep(step: number, ind: IndividuelForm): string | null {
  if (step === 0) {
    if (!ind.communeId) return 'Sélectionnez une commune';
    if (ind.clientStatut === 'ANCIEN' && !filled(ind.numeroCompte)) {
      return 'N° de compte obligatoire pour un ancien client';
    }
    return null;
  }
  if (step === 1) return null; // booleans always set
  if (step === 2) {
    const d = ind.demandeur;
    if (
      !filled(d.prenom) ||
      !filled(d.nom) ||
      !filled(d.postNom) ||
      !filled(d.dateNaissance) ||
      !filled(d.numeroPiece) ||
      !filled(d.adresseDomicile) ||
      !filled(d.telephone)
    ) {
      return 'Complétez tous les champs obligatoires du demandeur';
    }
    if (d.etatCivil === 'Marie') {
      if (!filled(d.conjointNom) || !filled(d.conjointDateNaissance)) {
        return 'Informations conjoint obligatoires si Marié';
      }
    }
    return null;
  }
  if (step === 3) {
    const b = ind.business;
    if (
      !filled(b.nomBusiness) ||
      !filled(b.adresseBusiness) ||
      !filled(b.dureeAdresse) ||
      !filled(b.typeBusiness) ||
      !filled(b.dureeTypeBusiness) ||
      !filled(b.secteurBusiness) ||
      !filled(b.formeJuridique)
    ) {
      return 'Complétez tous les champs business obligatoires';
    }
    return null;
  }
  if (step === 4) {
    const p = ind.pret;
    if (
      !(p.montantDesire > 0) ||
      !(p.dureeMois > 0) ||
      !(p.capaciteMensuelle > 0) ||
      !filled(p.butInvestissement) ||
      !filled(p.commentaireBut)
    ) {
      return 'Complétez tous les champs prêt obligatoires';
    }
    if (p.pretAutreInstitution !== 'Non' && !filled(p.autreInstitutionNom)) {
      return 'Indiquez l’institution de l’autre prêt';
    }
    return null;
  }
  return null;
}

function validateSalStep(step: number, sal: SalaireForm): string | null {
  if (step === 0) {
    if (!sal.communeId) return 'Sélectionnez une commune';
    if (
      !filled(sal.prenom) ||
      !filled(sal.nom) ||
      !filled(sal.postNom) ||
      !filled(sal.telephone) ||
      !filled(sal.adresseDomicile)
    ) {
      return 'Complétez tous les champs identité obligatoires';
    }
    return null;
  }
  if (step === 1) {
    if (
      !filled(sal.societe) ||
      !filled(sal.adresseSociete) ||
      !filled(sal.fonctionService) ||
      !(sal.montantSollicite > 0) ||
      !(sal.dureeMois > 0) ||
      !(sal.salaireNet > 0)
    ) {
      return 'Complétez tous les champs emploi / prêt obligatoires';
    }
    return null;
  }
  return null;
}

export function RegisterScreen({ type, onCreated, onCancel }: Props) {
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ind, setInd] = useState(() => defaultIndividuelPayload(''));
  const [sal, setSal] = useState(() => defaultSalairePayload(''));

  useEffect(() => {
    api<Commune[]>('/communes').then((list) => {
      setCommunes(list);
      if (list[0]) {
        setInd((p) => ({ ...p, communeId: list[0].id }));
        setSal((p) => ({ ...p, communeId: list[0].id }));
      }
    });
  }, []);

  const communeNames = useMemo(() => communes.map((c) => c.name), [communes]);
  const communeName = (id: string) =>
    communes.find((c) => c.id === id)?.name || '';
  const setCommuneByName = (name: string) => {
    const c = communes.find((x) => x.name === name);
    if (!c) return;
    setInd((p) => ({ ...p, communeId: c.id }));
    setSal((p) => ({ ...p, communeId: c.id }));
  };

  const stepsInd = ['Client', 'Éligibilité', 'Demandeur', 'Business', 'Prêt'];
  const stepsSal = ['Identité', 'Emploi & prêt'];
  const steps = type === 'SALAIRE' ? stepsSal : stepsInd;

  const tryGoTo = (next: number) => {
    if (next <= step) {
      setStep(next);
      setError(null);
      return;
    }
    if (next > step + 1) return;
    if (next > maxReached + 1) return;

    const err =
      type === 'SALAIRE'
        ? validateSalStep(step, sal)
        : validateIndStep(step, ind);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  };

  const submit = async () => {
    const err =
      type === 'SALAIRE'
        ? validateSalStep(step, sal)
        : validateIndStep(step, ind);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload =
        type === 'SALAIRE'
          ? {
              ...sal,
              montantSollicite: Number(sal.montantSollicite),
              dureeMois: Number(sal.dureeMois),
              dureeAnnees: Number(sal.dureeAnnees),
              dureeSemaines: Number(sal.dureeSemaines),
              salaireNet: Number(sal.salaireNet),
              email: sal.email || undefined,
              motifCredit: sal.motifCredit || undefined,
              cautionGarantie: sal.cautionGarantie || undefined,
              numeroCompte: sal.numeroCompte || undefined,
              depotBc: sal.depotBc || undefined,
            }
          : {
              ...ind,
              numeroCompte:
                ind.clientStatut === 'ANCIEN' ? ind.numeroCompte : undefined,
              pret: {
                ...ind.pret,
                montantDesire: Number(ind.pret.montantDesire),
                dureeMois: Number(ind.pret.dureeMois),
                capaciteMensuelle: Number(ind.pret.capaciteMensuelle),
                montantPretPrecedent: ind.pret.montantPretPrecedent
                  ? Number(ind.pret.montantPretPrecedent)
                  : undefined,
                dureePretPrecedent: ind.pret.dureePretPrecedent
                  ? Number(ind.pret.dureePretPrecedent)
                  : undefined,
                autreInstitutionNom:
                  ind.pret.pretAutreInstitution === 'Non'
                    ? undefined
                    : ind.pret.autreInstitutionNom,
              },
              demandeur: {
                ...ind.demandeur,
                email: ind.demandeur.email || undefined,
                conjointNom:
                  ind.demandeur.etatCivil === 'Marie'
                    ? ind.demandeur.conjointNom
                    : undefined,
                conjointDateNaissance:
                  ind.demandeur.etatCivil === 'Marie'
                    ? ind.demandeur.conjointDateNaissance
                    : undefined,
              },
            };
      const created = await api<{ id: string }>('/dossiers', {
        method: 'POST',
        body: JSON.stringify({ type, payload }),
      });
      onCreated(created.id);
    } catch (e: any) {
      setError(e.message || 'Échec enregistrement');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={onCancel}>
          <Text style={styles.cancel}>Annuler</Text>
        </Pressable>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{TYPE_LABELS[type]}</Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.pad}
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 24 : 80}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>Nouvelle demande</Text>

        <View style={styles.steps}>
          {steps.map((s, i) => {
            const locked = i > maxReached && i > step;
            return (
              <Pressable
                key={s}
                onPress={() => !locked && tryGoTo(i)}
                style={[
                  styles.step,
                  step === i && styles.stepOn,
                  locked && styles.stepLocked,
                ]}
              >
                <Text
                  style={
                    step === i
                      ? styles.stepTextOn
                      : locked
                        ? styles.stepTextLocked
                        : undefined
                  }
                >
                  {s}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {type !== 'SALAIRE' && step === 0 && (
          <Section title="Client">
            <SelectField
              label="Commune"
              required
              value={communeName(ind.communeId)}
              options={communeNames}
              onChange={setCommuneByName}
            />
            <SelectField
              label="Nouveau ou ancien"
              required
              value={ind.clientStatut}
              options={CLIENT_STATUTS}
              onChange={(v) => setInd({ ...ind, clientStatut: v as any })}
            />
            {ind.clientStatut === 'ANCIEN' && (
              <Field
                label="N° de compte"
                required
                value={ind.numeroCompte}
                onChangeText={(v) => setInd({ ...ind, numeroCompte: v })}
              />
            )}
          </Section>
        )}

        {type !== 'SALAIRE' && step === 1 && (
          <Section title="Éligibilité">
            {(
              [
                ['age18OuPlus', '18 ans ou plus ?'],
                ['proprietaireActivite', 'Propriétaire de l’activité ?'],
                ['exerceActiviteActuellement', 'Exerce actuellement ?'],
                ['activiteListeExclusion', 'Liste d’exclusion IMF ?'],
                ['congolaisOuDomiciile', 'Congolais / domicilié ?'],
                ['activiteZoneOperationnelle', 'Zone opérationnelle ?'],
                ['activite6MoisConsecutifs', '6 mois consécutifs ?'],
                ['activiteEnregistreeLegalement', 'Enregistrée légalement ?'],
              ] as const
            ).map(([key, label]) => (
              <BoolField
                key={key}
                label={label}
                required
                value={ind.eligibilite[key]}
                onChange={(v) =>
                  setInd({
                    ...ind,
                    eligibilite: { ...ind.eligibilite, [key]: v },
                  })
                }
              />
            ))}
          </Section>
        )}

        {type !== 'SALAIRE' && step === 2 && (
          <Section title="Demandeur">
            <Field label="Prénom" required value={ind.demandeur.prenom} onChangeText={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, prenom: v } })} />
            <Field label="Nom" required value={ind.demandeur.nom} onChangeText={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, nom: v } })} />
            <Field label="Post-Nom" required value={ind.demandeur.postNom} onChangeText={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, postNom: v } })} />
            <DateField label="Date de naissance" required value={ind.demandeur.dateNaissance} onChange={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, dateNaissance: v } })} />
            <SelectField label="Sexe" required value={ind.demandeur.sexe} options={SEXES} onChange={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, sexe: v as any } })} />
            <SelectField label="Type de pièce" required value={ind.demandeur.typePiece} options={TYPES_PIECE} onChange={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, typePiece: v as any } })} />
            <Field label="N° de pièce" required value={ind.demandeur.numeroPiece} onChangeText={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, numeroPiece: v } })} />
            <SelectField
              label="État civil"
              required
              value={ind.demandeur.etatCivil}
              options={ETATS_CIVILS}
              onChange={(v) =>
                setInd({
                  ...ind,
                  demandeur: { ...ind.demandeur, etatCivil: v as any },
                })
              }
            />
            {ind.demandeur.etatCivil === 'Marie' && (
              <>
                <Field label="Prénom et nom conjoint" required value={ind.demandeur.conjointNom || ''} onChangeText={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, conjointNom: v } })} />
                <DateField label="Date naissance conjoint" required value={ind.demandeur.conjointDateNaissance || ''} onChange={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, conjointDateNaissance: v } })} />
              </>
            )}
            <Field label="Adresse domicile" required value={ind.demandeur.adresseDomicile} onChangeText={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, adresseDomicile: v } })} />
            <Field label="Téléphone" required value={ind.demandeur.telephone} onChangeText={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, telephone: v } })} keyboardType="phone-pad" />
            <Field label="Email" value={ind.demandeur.email || ''} onChangeText={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, email: v } })} keyboardType="email-address" />
          </Section>
        )}

        {type !== 'SALAIRE' && step === 3 && (
          <Section title="Business">
            <Field label="Nom du business" required value={ind.business.nomBusiness} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, nomBusiness: v } })} />
            <Field label="Adresse physique" required value={ind.business.adresseBusiness} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, adresseBusiness: v } })} />
            <Field label="Durée à cette adresse" required value={ind.business.dureeAdresse} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, dureeAdresse: v } })} />
            <Field label="Type de business" required value={ind.business.typeBusiness} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, typeBusiness: v } })} />
            <Field label="Durée de ce type" required value={ind.business.dureeTypeBusiness} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, dureeTypeBusiness: v } })} />
            <Field label="Secteur" required value={ind.business.secteurBusiness} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, secteurBusiness: v } })} />
            <Field label="Forme juridique" required value={ind.business.formeJuridique} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, formeJuridique: v } })} />
          </Section>
        )}

        {type !== 'SALAIRE' && step === 4 && (
          <Section title="Prêt sollicité">
            <Field label="Montant désiré" required value={String(ind.pret.montantDesire || '')} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, montantDesire: Number(v) || 0 } })} keyboardType="numeric" />
            <Field label="Durée (mois)" required value={String(ind.pret.dureeMois || '')} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, dureeMois: Number(v) || 0 } })} keyboardType="numeric" />
            <Field label="Montant prêt précédent" value={ind.pret.montantPretPrecedent != null ? String(ind.pret.montantPretPrecedent) : ''} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, montantPretPrecedent: v ? Number(v) : undefined } })} keyboardType="numeric" />
            <Field label="Durée prêt précédent" value={ind.pret.dureePretPrecedent != null ? String(ind.pret.dureePretPrecedent) : ''} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, dureePretPrecedent: v ? Number(v) : undefined } })} keyboardType="numeric" />
            <Field label="Capacité mensuelle" required value={String(ind.pret.capaciteMensuelle || '')} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, capaciteMensuelle: Number(v) || 0 } })} keyboardType="numeric" />
            <Field label="But de l’investissement" required value={ind.pret.butInvestissement} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, butInvestissement: v } })} />
            <Field label="Commentaire sur le but" required value={ind.pret.commentaireBut} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, commentaireBut: v } })} />
            <SelectField label="Prêt autre institution ?" required value={ind.pret.pretAutreInstitution} options={PRET_AUTRE_INSTITUTION} onChange={(v) => setInd({ ...ind, pret: { ...ind.pret, pretAutreInstitution: v as any } })} />
            {ind.pret.pretAutreInstitution !== 'Non' && (
              <Field label="Laquelle ?" required value={ind.pret.autreInstitutionNom || ''} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, autreInstitutionNom: v } })} />
            )}
          </Section>
        )}

        {type === 'SALAIRE' && step === 0 && (
          <Section title="Identité">
            <SelectField label="Commune" required value={communeName(sal.communeId)} options={communeNames} onChange={setCommuneByName} />
            <Field label="Prénom" required value={sal.prenom} onChangeText={(v) => setSal({ ...sal, prenom: v })} />
            <Field label="Nom" required value={sal.nom} onChangeText={(v) => setSal({ ...sal, nom: v })} />
            <Field label="Post-Nom" required value={sal.postNom} onChangeText={(v) => setSal({ ...sal, postNom: v })} />
            <SelectField label="Sexe" required value={sal.sexe} options={SEXES} onChange={(v) => setSal({ ...sal, sexe: v as any })} />
            <Field label="Téléphone" required value={sal.telephone} onChangeText={(v) => setSal({ ...sal, telephone: v })} keyboardType="phone-pad" />
            <Field label="Email" value={sal.email || ''} onChangeText={(v) => setSal({ ...sal, email: v })} keyboardType="email-address" />
            <Field label="Adresse domicile" required value={sal.adresseDomicile} onChangeText={(v) => setSal({ ...sal, adresseDomicile: v })} />
          </Section>
        )}

        {type === 'SALAIRE' && step === 1 && (
          <Section title="Emploi & prêt">
            <Field label="Société" required value={sal.societe} onChangeText={(v) => setSal({ ...sal, societe: v })} />
            <Field label="Adresse société" required value={sal.adresseSociete} onChangeText={(v) => setSal({ ...sal, adresseSociete: v })} />
            <Field label="Fonction / Service" required value={sal.fonctionService} onChangeText={(v) => setSal({ ...sal, fonctionService: v })} />
            <Field label="Montant sollicité" required value={String(sal.montantSollicite || '')} onChangeText={(v) => setSal({ ...sal, montantSollicite: Number(v) || 0 })} keyboardType="numeric" />
            <Field label="Durée (mois)" required value={String(sal.dureeMois || '')} onChangeText={(v) => setSal({ ...sal, dureeMois: Number(v) || 0 })} keyboardType="numeric" />
            <Field label="Durée (années)" required value={String(sal.dureeAnnees || '')} onChangeText={(v) => setSal({ ...sal, dureeAnnees: Number(v) || 0 })} keyboardType="numeric" />
            <Field label="Durée (semaines)" required value={String(sal.dureeSemaines || '')} onChangeText={(v) => setSal({ ...sal, dureeSemaines: Number(v) || 0 })} keyboardType="numeric" />
            <Field label="Motif" value={sal.motifCredit || ''} onChangeText={(v) => setSal({ ...sal, motifCredit: v })} />
            <Field label="Salaire net" required value={String(sal.salaireNet || '')} onChangeText={(v) => setSal({ ...sal, salaireNet: Number(v) || 0 })} keyboardType="numeric" />
            <Field label="Caution / garantie" value={sal.cautionGarantie || ''} onChangeText={(v) => setSal({ ...sal, cautionGarantie: v })} />
            <Field label="N° de compte" value={sal.numeroCompte || ''} onChangeText={(v) => setSal({ ...sal, numeroCompte: v })} />
            <Field label="Dépôt BC" value={sal.depotBc || ''} onChangeText={(v) => setSal({ ...sal, depotBc: v })} />
          </Section>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.nav}>
          {step > 0 && (
            <Pressable style={styles.secondary} onPress={() => tryGoTo(step - 1)}>
              <Text>Précédent</Text>
            </Pressable>
          )}
          {step < steps.length - 1 ? (
            <Pressable style={styles.primary} onPress={() => tryGoTo(step + 1)}>
              <Text style={styles.primaryText}>Suivant</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primary} onPress={submit} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Enregistrer</Text>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f4ef', paddingTop: 48 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  cancel: { color: '#a11', fontWeight: '700' },
  typeBadge: {
    backgroundColor: '#1a3a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: { color: '#fff', fontWeight: '700' },
  pad: { padding: 16, paddingBottom: 80 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: '#1a3a2a' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  step: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  stepOn: { backgroundColor: '#cfe3d6', borderColor: '#1a3a2a' },
  stepLocked: { opacity: 0.45 },
  stepTextOn: { fontWeight: '700' },
  stepTextLocked: { color: '#999' },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  primary: {
    flex: 1,
    backgroundColor: '#1a3a2a',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#aaa',
    backgroundColor: '#fff',
  },
  error: { color: '#a11', marginVertical: 8 },
});
