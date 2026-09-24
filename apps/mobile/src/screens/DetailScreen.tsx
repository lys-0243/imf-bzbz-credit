import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@imf/assets';
import {
  DOSSIER_ETAT_LABELS,
  formatMontantSouhaite,
  getApplicableChecklistItems,
  montantSouhaiteFromPayload,
  type CreditType,
  type DossierEtat,
} from '@imf/shared';
import { api } from '../api';
import { HomeHeader } from '../components/HomeHeader';

const TYPE_LABELS: Record<CreditType, string> = {
  DARE_DARE: 'Crédit Dare-Dare',
  INDIVIDUEL: 'Crédit Individuel',
  SALAIRE: 'Crédit Salaire',
};

/** Hero card — dark charcoal (maquette détail). */
const HERO_BG = '#3a3a3c';

type Transition = {
  id: string;
  fromEtat: DossierEtat | null;
  toEtat: DossierEtat;
  comment: string | null;
  createdAt: string;
};

type Piece = {
  id: string;
  kind: string;
  blobPath: string;
  createdAt: string;
};

type Dossier = {
  id: string;
  reference: string;
  type: CreditType;
  etat: DossierEtat;
  editable: boolean;
  payload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  agentValideAt?: string | null;
  client: {
    fullName: string;
    phone: string;
    zone?: { name: string };
    commune?: { name: string } | null;
  };
  agent?: { displayName: string } | null;
  transitions: Transition[];
};

type Props = { id: string; onBack: () => void; bottomInset?: number };

type TabDef = { key: string; label: string };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayVal(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return '—';
    return v.toLocaleString('fr-FR');
  }
  return String(v);
}

