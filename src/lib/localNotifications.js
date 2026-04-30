import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const DAILY_NOTIFICATIONS = [
  {
    id: 7001,
    hour: 7,
    minute: 0,
    body: 'You only need 5 minutes of shadowing before you take Airi to kindergarten.',
  },
  {
    id: 12001,
    hour: 12,
    minute: 0,
    body: 'During lunch, try 10 minutes of shadowing.',
  },
  {
    id: 21001,
    hour: 21,
    minute: 0,
    body: 'Before your English class, review your phrases with a dictation lesson.',
  },
];

function isIosNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export async function initializeDailyReminders() {
  if (!isIosNativeApp()) {
    return;
  }

  const permissionStatus = await LocalNotifications.checkPermissions();
  const displayPermission = permissionStatus.display;

  let granted = displayPermission === 'granted';

  if (displayPermission === 'prompt') {
    const requestResult = await LocalNotifications.requestPermissions();
    granted = requestResult.display === 'granted';
  }

  if (!granted) {
    return;
  }

  const notifications = DAILY_NOTIFICATIONS.map(({ id }) => ({ id }));
  await LocalNotifications.cancel({ notifications });

  await LocalNotifications.schedule({
    notifications: DAILY_NOTIFICATIONS.map(({ id, hour, minute, body }) => ({
      id,
      title: 'Phrz4g Reminder',
      body,
      schedule: {
        on: {
          hour,
          minute,
        },
        repeats: true,
      },
      sound: null,
    })),
  });
}
