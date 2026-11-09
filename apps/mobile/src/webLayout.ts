import { Platform, type ViewStyle } from 'react-native';

/** Largeur max de l'app dans un navigateur (colonne centrée). */
export const WEB_MAX_WIDTH = 560;

/**
 * Les Modal sont rendues hors de la colonne sur le web : on y recentre
 * les feuilles à la même largeur. Sans effet en natif.
 */
export const webSheet: ViewStyle | null =
  Platform.OS === 'web'
    ? { width: '100%', maxWidth: WEB_MAX_WIDTH, alignSelf: 'center' }
    : null;