function etatTone(etat: DossierEtat): { bg: string; fg: string } {
  switch (etat) {
    case 'A_DECAISSER':
      return { bg: 'rgba(42, 178, 75, 0.22)', fg: '#fff' };
    case 'REJETE':
      return { bg: 'rgba(255, 255, 255, 0.22)', fg: '#fff' };
    default:
      return { bg: 'rgba(255, 255, 255, 0.18)', fg: '#fff' };
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InfoCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.infoCard}>
      {title ? <Text style={styles.infoCardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function DetailScreen({ id, onBack, bottomInset = 24 }: Props) {
  const [d, setD] = useState<Dossier | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('recap');

  const tabs: TabDef[] = useMemo(() => {
    if (!d) return [{ key: 'recap', label: 'Récapitulatif' }];
    if (d.type === 'SALAIRE') {
      return [
        { key: 'recap', label: 'Récapitulatif' },
        { key: 'identite', label: 'Identité' },
        { key: 'emploi', label: 'Emploi & prêt' },
        { key: 'docs', label: 'Documents' },
      ];
    }
    return [
      { key: 'recap', label: 'Récapitulatif' },
      { key: 'client', label: 'Client' },
      { key: 'elig', label: 'Éligibilité' },
      { key: 'demandeur', label: 'Demandeur' },
      { key: 'business', label: 'Business' },
      { key: 'pret', label: 'Prêt' },
      { key: 'docs', label: 'Documents' },
    ];
  }, [d]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setBusy(true);
      setError(null);
      try {
        const [dossier, docs] = await Promise.all([
          api<Dossier>(`/dossiers/${id}`),
          api<Piece[]>(`/documents/dossiers/${id}`).catch(() => [] as Piece[]),
        ]);
        if (cancelled) return;
        setD(dossier);
        setPieces(docs);
        setTab('recap');
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Chargement impossible');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const attributionDate = useMemo(() => {
    if (!d) return null;
    const affecte = (d.transitions || []).find((t) => t.toEtat === 'AFFECTE');
    if (affecte) return affecte.createdAt;
    return d.agentValideAt || null;
  }, [d]);

  const docRows = useMemo(() => {
    if (!d) return [];
    const uploadItems = getApplicableChecklistItems(
      d.type,
      d.payload ?? {},
      {},
      'ALL',
    ).filter((item) => item.input === 'upload');
    const byKind = new Map(pieces.map((p) => [p.kind, p]));
    return uploadItems.map((item) => {
      const kind = item.kind ?? item.id;
      const piece = byKind.get(kind);
      return {
        id: item.id,
        label: item.label,
        piece,
        received: Boolean(piece),
      };
    });
  }, [d, pieces]);

  if (busy) {
    return (
      <View style={styles.root}>
        <HomeHeader variant="detail" title="" onBack={onBack} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.blue} />
        </View>
      </View>
    );
  }

  if (!d) {
    return (
      <View style={styles.root}>
        <HomeHeader variant="detail" title="" onBack={onBack} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'Introuvable'}</Text>
          <Pressable onPress={onBack}>
            <Text style={styles.link}>Retour</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { montantSouhaite, devise } = montantSouhaiteFromPayload(
    d.type,
    d.payload,
  );
  const montantLabel = formatMontantSouhaite(montantSouhaite, devise);
  const tone = etatTone(d.etat);
  const p = d.payload ?? {};
  const salaireNet =
    d.type === 'SALAIRE' && p.salaireNet != null && String(p.salaireNet).trim()
      ? String(p.salaireNet).trim()
      : null;

  const renderRecap = () => (
    <>
      <InfoCard>
        <InfoRow
          label="Statut"
          value={DOSSIER_ETAT_LABELS[d.etat] || d.etat}
        />
        <InfoRow label="Date de demande" value={formatDate(d.createdAt)} />
        <InfoRow
          label="Agent attribué"
          value={d.agent?.displayName || '—'}
        />
        <InfoRow
          label="Date d’attribution"
          value={formatDate(attributionDate)}
        />
        <InfoRow
          label="Dernière mise à jour"
          value={formatDateTime(d.updatedAt)}
        />
        <InfoRow label="Montant accordé" value="—" />
      </InfoCard>

      <InfoCard title="Historique validations">
        {(d.transitions || []).length === 0 ? (
          <Text style={styles.muted}>Aucune transition</Text>
        ) : (
          (d.transitions || []).map((t) => (
            <View key={t.id} style={styles.historyItem}>
              <Text style={styles.historyTitle}>
                {DOSSIER_ETAT_LABELS[t.toEtat] || t.toEtat}
              </Text>
              {t.comment ? (
                <Text style={styles.historyComment}>{t.comment}</Text>
              ) : null}
              <Text style={styles.historyDate}>
                {formatDateTime(t.createdAt)}
              </Text>
            </View>
          ))
        )}
      </InfoCard>
    </>
  );

  const renderSalaireIdentite = () => (
    <InfoCard>
      <InfoRow label="Commune" value={d.client.commune?.name || '—'} />
      <InfoRow label="Prénom" value={displayVal(p.prenom)} />
      <InfoRow label="Nom" value={displayVal(p.nom)} />
      <InfoRow label="Post-Nom" value={displayVal(p.postNom)} />
      <InfoRow label="Téléphone" value={displayVal(p.telephone)} />
      <InfoRow label="Email" value={displayVal(p.email)} />
      <InfoRow label="Adresse domicile" value={displayVal(p.adresseDomicile)} />
      <InfoRow label="N° de compte" value={displayVal(p.numeroCompte)} />
    </InfoCard>
  );

  const renderSalaireEmploi = () => (
    <InfoCard>
      <InfoRow label="Société" value={displayVal(p.societe)} />
      <InfoRow label="Adresse société" value={displayVal(p.adresseSociete)} />
      <InfoRow
        label="Fonction / Service"
        value={displayVal(p.fonctionService)}
      />
      <InfoRow
        label="Montant sollicité"
        value={formatMontantSouhaite(
          typeof p.montantSollicite === 'number' ? p.montantSollicite : null,
          p.devise,
        )}
      />
      <InfoRow label="Devise" value={displayVal(p.devise)} />
      <InfoRow label="Durée (mois)" value={displayVal(p.dureeMois)} />
      <InfoRow label="Salaire net" value={displayVal(p.salaireNet)} />
      <InfoRow
        label="Capacité mensuelle"
        value={displayVal(p.capaciteMensuelle)}
      />
      <InfoRow label="Motif crédit" value={displayVal(p.motifCredit)} />
      <InfoRow
        label="Caution / garantie"
        value={displayVal(p.cautionGarantie)}
      />
      <InfoRow label="Dépôt BC" value={displayVal(p.depotBc)} />
    </InfoCard>
  );

  const renderIndClient = () => (
    <InfoCard>
      <InfoRow label="Commune" value={d.client.commune?.name || '—'} />
      <InfoRow label="Statut client" value={displayVal(p.clientStatut)} />
      <InfoRow label="N° de compte" value={displayVal(p.numeroCompte)} />
    </InfoCard>
  );

  const renderIndElig = () => {
    const e = p.eligibilite ?? {};
    const rows: [string, string][] = [
      ['age18OuPlus', '18 ans ou plus'],
      ['proprietaireActivite', 'Propriétaire de l’activité'],
      ['exerceActiviteActuellement', 'Exerce actuellement'],
      ['activiteListeExclusion', 'Liste d’exclusion IMF'],
      ['congolaisOuDomiciile', 'Congolais / domicilié'],
      ['activiteZoneOperationnelle', 'Zone opérationnelle'],
      ['activite6MoisConsecutifs', '6 mois consécutifs'],
      ['activiteEnregistreeLegalement', 'Enregistrée légalement'],
    ];
    return (
      <InfoCard>
        {rows.map(([key, label]) => (
          <InfoRow key={key} label={label} value={displayVal(e[key])} />
        ))}
      </InfoCard>
    );
  };

  const renderIndDemandeur = () => {
    const dem = p.demandeur ?? {};
    return (
      <InfoCard>
        <InfoRow label="Prénom" value={displayVal(dem.prenom)} />
        <InfoRow label="Nom" value={displayVal(dem.nom)} />
        <InfoRow label="Post-Nom" value={displayVal(dem.postNom)} />
        <InfoRow label="Sexe" value={displayVal(dem.sexe)} />
        <InfoRow
          label="Date de naissance"
          value={displayVal(dem.dateNaissance)}
        />
        <InfoRow label="État civil" value={displayVal(dem.etatCivil)} />
        <InfoRow label="Type de pièce" value={displayVal(dem.typePiece)} />
        <InfoRow label="N° de pièce" value={displayVal(dem.numeroPiece)} />
        <InfoRow
          label="Adresse domicile"
          value={displayVal(dem.adresseDomicile)}
        />
        <InfoRow label="Téléphone" value={displayVal(dem.telephone)} />
        <InfoRow label="Email" value={displayVal(dem.email)} />
        {dem.etatCivil === 'Marie' ? (
          <>
            <InfoRow
              label="Conjoint (prénom et nom)"
              value={displayVal(dem.conjointNom)}
            />
            <InfoRow
              label="Date naissance conjoint"
              value={displayVal(dem.conjointDateNaissance)}
            />
          </>
        ) : null}
      </InfoCard>
    );
  };

  const renderIndBusiness = () => {
    const b = p.business ?? {};
    return (
      <InfoCard>
        <InfoRow label="Nom du business" value={displayVal(b.nomBusiness)} />
        <InfoRow
          label="Adresse physique"
          value={displayVal(b.adresseBusiness)}
        />
        <InfoRow
          label="Durée à cette adresse"
          value={displayVal(b.dureeAdresse)}
        />
        <InfoRow label="Type de business" value={displayVal(b.typeBusiness)} />
        <InfoRow
          label="Durée de ce type"
          value={displayVal(b.dureeTypeBusiness)}
        />
        <InfoRow label="Secteur" value={displayVal(b.secteurBusiness)} />
        <InfoRow
          label="Forme juridique"
          value={displayVal(b.formeJuridique)}
        />
      </InfoCard>
    );
  };

  const renderIndPret = () => {
    const pret = p.pret ?? {};
    return (
      <InfoCard>
        <InfoRow
          label="Montant désiré"
          value={formatMontantSouhaite(
            typeof pret.montantDesire === 'number' ? pret.montantDesire : null,
            pret.devise,
          )}
        />
        <InfoRow label="Devise" value={displayVal(pret.devise)} />
        <InfoRow label="Durée (mois)" value={displayVal(pret.dureeMois)} />
        <InfoRow
          label="Capacité mensuelle"
          value={displayVal(pret.capaciteMensuelle)}
        />
        <InfoRow
          label="But de l’investissement"
          value={displayVal(pret.butInvestissement)}
        />
        <InfoRow
          label="Commentaire sur le but"
          value={displayVal(pret.commentaireBut)}
        />
        <InfoRow
          label="Autre institution"
          value={displayVal(pret.pretAutreInstitution)}
        />
        {pret.pretAutreInstitution && pret.pretAutreInstitution !== 'Non' ? (
          <InfoRow
            label="Nom institution"
            value={displayVal(pret.autreInstitutionNom)}
          />
        ) : null}
        <InfoRow
          label="Montant prêt précédent"
          value={displayVal(pret.montantPretPrecedent)}
        />
        <InfoRow
          label="Durée prêt précédent"
          value={displayVal(pret.dureePretPrecedent)}
        />
      </InfoCard>
    );
  };

  const renderDocs = () => (
    <InfoCard>
      {docRows.length === 0 ? (
        <Text style={styles.muted}>Aucune pièce attendue</Text>
      ) : (
        docRows.map((row) => (
          <Pressable
            key={row.id}
            style={styles.docRow}
            disabled={!row.received}
            onPress={() => {
              /* best-effort: auth download not wired on mobile yet */
            }}
          >
            <View
              style={[
                styles.docIcon,
                row.received ? styles.docIconOk : styles.docIconMiss,
              ]}
            >
              <Ionicons
                name={row.received ? 'document-text' : 'document-outline'}
                size={18}
                color={row.received ? colors.secondary.green : colors.neutral.textMuted}
              />
            </View>
            <View style={styles.docBody}>
              <Text style={styles.docLabel} numberOfLines={2}>
                {row.label}
              </Text>
              <Text
                style={[
                  styles.docStatus,
                  row.received ? styles.docStatusOk : styles.docStatusMiss,
                ]}
              >
                {row.received ? 'Reçu' : 'Manquant'}
              </Text>
            </View>
            {row.received ? (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.neutral.textHint}
              />
            ) : null}
          </Pressable>
        ))
      )}
    </InfoCard>
  );

  let tabContent: React.ReactNode = null;
  switch (tab) {
    case 'recap':
      tabContent = renderRecap();
      break;
    case 'identite':
      tabContent = renderSalaireIdentite();
      break;
    case 'emploi':
      tabContent = renderSalaireEmploi();
      break;
    case 'client':
      tabContent = renderIndClient();
      break;
    case 'elig':
      tabContent = renderIndElig();
      break;
    case 'demandeur':
      tabContent = renderIndDemandeur();
      break;
    case 'business':
      tabContent = renderIndBusiness();
      break;
    case 'pret':
      tabContent = renderIndPret();
      break;
    case 'docs':
      tabContent = renderDocs();
      break;
    default:
      tabContent = null;
  }

  return (
    <View style={styles.root}>
      <HomeHeader
        variant="detail"
        title={d.reference}
        onBack={onBack}
      />

      

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomInset + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroName} numberOfLines={1}>
            {d.client.fullName}
          </Text>
          <Text style={styles.heroAmount}>{montantLabel}</Text>
          {salaireNet ? (
            <Text style={styles.heroSub}>Salaire net : {salaireNet}</Text>
          ) : null}
          <View style={styles.heroMeta}>
            <Text style={styles.heroType} numberOfLines={1}>
              {TYPE_LABELS[d.type] || d.type}
            </Text>
            <View style={[styles.heroBadge, { backgroundColor: tone.bg }]}>
              <Text
                style={[styles.heroBadgeText, { color: tone.fg }]}
                numberOfLines={1}
              >
                {DOSSIER_ETAT_LABELS[d.etat] || d.etat}
              </Text>
            </View>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setTab(t.key)}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    active && styles.tabChipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
        {tabContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  tabsWrap: {
    backgroundColor: colors.primary.blue,
    marginBottom: -10,
    marginHorizontal: 0,
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 6,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  tabsRow: {
    paddingHorizontal: 4,
    gap: 2,
    alignItems: 'center',
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tabChipActive: {
    backgroundColor: '#fff',
  },
  tabChipText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
  },
  tabChipTextActive: {
    color: colors.primary.blue,
    fontFamily: fonts.semiBold,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  hero: {
    backgroundColor: HERO_BG,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 22,
    marginBottom: 16,
  },
  heroName: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.medium,
    fontSize: 15,
    marginBottom: 6,
  },
  heroAmount: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 32,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fonts.regular,
    fontSize: 14,
    marginBottom: 10,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  heroType: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fonts.semiBold,
    fontSize: 14,
    flexShrink: 1,
  },
  heroBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  infoCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 12,
  },
  infoCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.neutral.text,
    paddingTop: 12,
    paddingBottom: 4,
  },
  infoRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
  },
  infoLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.neutral.textMuted,
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.neutral.text,
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.neutral.textMuted,
    paddingVertical: 14,
  },
  historyItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
  },
  historyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.neutral.text,
  },
  historyComment: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.neutral.textMuted,
    marginTop: 4,
  },
  historyDate: {
    fontFamily: fonts.light,
    fontSize: 13,
    color: colors.neutral.textHint,
    marginTop: 4,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
    gap: 12,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconOk: { backgroundColor: 'rgba(42, 178, 75, 0.12)' },
  docIconMiss: { backgroundColor: '#f3f3f3' },
  docBody: { flex: 1 },
  docLabel: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.neutral.text,
  },
  docStatus: {
    fontFamily: fonts.medium,
    fontSize: 14,
    marginTop: 2,
  },
  docStatusOk: { color: colors.secondary.green },
  docStatusMiss: { color: colors.neutral.textMuted },
  errorText: {
    color: colors.primary.red,
    fontFamily: fonts.regular,
    fontSize: 15,
    marginBottom: 8,
  },
  link: {
    color: colors.primary.blue,
    fontFamily: fonts.semiBold,
    marginTop: 12,
  },
});
