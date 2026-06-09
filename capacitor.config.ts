import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovervault.app',
  appName: 'Our Sanctuary',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FF4D94',
      overlaysWebView: false
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#FF4D94'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
