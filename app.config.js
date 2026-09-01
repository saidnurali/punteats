export default ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config || {}),
        googleMaps: {
          // The API key is securely injected from environment variables during build time.
          // In Google Cloud Console, this API key MUST be restricted to:
          // 1. Android apps: package name "com.punteats.app" + SHA-1 certificate fingerprint
          // 2. iOS apps: bundle identifier "com.punteats.app"
          // 3. API Restrictions: Maps SDK for Android, Maps SDK for iOS, Places API, Directions API
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY_HERE"
        }
      }
    }
  };
};
