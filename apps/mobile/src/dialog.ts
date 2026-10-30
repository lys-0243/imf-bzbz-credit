import { Alert, Platform } from 'react-native';

// Alert.alert ne fait rien sur react-native-web : on passe par les
// dialogues du navigateur.
const isWeb = Platform.OS === 'web';

export function showInfo(title: string, message: string) {
  if (isWeb) window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
) {
  if (isWeb) {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
