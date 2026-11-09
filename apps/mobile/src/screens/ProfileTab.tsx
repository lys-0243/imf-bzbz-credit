import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@imf/assets';
import type { DossierEtat } from '@imf/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { confirmAction, showInfo } from '../dialog';
import { TAB_BAR_BASE_HEIGHT } from '../components/BottomTabBar';
import { UserAvatar } from '../components/UserAvatar';
import { webSheet } from '../webLayout';

const APP_VERSION = '1.0.0';

const ROLE_LABELS: Record<string, string> = {
  RECEPTION: 'Réception',
  AGENT: 'Agent',
  ANALYSTE: 'Analyste',
  ADMIN: 'Admin',
};

const TERMINAL_ETATS: DossierEtat[] = ['A_DECAISSER', 'REJETE'];

type DossierRow = { id: string; etat: DossierEtat };

type Props = {
  onNavigate?: (tab: 'dossiers' | 'alertes') => void;
};

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

export function ProfileTab({ onNavigate }: Props) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [infoOpen, setInfoOpen] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [enCours, setEnCours] = useState<number | null>(null);
  const [statsBusy, setStatsBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsBusy(true);
      try {
        const rows = await api<DossierRow[]>('/dossiers');
        if (cancelled) return;
        setTotal(rows.length);
        setEnCours(
          rows.filter((r) => !TERMINAL_ETATS.includes(r.etat)).length,
        );
      } catch {
        if (!cancelled) {
          setTotal(null);
          setEnCours(null);
        }
      } finally {
        if (!cancelled) setStatsBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const bottomPad = TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, 12) + 24;

  const openInfo = () => setInfoOpen(true);

  const generalItems: MenuItem[] = [
    {
      key: 'info',
      label: 'Mes informations',
      icon: 'person-outline',
      onPress: openInfo,
    },
    {
      key: 'dossiers',
      label: 'Mes dossiers',
      icon: 'folder-outline',
      onPress: () => onNavigate?.('dossiers'),
    },
    {
      key: 'alertes',
      label: 'Notifications',
      icon: 'notifications-outline',
      onPress: () => onNavigate?.('alertes'),
    },
  ];

  const supportItems: MenuItem[] = [
    {
      key: 'aide',
      label: 'Aide',
      icon: 'help-circle-outline',
      onPress: () =>
        showInfo(
          'Aide',
          'Pour toute assistance, contactez le support IMF via votre responsable d’agence.',
        ),
    },
    {
      key: 'about',
      label: 'À propos',
      icon: 'information-circle-outline',
      onPress: () =>
        showInfo('À propos', `Application mobile IMF\nVersion ${APP_VERSION}`),
    },
    {
      key: 'logout',
      label: 'Déconnexion',
      icon: 'log-out-outline',
      destructive: true,
      onPress: () => {
        confirmAction(
          'Déconnexion',
          'Voulez-vous vous déconnecter ?',
          'Déconnexion',
          () => logout(),
        );
      },
    },
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.identity} onPress={openInfo}>
          <UserAvatar
            name={user.displayName}
            size={80}
            style={styles.avatar}
          />
          <Text style={styles.name} numberOfLines={2}>
            {user.displayName}
          </Text>
          <Text style={styles.infoLink}>Voir mes informations ›</Text>
        </Pressable>

        <View style={styles.statsRow}>
          <StatCard
            value={statsBusy ? '…' : total != null ? String(total) : '—'}
            label="Dossiers"
          />
          <StatCard
            value={statsBusy ? '…' : enCours != null ? String(enCours) : '—'}
            label="En cours"
          />
          <StatCard value={roleLabel} label="Rôle" accent />
        </View>

        <MenuSection title="Général" items={generalItems} />
        <MenuSection title="Support" items={supportItems} />
      </ScrollView>

      <Modal
        visible={infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={[styles.modalSheet, webSheet]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Mes informations</Text>
            <InfoRow label="Nom" value={user.displayName} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Rôle" value={roleLabel} />
            <InfoRow
              label="Zone"
              value={user.zone?.name || (user.zoneId ? user.zoneId : '—')}
            />
            <Pressable
              style={styles.modalClose}
              onPress={() => setInfoOpen(false)}
            >
              <Text style={styles.modalCloseText}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatCard({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      {value === '…' ? (
        <ActivityIndicator size="small" color={colors.primary.blue} />
      ) : (
        <Text
          style={[styles.statValue, accent && styles.statValueAccent]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuSection({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <View style={styles.menuCard}>
      <Text style={styles.menuTitle}>{title}</Text>
      {items.map((item, i) => (
        <Pressable
          key={item.key}
          style={[
            styles.menuRow,
            i < items.length - 1 && styles.menuRowBorder,
          ]}
          onPress={item.onPress}
        >
          <View
            style={[
              styles.menuIconWrap,
              item.destructive && styles.menuIconWrapDanger,
            ]}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={
                item.destructive ? colors.primary.red : colors.primary.blue
              }
            />
          </View>
          <Text
            style={[
              styles.menuLabel,
              item.destructive && styles.menuLabelDanger,
            ]}
          >
            {item.label}
          </Text>
          {!item.destructive ? (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.neutral.textHint}
            />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const softShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral.background },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  identity: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  avatar: {
    marginBottom: 14,
    borderColor: colors.primary.blue,
    borderWidth: 2,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  infoLink: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 84,
    ...softShadow,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.neutral.text,
    marginBottom: 4,
  },
  statValueAccent: {
    color: colors.primary.blue,
    fontSize: 16,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.neutral.textMuted,
  },
  menuCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    marginBottom: 14,
    ...softShadow,
  },
  menuTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.neutral.text,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(40, 64, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconWrapDanger: {
    backgroundColor: 'rgba(154, 28, 32, 0.1)',
  },
  menuLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.neutral.text,
  },
  menuLabelDanger: {
    color: colors.primary.red,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d8d8d8',
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.neutral.text,
    marginBottom: 8,
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
  },
  infoLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.neutral.textMuted,
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.neutral.text,
  },
  modalClose: {
    marginTop: 18,
    backgroundColor: colors.primary.blue,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
