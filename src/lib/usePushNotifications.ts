import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Only set the handler if we are NOT on Expo Go for Android, 
// since Expo completely removed the native module in SDK 53 causing it to throw on access.
if (!(Platform.OS === 'android' && Constants.appOwnership === 'expo')) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.warn("Expo Go push notifications handler error suppressed");
  }
}

export interface PushNotificationState {
  expoPushToken?: Notifications.ExpoPushToken;
  notification?: Notifications.Notification;
}

export const usePushNotifications = (): PushNotificationState => {
  const [expoPushToken, setExpoPushToken] = useState<Notifications.ExpoPushToken | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
      console.warn("Push notifications are not supported in Expo Go on Android. Skipping.");
      return undefined;
    }
    
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1B7D3C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      try {
        if (!projectId) {
          console.warn("No projectId found in app.json for Push Notifications");
        }
        token = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
      } catch (e) {
        console.error("Error getting Expo push token", e);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => setExpoPushToken(token));

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification Response:', response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return { expoPushToken, notification };
};
