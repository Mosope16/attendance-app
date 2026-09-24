import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_PERMISSION_PROMPTED_KEY = '@notif_permission_prompted';
const NOTIFIED_SESSIONS_KEY = '@notified_session_ids';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Initialize notification channels on Android and basic handler
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('course-attendance', {
        name: 'Course Attendance Alerts',
        description: 'Instant alerts when attendance sessions open for your enrolled courses',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#16A34A',
        enableLights: true,
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('course-enrollment', {
        name: 'Course Enrollments',
        description: 'Updates when you enroll in new courses',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#16A34A',
      });
    } catch (e) {
      console.warn('Failed to configure Android notification channels:', e);
    }
  }
}

/**
 * Check the current push notification permission status
 */
export async function getNotificationPermissionStatus(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
}> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return {
      granted: settings.granted || settings.status === Notifications.PermissionStatus.GRANTED,
      canAskAgain: settings.canAskAgain,
      status: settings.status,
    };
  } catch (e) {
    console.warn('Error reading notification permissions:', e);
    return {
      granted: false,
      canAskAgain: true,
      status: Notifications.PermissionStatus.UNDETERMINED,
    };
  }
}

/**
 * Request notification permissions from the OS
 */
export async function requestNotificationAccess(): Promise<boolean> {
  try {
    await setupNotificationChannels();
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    const isGranted = status === Notifications.PermissionStatus.GRANTED;
    await AsyncStorage.setItem(NOTIF_PERMISSION_PROMPTED_KEY, 'true');
    return isGranted;
  } catch (e) {
    console.warn('Error requesting notification permissions:', e);
    return false;
  }
}

/**
 * Prompt user to grant notification access if they haven't yet, explaining the value for enrolled courses
 */
export async function ensureNotificationAccessPrompt(courseCode?: string): Promise<boolean> {
  const current = await getNotificationPermissionStatus();
  if (current.granted) {
    return true;
  }

  return new Promise((resolve) => {
    const title = courseCode
      ? `Get Alerts for ${courseCode}`
      : 'Enable Course Notifications';

    const message = courseCode
      ? `Would you like to receive instant notifications whenever an attendance session opens for ${courseCode}?`
      : 'Never miss an attendance session! Enable notifications to receive instant alerts when your lecturers start taking attendance.';

    Alert.alert(
      title,
      message,
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => {
            AsyncStorage.setItem(NOTIF_PERMISSION_PROMPTED_KEY, 'true');
            resolve(false);
          },
        },
        {
          text: 'Allow Notifications',
          style: 'default',
          onPress: async () => {
            const granted = await requestNotificationAccess();
            if (!granted && !current.canAskAgain) {
              Alert.alert(
                'Permission Required',
                'Notification permission was previously denied. Please enable notifications in your device settings to get attendance alerts.',
                [{ text: 'OK' }]
              );
            }
            resolve(granted);
          },
        },
      ],
      { cancelable: true }
    );
  });
}

/**
 * Dispatches a local notification confirming course enrollment
 */
export async function notifyCourseEnrolled(courseCode: string, courseTitle?: string): Promise<void> {
  try {
    const perm = await getNotificationPermissionStatus();
    if (!perm.granted) return;

    await setupNotificationChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Enrolled in ${courseCode}`,
        body: courseTitle
          ? `${courseTitle} — You will receive alerts when attendance sessions open.`
          : `You will now receive notifications whenever attendance sessions are active for ${courseCode}.`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'enrollment', courseCode },
      },
      trigger: null, // deliver immediately
    });
  } catch (e) {
    console.warn('Failed to schedule course enrollment notification:', e);
  }
}

/**
 * Dispatches a notification when an attendance session starts for an enrolled course
 */
export async function notifyAttendanceSessionActive(
  courseCode: string,
  sessionId: string,
  courseTitle?: string
): Promise<void> {
  try {
    const perm = await getNotificationPermissionStatus();
    if (!perm.granted) return;

    // Prevent notifying repeatedly for the same session
    const stored = await AsyncStorage.getItem(NOTIFIED_SESSIONS_KEY);
    const notifiedSet = new Set<string>(stored ? JSON.parse(stored) : []);

    if (notifiedSet.has(sessionId)) {
      return;
    }

    notifiedSet.add(sessionId);
    await AsyncStorage.setItem(
      NOTIFIED_SESSIONS_KEY,
      JSON.stringify(Array.from(notifiedSet).slice(-50))
    );

    await setupNotificationChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Attendance Active: ${courseCode}`,
        body: courseTitle
          ? `An attendance session has just opened for ${courseTitle}. Tap to mark your attendance!`
          : `An attendance session has just opened for ${courseCode}. Tap to mark your attendance!`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { type: 'session_active', courseCode, sessionId },
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Failed to schedule session active notification:', e);
  }
}
