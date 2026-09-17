// Émulateur Android: 10.0.2.2 = localhost du PC
// Appareil physique: remplace par l'IP LAN (ex. http://192.168.1.10:3001)
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3001';
