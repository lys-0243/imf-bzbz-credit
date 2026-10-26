'use client';

import type { ReactNode } from 'react';
import { dashStyles as styles } from './DashboardShell';

/** Briques de formulaire partagées (CF2, fiches Analyse_AGR). */
export function FormBlock({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.detailTableBlock}>
      {actions ? (
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>{title}</h3>
          {actions}
        </div>
      ) : (
        <h3 className={styles.detailTableTitle}>{title}</h3>
      )}
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

export function FormRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr>
      <td className={styles.cf1FormLabel}>{label}</td>
      <td className={styles.cf1FormValue}>{children}</td>
    </tr>
  );
}

export function AmountField({
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

export function TextInput({
  value,
  disabled,
  onChange,
  type = 'text',
  placeholder,
}: {
  value: string;
  disabled?: boolean;
  onChange: (raw: string) => void;
  type?: 'text' | 'number' | 'date' | 'datetime-local' | 'time';
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      className={styles.cf1FormControl}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextArea({
  value,
  disabled,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  disabled?: boolean;
  onChange: (raw: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      className={styles.cf2Textarea}
      rows={rows}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SelectInput<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <select
      className={styles.cf1FormControl}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value || '_'} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export const OUI_NON_OPTIONS = [
  { value: '' as const, label: '—' },
  { value: 'oui' as const, label: 'Oui' },
  { value: 'non' as const, label: 'Non' },
];

/** Options d’un select à partir d’un dictionnaire de libellés (+ « — »). */
export function optionsFromLabels<T extends string>(
  labels: Record<T, string>,
): Array<{ value: T | ''; label: string }> {
  return [
    { value: '', label: '—' },
    ...(Object.keys(labels) as T[]).map((k) => ({ value: k, label: labels[k] })),
  ];
}

export function formatMoney(n: number, devise: string): string {
  return `${n.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${devise}`;
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: digits })} %`;
}

export function SaveBar({
  label,
  busy,
  onSave,
  dirty,
}: {
  label: string;
  busy?: boolean;
  dirty?: boolean;
  onSave: () => void;
}) {
  return (
    <div className={styles.descenteFooterActions}>
      {dirty ? <span className={styles.assignMeta}>Modifications non enregistrées</span> : null}
      <button
        type="button"
        className={`${styles.btn} ${styles.btnPrimary}`}
        onClick={onSave}
        disabled={busy}
      >
        {busy ? 'Enregistrement…' : label}
      </button>
    </div>
  );
}

/** Bouton « Ajouter » d’un tableau éditable. */
export function AddRowButton({ onClick, label = 'Ajouter' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function RemoveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${styles.btnSecondary}`}
      aria-label="Supprimer la ligne"
      onClick={onClick}
    >
      ✕
    </button>
  );
}
