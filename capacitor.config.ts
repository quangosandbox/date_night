import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.datenight.couples',
  appName: 'Date Night',
  webDir: 'dist',
  backgroundColor: '#F6CDB8',
  ios: { contentInset: 'never', scrollEnabled: true },
};

export default config;
