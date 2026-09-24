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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';
import type { CreditType } from '@imf/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { DateField } from '../components/DateField';
import { BoolField, DurationField, Field, ListSelectField, MoneyField, Section, SelectField } from '../components/Form';
import { HomeHeader } from '../components/HomeHeader';
import {
  CLIENT_STATUTS,
  DEVISES,
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
  DARE_DARE: 'Crédit Dare-Dare',
  INDIVIDUEL: 'Crédit Individuel',
  SALAIRE: 'Crédit Salaire',
};

type Props = {
  type: CreditType;
  onCreated: (id: string) => void;
  onCancel: () => void;
};

function filled(v: string | undefined) {
  return Boolean(v && String(v).trim());
}

function missingMessage(missing: string[]): string | null {
  if (missing.length === 0) return null;
  if (missing.length === 1) {
    return `Champ obligatoire manquant : ${missing[0]}`;
  }
  return `Champs obligatoires manquants : ${missing.join(', ')}`;
}

function validateIndStep(step: number, ind: IndividuelForm): string | null {
  if (step === 0) {
    const missing: string[] = [];
    if (!ind.communeId) missing.push('Commune');
    if (ind.clientStatut === 'ANCIEN' && !filled(ind.numeroCompte)) {
      missing.push('N° de compte');
    }
    return missingMessage(missing);
  }
  if (step === 1) return null; // booleans always set
  if (step === 2) {
    const d = ind.demandeur;
    const missing: string[] = [];
    if (!filled(d.prenom)) missing.push('Prénom');
    if (!filled(d.nom)) missing.push('Nom');
    if (!filled(d.postNom)) missing.push('Post-Nom');
    if (!filled(d.dateNaissance)) missing.push('Date de naissance');
    if (!filled(d.numeroPiece)) missing.push('N° de pièce');
    if (!filled(d.adresseDomicile)) missing.push('Adresse domicile');
    if (!filled(d.telephone)) missing.push('Téléphone');
    if (d.etatCivil === 'Marie') {
      if (!filled(d.conjointNom)) missing.push('Prénom et nom conjoint');
      if (!filled(d.conjointDateNaissance)) missing.push('Date naissance conjoint');
    }
    return missingMessage(missing);
  }
  if (step === 3) {
    const b = ind.business;
    const missing: string[] = [];
    if (!filled(b.nomBusiness)) missing.push('Nom du business');
    if (!filled(b.adresseBusiness)) missing.push('Adresse physique');
    if (!filled(b.dureeAdresse)) missing.push('Durée à cette adresse');
    if (!filled(b.typeBusiness)) missing.push('Type de business');
    if (!filled(b.dureeTypeBusiness)) missing.push('Durée de ce type');
    if (!filled(b.secteurBusiness)) missing.push('Secteur');
    if (!filled(b.formeJuridique)) missing.push('Forme juridique');
    return missingMessage(missing);
  }
  if (step === 4) {
    const p = ind.pret;
    const missing: string[] = [];
    if (!(p.montantDesire > 0)) missing.push('Montant désiré');
    if (!(p.dureeMois > 0)) missing.push('Durée (mois)');
    if (!(p.capaciteMensuelle > 0)) missing.push('Capacité mensuelle');
    if (!filled(p.butInvestissement)) missing.push('But de l’investissement');
    if (!filled(p.commentaireBut)) missing.push('Commentaire sur le but');
    if (p.pretAutreInstitution !== 'Non' && !filled(p.autreInstitutionNom)) {
      missing.push('Institution de l’autre prêt');
    }
    return missingMessage(missing);
  }
  return null;
}

function validateSalStep(step: number, sal: SalaireForm): string | null {
  if (step === 0) {
    const missing: string[] = [];
    if (!sal.communeId) missing.push('Commune');
    if (!filled(sal.prenom)) missing.push('Prénom');
    if (!filled(sal.nom)) missing.push('Nom');
    if (!filled(sal.postNom)) missing.push('Post-Nom');
    if (!filled(sal.telephone)) missing.push('Téléphone');
    if (!filled(sal.adresseDomicile)) missing.push('Adresse domicile');
    return missingMessage(missing);
  }
  if (step === 1) {
    const missing: string[] = [];
    if (!filled(sal.societe)) missing.push('Société');
    if (!filled(sal.adresseSociete)) missing.push('Adresse société');
    if (!filled(sal.fonctionService)) missing.push('Fonction / Service');
    if (!(sal.montantSollicite > 0)) missing.push('Montant sollicité');
    if (!(sal.dureeMois > 0)) missing.push('Durée (mois)');
    if (!filled(sal.salaireNet)) missing.push('Salaire net');
    if (!(sal.capaciteMensuelle > 0)) missing.push('Capacité mensuelle');
    return missingMessage(missing);
  }
  return null;
}

