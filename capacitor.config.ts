import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovervault.app',
  appName: '512',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#00000000',
      overlaysWebView: true
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_configurable',
      iconColor: '#9b87f5'
    }
  }
};

export default config;
