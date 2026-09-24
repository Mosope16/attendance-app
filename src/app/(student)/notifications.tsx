import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BellRing, BookOpen } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect } from 'expo-router';
import { useUser } from '../../context/AuthContext';
import { useSupabaseClient } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ff = Platform.OS === 'android';

function timeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " mins ago";
  return "Just now";
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const PRIMARY = colors.primary;
  
  const { user } = useUser();
  const supabase = useSupabaseClient();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      return () => {
        if (user) {
          AsyncStorage.setItem(`@last_read_notifs_${user.id}`, new Date().toISOString());
        }
      };
    }, [user?.id])
  );

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const lastReadStr = await AsyncStorage.getItem(`@last_read_notifs_${user.id}`);
      const lastRead = lastReadStr ? new Date(lastReadStr) : new Date(0);

      // 1. Fetch enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id, joined_at, course:course_id ( course_code )')
        .eq('student_id', user.id);

      const courseIds = enrollments?.map((e: any) => e.course_id) ?? [];
      let sessions: any[] = [];
      
      if (courseIds.length > 0) {
        // 2. Fetch recent sessions for enrolled courses
        const { data } = await supabase
          .from('attendance_sessions')
          .select('id, start_time, course:course_id ( course_code )')
          .in('course_id', courseIds)
          .order('start_time', { ascending: false })
          .limit(20);
        sessions = data ?? [];
      }

      const notifs = [];

      for (const e of (enrollments ?? [])) {
        if (!e.course) continue;
        const date = new Date(e.joined_at);
        notifs.push({
          id: `enroll_${e.course_id}`,
          title: 'Course Enrolled',
          message: `You successfully joined ${e.course.course_code}.`,
          timeObj: date,
          time: timeAgo(date),
          unread: date > lastRead,
          icon: 'book'
        });
      }

      for (const s of sessions) {
        if (!s.course) continue;
        const date = new Date(s.start_time);
        notifs.push({
          id: `session_${s.id}`,
          title: 'Attendance Session Started',
          message: `${s.course.course_code} session is now active.`,
          timeObj: date,
          time: timeAgo(date),
          unread: date > lastRead,
          icon: 'bell'
        });
      }

      notifs.sort((a, b) => b.timeObj.getTime() - a.timeObj.getTime());
      setNotifications(notifs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(colors);

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <View style={s.root}>
      <StatusBar style="light" backgroundColor={PRIMARY} translucent={false} />
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={s.badgePill}>
          <Text style={s.badgeText}>{unreadCount} new</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={s.emptyBox}>
            <BellRing size={40} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No Notifications</Text>
            <Text style={s.emptyBody}>You're all caught up!</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {notifications.map((notif) => (
              <View
                key={notif.id}
                style={[
                  s.notifCard,
                  notif.unread ? s.notifCardUnread : s.notifCardRead,
                ]}
              >
                <View style={[s.iconWrap, { backgroundColor: notif.unread ? colors.primaryDim : colors.cardAlt }]}>
                  {notif.icon === 'book' ? (
                    <BookOpen size={20} color={notif.unread ? PRIMARY : colors.textMuted} />
                  ) : (
                    <BellRing size={20} color={notif.unread ? PRIMARY : colors.textMuted} />
                  )}
                </View>
                <View style={s.notifBody}>
                  <Text style={[s.notifTitle, { color: notif.unread ? colors.text : colors.textSub }]}>
                    {notif.title}
                  </Text>
                  <Text style={s.notifMessage}>{notif.message}</Text>
                  <Text style={s.notifTime}>{notif.time}</Text>
                </View>
                {notif.unread && <View style={s.dot} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof import('../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      backgroundColor: c.primary, paddingHorizontal: 20, paddingBottom: 20,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    badgePill: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    badgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 32 },
    loadingBox: { paddingVertical: 60, alignItems: 'center' },
    emptyBox: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginTop: 14, marginBottom: 8, fontFamily: ff ? 'sans-serif-medium' : undefined },
    emptyBody: { fontSize: 14, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
    notifCard: {
      borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'flex-start',
      borderWidth: 1,
    },
    notifCardUnread: { backgroundColor: c.card, borderColor: c.primary },
    notifCardRead: { backgroundColor: c.cardAlt, borderColor: c.cardBorder },
    iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
    notifBody: { flex: 1 },
    notifTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4, fontFamily: ff ? 'sans-serif-medium' : undefined },
    notifMessage: { fontSize: 13, color: c.textSub, marginBottom: 6, lineHeight: 20, fontFamily: ff ? 'sans-serif' : undefined },
    notifTime: { fontSize: 11, color: c.textMuted, fontFamily: ff ? 'sans-serif' : undefined },
    dot: { width: 9, height: 9, backgroundColor: c.primary, borderRadius: 5, marginTop: 4, marginLeft: 8 },
  });
}
