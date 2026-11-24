/**
 * Mobile Push & Local Notification Service
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NotificationService = {
  /**
   * Request notification permissions and fetch device push token
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
      return tokenData?.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Schedule a local notification for appointment reminder or queue alert
   */
  async scheduleLocalNotification(title: string, body: string, secondsFromNow: number = 1): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        seconds: secondsFromNow,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  },
};
