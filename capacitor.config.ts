import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bingxiang.kaifan',
  appName: '冰箱开饭',
  webDir: 'dist',
  backgroundColor: '#f3f0e7',
  android: {
    backgroundColor: '#f3f0e7',
    allowMixedContent: false,
  },
}

export default config
