import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CheckCircle, Radio } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/AuthContext';
import { useSupabaseClient } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';

const ff = Platform.OS === 'android';

export default function SessionsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const SECONDARY = colors.secondary;

  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor(isDark ? '#071A40' : SECONDARY);
      fetchSessions();
    }, [isDark, SECONDARY, user?.id])
  );

  const fetchSessions = async () => {
    if (!user) return;
    setLoading(true);
    const now = new Date().toISOString();

    // Fetch sessions for courses taught by this lecturer
    const { data: lecturerCourses } = await supabase
      .from('courses')
      .select('id')
      .eq('lecturer_id', user.id);

    if (!lecturerCourses || lecturerCourses.length === 0) {
      setActiveSessions([]);
      setPastSessions([]);
      setLoading(false);
      return;
    }

    const courseIds = lecturerCourses.map((c: any) => c.id);

    const { data: allSessions } = await supabase
      .from('attendance_sessions')
      .select(`
        id, attendance_code, start_time, end_time,
        course:course_id ( course_code, course_title ),
        attendance_records ( id )
      `)
      .in('course_id', courseIds)
      .order('start_time', { ascending: false });

    if (allSessions) {
      setActiveSessions(allSessions.filter((s: any) => s.end_time > now));
      setPastSessions(allSessions.filter((s: any) => s.end_time <= now));
    }
    setLoading(false);
  };

  const s = makeStyles(colors);

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <Text style={s.headerTitle}>Sessions</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>{activeSessions.length} live</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={SECONDARY} size="large" />
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {/* Active Sessions */}
          <Text style={s.sectionLabel}>🔴 Active Sessions</Text>
          {activeSessions.length === 0 ? (
            <View style={s.emptyCard}>
              <Radio size={24} color={colors.textMuted} />
              <Text style={s.emptyText}>No active sessions right now.</Text>
            </View>
          ) : (
            activeSessions.map((session: any) => (
              <View key={session.id} style={s.activeCard}>
                <View style={s.activeLeft}>
                  <View style={s.liveRow}>
                    <View style={s.liveDot} />
                    <Text style={s.liveCourse}>{session.course?.course_code}</Text>
                  </View>
                  <Text style={s.activeCode}>Code: {session.attendance_code}</Text>
                  <Text style={s.activeTime}>
                    Ends {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={s.presentBox}>
                  <Text style={s.presentNum}>{session.attendance_records?.length ?? 0}</Text>
                  <Text style={s.presentLabel}>Present</Text>
                </View>
              </View>
            ))
          )}

          {/* Past Sessions */}
          <Text style={[s.sectionLabel, { marginTop: 8 }]}>Recent Sessions</Text>
          {pastSessions.length === 0 ? (
            <View style={s.emptyCard}>
              <CheckCircle size={24} color={colors.textMuted} />
              <Text style={s.emptyText}>No past sessions yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {pastSessions.map((session: any) => {
                const total = session.attendance_records?.length ?? 0;
                return (
                  <View key={session.id} style={s.pastCard}>
                    <View style={s.pastIcon}>
                      <CheckCircle size={22} color={SECONDARY} />
                    </View>
                    <View style={s.pastInfo}>
                      <Text style={s.pastCourse}>{session.course?.course_code}</Text>
                      <Text style={s.pastDate}>
                        {new Date(session.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <View style={s.attendanceBadge}>
                      <Text style={s.attendanceText}>{total} present</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c: ReturnType<typeof import('../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      backgroundColor: c.secondary, paddingHorizontal: 20, paddingBottom: 20,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    countBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    countText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 32 },
    sectionLabel: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12, fontFamily: ff ? 'sans-serif-medium' : undefined },
    emptyCard: {
      backgroundColor: c.card, borderRadius: 16, padding: 20,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 20,
    },
    emptyText: { fontSize: 14, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
    activeCard: {
      backgroundColor: c.secondaryDim, borderRadius: 18, padding: 16,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderWidth: 1, borderColor: c.secondary, marginBottom: 20,
    },
    activeLeft: { flex: 1 },
    liveRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    liveDot: { width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 4, marginRight: 8 },
    liveCourse: { fontSize: 18, fontWeight: '700', color: c.secondaryText, fontFamily: ff ? 'sans-serif-medium' : undefined },
    activeCode: { fontSize: 14, color: c.secondary, fontWeight: '600', marginBottom: 4, fontFamily: ff ? 'sans-serif-medium' : undefined },
    activeTime: { fontSize: 12, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
    presentBox: { backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, alignItems: 'center', marginLeft: 12, borderWidth: 1, borderColor: c.cardBorder },
    presentNum: { fontSize: 22, fontWeight: '700', color: c.secondary, fontFamily: ff ? 'sans-serif-medium' : undefined },
    presentLabel: { fontSize: 11, color: c.textMuted, fontFamily: ff ? 'sans-serif' : undefined },
    pastCard: {
      backgroundColor: c.card, borderRadius: 16, padding: 14,
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: c.cardBorder,
    },
    pastIcon: { width: 44, height: 44, backgroundColor: c.secondaryDim, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    pastInfo: { flex: 1 },
    pastCourse: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 3, fontFamily: ff ? 'sans-serif-medium' : undefined },
    pastDate: { fontSize: 12, color: c.textMuted, fontFamily: ff ? 'sans-serif' : undefined },
    attendanceBadge: { backgroundColor: c.primaryDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    attendanceText: { fontSize: 13, fontWeight: '700', color: c.primaryText, fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
