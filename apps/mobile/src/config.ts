import { Platform } from 'react-native';

// Émulateur Android: 10.0.2.2 = localhost du PC
// Appareil physique: remplace par l'IP LAN (ex. http://192.168.1.10:3001)
// Navigateur (Expo web): EXPO_PUBLIC_WEB_API_URL, sinon même hôte que la
// page sur le port 3001 — indépendant de l'IP LAN, qui change selon le réseau.
export const API_URL =
  Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_WEB_API_URL ||
      `http://${window.location.hostname}:3001`
    : process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3001';