export function RegisterScreen({ type, onCreated, onCancel }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ind, setInd] = useState(() => defaultIndividuelPayload(''));
  const [sal, setSal] = useState(() => defaultSalairePayload(''));

  useEffect(() => {
    api<Commune[]>('/communes')
      .then(setCommunes)
      .catch(() => setError('Impossible de charger les communes'));
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
              salaireNet: sal.salaireNet.trim(),
              capaciteMensuelle: Number(sal.capaciteMensuelle),
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
      <HomeHeader
        displayName={user?.displayName || ''}
        variant="compact"
        title={TYPE_LABELS[type]}
        trailing="close"
        onClose={onCancel}
      />

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: 100 + Math.max(insets.bottom, 8) },
        ]}
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 24 : 80}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepMeta}>
          Étape {step + 1} sur {steps.length}
        </Text>
        <Text style={styles.h1}>Nouvelle demande</Text>
        <View style={styles.typeChip}>
          <Text style={styles.typeChipText}>{TYPE_LABELS[type]}</Text>
        </View>

        <View style={styles.progressTrack}>
          {steps.map((s, i) => {
            const locked = i > maxReached;
            const filled = i <= step;
            return (
              <Pressable
                key={s}
                style={styles.progressSegWrap}
                onPress={() => !locked && tryGoTo(i)}
                disabled={locked}
                accessibilityLabel={s}
              >
                <View
                  style={[
                    styles.progressSeg,
                    filled && styles.progressSegOn,
                    locked && styles.progressSegLocked,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.stepLabel}>{steps[step]}</Text>

        {type !== 'SALAIRE' && step === 0 && (
          <Section title="Client">
            <ListSelectField
              label="Commune"
              required
              value={communeName(ind.communeId)}
              options={communeNames}
              onChange={setCommuneByName}
              placeholder="Sélectionner une commune"
              subtitle="Choisissez une commune"
              searchPlaceholder="Rechercher une commune"
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
            <ListSelectField
              label="Type de pièce"
              required
              searchable={false}
              subtitle="Choisissez le type de pièce"
              value={ind.demandeur.typePiece}
              options={TYPES_PIECE}
              onChange={(v) =>
                setInd({
                  ...ind,
                  demandeur: { ...ind.demandeur, typePiece: v as any },
                })
              }
            />
            <Field label="N° de pièce" required value={ind.demandeur.numeroPiece} onChangeText={(v) => setInd({ ...ind, demandeur: { ...ind.demandeur, numeroPiece: v } })} />
            <ListSelectField
              label="État civil"
              required
              searchable={false}
              subtitle="Choisissez l’état civil"
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
            <Field label="Durée de ce type de business" required value={ind.business.dureeTypeBusiness} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, dureeTypeBusiness: v } })} />
            <Field label="Secteur" required value={ind.business.secteurBusiness} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, secteurBusiness: v } })} />
            <Field label="Forme juridique" required value={ind.business.formeJuridique} onChangeText={(v) => setInd({ ...ind, business: { ...ind.business, formeJuridique: v } })} />
          </Section>
        )}

        {type !== 'SALAIRE' && step === 4 && (
          <Section title="Prêt sollicité">
            <SelectField
              label="Devise"
              required
              value={ind.pret.devise}
              options={DEVISES}
              onChange={(v) =>
                setInd({ ...ind, pret: { ...ind.pret, devise: v as (typeof DEVISES)[number] } })
              }
            />
            <MoneyField
              label="Montant désiré"
              required
              currency={ind.pret.devise}
              value={ind.pret.montantDesire}
              onChange={(v) =>
                setInd({ ...ind, pret: { ...ind.pret, montantDesire: v ?? 0 } })
              }
            />
            <DurationField
              label="Durée (mois)"
              required
              unit="mois"
              value={ind.pret.dureeMois}
              onChange={(v) =>
                setInd({ ...ind, pret: { ...ind.pret, dureeMois: v ?? 0 } })
              }
            />
            <MoneyField
              label="Montant prêt précédent"
              currency={ind.pret.devise}
              value={ind.pret.montantPretPrecedent}
              allowEmpty
              onChange={(v) =>
                setInd({ ...ind, pret: { ...ind.pret, montantPretPrecedent: v } })
              }
            />
            <DurationField
              label="Durée prêt précédent"
              unit="mois"
              allowEmpty
              value={ind.pret.dureePretPrecedent}
              onChange={(v) =>
                setInd({ ...ind, pret: { ...ind.pret, dureePretPrecedent: v } })
              }
            />
            <MoneyField
              label="Capacité mensuelle de remboursement"
              required
              currency={ind.pret.devise}
              value={ind.pret.capaciteMensuelle}
              onChange={(v) =>
                setInd({ ...ind, pret: { ...ind.pret, capaciteMensuelle: v ?? 0 } })
              }
            />
            <Field label="But de l’investissement" required value={ind.pret.butInvestissement} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, butInvestissement: v } })} />
            <Field label="Commentaire sur le but" required value={ind.pret.commentaireBut} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, commentaireBut: v } })} />
            <ListSelectField
              label="Prêt autre institution ?"
              required
              searchable={false}
              subtitle="Choisissez une option"
              value={ind.pret.pretAutreInstitution}
              options={PRET_AUTRE_INSTITUTION}
              onChange={(v) =>
                setInd({
                  ...ind,
                  pret: { ...ind.pret, pretAutreInstitution: v as any },
                })
              }
            />
            {ind.pret.pretAutreInstitution !== 'Non' && (
              <Field label="Laquelle ?" required value={ind.pret.autreInstitutionNom || ''} onChangeText={(v) => setInd({ ...ind, pret: { ...ind.pret, autreInstitutionNom: v } })} />
            )}
          </Section>
        )}

        {type === 'SALAIRE' && step === 0 && (
          <Section title="Identité">
            <ListSelectField
              label="Commune"
              required
              value={communeName(sal.communeId)}
              options={communeNames}
              onChange={setCommuneByName}
              placeholder="Sélectionner une commune"
              subtitle="Choisissez une commune"
              searchPlaceholder="Rechercher une commune"
            />
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
            <SelectField
              label="Devise"
              required
              value={sal.devise}
              options={DEVISES}
              onChange={(v) => setSal({ ...sal, devise: v as (typeof DEVISES)[number] })}
            />
            <MoneyField
              label="Montant sollicité"
              required
              currency={sal.devise}
              value={sal.montantSollicite}
              onChange={(v) => setSal({ ...sal, montantSollicite: v ?? 0 })}
            />
            <DurationField
              label="Durée (mois)"
              required
              unit="mois"
              value={sal.dureeMois}
              onChange={(v) => setSal({ ...sal, dureeMois: v ?? 0 })}
            />
            <DurationField
              label="Durée (années)"
              required
              unit="annees"
              value={sal.dureeAnnees}
              onChange={(v) => setSal({ ...sal, dureeAnnees: v ?? 0 })}
            />
            <DurationField
              label="Durée (semaines)"
              required
              unit="semaines"
              value={sal.dureeSemaines}
              onChange={(v) => setSal({ ...sal, dureeSemaines: v ?? 0 })}
            />
            <Field label="Motif" value={sal.motifCredit || ''} onChangeText={(v) => setSal({ ...sal, motifCredit: v })} />
            <Field
              label="Salaire net"
              required
              placeholder="Salaire net * (ex. 500 USD ou 800.000 CDF)"
              value={sal.salaireNet}
              onChangeText={(v) => setSal({ ...sal, salaireNet: v })}
            />
            <MoneyField
              label="Capacité mensuelle de remboursement"
              required
              currency={sal.devise}
              value={sal.capaciteMensuelle}
              onChange={(v) => setSal({ ...sal, capaciteMensuelle: v ?? 0 })}
            />
            <Field label="Caution / garantie" value={sal.cautionGarantie || ''} onChangeText={(v) => setSal({ ...sal, cautionGarantie: v })} />
            <Field label="N° de compte" value={sal.numeroCompte || ''} onChangeText={(v) => setSal({ ...sal, numeroCompte: v })} />
            <Field label="Dépôt BC" value={sal.depotBc || ''} onChangeText={(v) => setSal({ ...sal, depotBc: v })} />
          </Section>
        )}
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) + 4 },
        ]}
      >
        {error ? <Text style={styles.errorFooter}>{error}</Text> : null}
        <View style={styles.footerRow}>
          {step > 0 ? (
            <Pressable
              style={styles.secondary}
              onPress={() => tryGoTo(step - 1)}
            >
              <Text style={styles.secondaryText}>Précédent</Text>
            </Pressable>
          ) : null}
          {step < steps.length - 1 ? (
            <Pressable
              style={styles.primary}
              onPress={() => tryGoTo(step + 1)}
            >
              <Text style={styles.primaryText}>Suivant</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.primary}
              onPress={submit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Enregistrer</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral.background },
  scroll: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 20 },
  stepMeta: {
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.neutral.textMuted,
    marginBottom: 8,
  },
  h1: {
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 36,
    fontFamily: fonts.bold,
    color: colors.neutral.text,
    marginBottom: 10,
  },
  typeChip: {
    alignSelf: 'center',
    backgroundColor: 'rgba(40, 64, 128, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 18,
  },
  typeChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.primary.blue,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  progressSegWrap: { flex: 1 },
  progressSeg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
  },
  progressSegOn: {
    backgroundColor: colors.primary.blue,
  },
  progressSegLocked: {
    opacity: 0.5,
  },
  stepLabel: {
    textAlign: 'center',
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary.blue,
    marginBottom: 18,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
    backgroundColor: colors.neutral.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  errorFooter: {
    color: colors.primary.red,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primary: {
    flex: 1,
    backgroundColor: colors.primary.blue,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  secondary: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fonts.semiBold,
    color: colors.neutral.text,
  },
});
