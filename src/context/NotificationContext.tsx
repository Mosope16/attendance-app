import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setupNotificationChannels,
  getNotificationPermissionStatus,
  requestNotificationAccess,
  ensureNotificationAccessPrompt,
  notifyCourseEnrolled,
  notifyAttendanceSessionActive,
} from '../lib/notifications';
import { useUser } from './AuthContext';
import { useSupabaseClient } from '../lib/supabase';

interface NotificationContextType {
  isPermissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  promptForCourseAccess: (courseCode?: string) => Promise<boolean>;
  checkActiveSessionsForEnrolledCourses: () => Promise<void>;
  notifyEnrolledCourse: (courseCode: string, courseTitle?: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  isPermissionGranted: false,
  requestPermission: async () => false,
  promptForCourseAccess: async () => false,
  checkActiveSessionsForEnrolledCourses: async () => {},
  notifyEnrolledCourse: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabaseClient();

  // Initialize channels and check initial permission
  useEffect(() => {
    let isMounted = true;
    (async () => {
      await setupNotificationChannels();
      const status = await getNotificationPermissionStatus();
      if (isMounted) {
        setIsPermissionGranted(status.granted);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for user interaction with notification banners
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'session_active' || data?.sessionId) {
        router.push('/(student)');
      }
    });

    return () => {
      sub.remove();
    };
  }, [router]);

  // Prompt user on login/initial mount if they haven't been prompted yet
  useEffect(() => {
    if (!user || user.role !== 'student') return;

    (async () => {
      const perm = await getNotificationPermissionStatus();
      if (perm.granted) {
        setIsPermissionGranted(true);
        return;
      }

      // Check if we have already asked them during this session / stored state
      const hasAsked = await AsyncStorage.getItem('@notif_auto_prompted_' + user.id);
      if (!hasAsked) {
        await AsyncStorage.setItem('@notif_auto_prompted_' + user.id, 'true');
        const granted = await ensureNotificationAccessPrompt();
        setIsPermissionGranted(granted);
      }
    })();
  }, [user?.id, user?.role]);

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationAccess();
    setIsPermissionGranted(granted);
    return granted;
  }, []);

  const promptForCourseAccess = useCallback(async (courseCode?: string) => {
    const granted = await ensureNotificationAccessPrompt(courseCode);
    setIsPermissionGranted(granted);
    return granted;
  }, []);

  const notifyEnrolledCourse = useCallback(async (courseCode: string, courseTitle?: string) => {
    await notifyCourseEnrolled(courseCode, courseTitle);
  }, []);

  // Periodically or on demand check active sessions for student's enrolled courses
  const checkActiveSessionsForEnrolledCourses = useCallback(async () => {
    if (!user || user.role !== 'student') return;

    try {
      // 1. Get enrolled course IDs
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id, course:course_id ( id, course_code, course_title )')
        .eq('student_id', user.id);

      const enrolledCourses = (enrollments || []).map((e: any) => e.course).filter(Boolean);
      if (enrolledCourses.length === 0) return;

      const courseIds = enrolledCourses.map((c: any) => c.id);

      // 2. Query any active sessions (created in last 3 hours and is_active = true)
      const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data: activeSessions } = await supabase
        .from('attendance_sessions')
        .select('id, course_id, start_time, is_active')
        .in('course_id', courseIds)
        .eq('is_active', true)
        .gt('start_time', cutoff);

      if (activeSessions && activeSessions.length > 0) {
        for (const session of activeSessions) {
          const matchedCourse = enrolledCourses.find((c: any) => c.id === session.course_id);
          if (matchedCourse) {
            await notifyAttendanceSessionActive(
              matchedCourse.course_code,
              session.id,
              matchedCourse.course_title
            );
          }
        }
      }
    } catch (e) {
      console.warn('Error checking active sessions for notifications:', e);
    }
  }, [user?.id, user?.role, supabase]);

  return (
    <NotificationContext.Provider
      value={{
        isPermissionGranted,
        requestPermission,
        promptForCourseAccess,
        checkActiveSessionsForEnrolledCourses,
        notifyEnrolledCourse,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
