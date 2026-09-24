import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, StyleSheet, Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useUser } from '../../context/AuthContext';
import { useSupabaseClient } from '../../lib/supabase';
import { Bell, BookOpen, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { parseSafeDate } from '../../lib/dateUtils';

const ff = Platform.OS === 'android';

export default function StudentDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { colors, isDark } = useTheme();
  const supabase = useSupabaseClient();
  const PRIMARY = colors.primary;
  const { isPermissionGranted, promptForCourseAccess, checkActiveSessionsForEnrolledCourses } = useNotifications();

  const [courses, setCourses] = useState<any[]>([]);
  const [overallPct, setOverallPct] = useState<number | null>(null);
  const [weekCount, setWeekCount] = useState<number>(0);
  const [courseStats, setCourseStats] = useState<Record<string, { present: number; total: number }>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor(isDark ? '#0D3320' : PRIMARY);
      const timer = setTimeout(() => {
        fetchAll();
        checkActiveSessionsForEnrolledCourses();
      }, 150);
      return () => clearTimeout(timer);
    }, [user?.id, isDark, PRIMARY, checkActiveSessionsForEnrolledCourses])
  );

  // Real-time listener: refresh stats when sessions open or attendance is marked
  React.useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`student_dashboard_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_sessions' },
        () => {
          fetchAll();
          checkActiveSessionsForEnrolledCourses();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_records' },
        (payload: any) => {
          if (payload?.new?.student_id === user.id) {
            fetchAll();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, checkActiveSessionsForEnrolledCourses]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    // Enrolled courses
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course:course_id ( id, course_code, course_title )')
      .eq('student_id', user.id);

    const enrolledCourses = enrollments?.map((e: any) => e.course) ?? [];
    setCourses(enrolledCourses);

    if (enrolledCourses.length === 0) {
      setLoading(false);
      return;
    }

    const courseIds = enrolledCourses.map((c: any) => c.id);

    // All sessions for enrolled courses
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id, course_id')
      .in('course_id', courseIds);

    const allSessionIds = sessions?.map((s: any) => s.id) ?? [];

    // Student's attendance records
    const { data: records } = await supabase
      .from('attendance_records')
      .select('session_id, status, timestamp')
      .eq('student_id', user.id)
      .in('session_id', allSessionIds);

    // Overall attendance %
    const presentTotal = records?.filter((r: any) => r.status === 'present').length ?? 0;
    const pct = allSessionIds.length > 0
      ? Math.round((presentTotal / allSessionIds.length) * 100)
      : null;
    setOverallPct(pct);

    // This week's count
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = records?.filter((r: any) => parseSafeDate(r.timestamp) >= weekStart).length ?? 0;
    setWeekCount(thisWeek);

    // Per-course stats
    const stats: Record<string, { present: number; total: number }> = {};
    for (const course of enrolledCourses) {
      const courseSessions = sessions?.filter((s: any) => s.course_id === course.id) ?? [];
      const courseSessionIds = courseSessions.map((s: any) => s.id);
      const present = records?.filter((r: any) => courseSessionIds.includes(r.session_id) && r.status === 'present').length ?? 0;
      stats[course.id] = { present, total: courseSessions.length };
    }
    setCourseStats(stats);
    setLoading(false);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const s = makeStyles(colors);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <View style={s.headerInner}>
          <View style={s.headerLeft}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback, { backgroundColor: '#13532C' }]}>
                <Text style={s.avatarInitial}>
                  {(user?.firstName || 'S').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={s.greeting}>{getGreeting()}</Text>
              <Text style={s.username}>Hi, {user?.firstName || 'Student'}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/(student)/notifications')} style={s.bellBtn}>
            <Bell size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{courses.length}</Text>
            <Text style={s.statLabel}>Courses</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{overallPct !== null ? `${overallPct}%` : '—'}</Text>
            <Text style={s.statLabel}>Attendance</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{weekCount}</Text>
            <Text style={s.statLabel}>This Week</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {!isPermissionGranted && (
          <View style={s.notifBanner}>
            <View style={s.notifBannerLeft}>
              <View style={[s.notifIconWrap, { backgroundColor: colors.primaryDim }]}>
                <Bell size={18} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.notifBannerTitle}>Push Notifications Disabled</Text>
                <Text style={s.notifBannerSub}>Enable notifications so you never miss an attendance session.</Text>
              </View>
            </View>
            <Pressable
              onPress={() => promptForCourseAccess()}
              style={[s.notifBannerBtn, { backgroundColor: PRIMARY }]}
            >
              <Text style={s.notifBannerBtnText}>Enable</Text>
            </Pressable>
          </View>
        )}

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>My Courses</Text>
          <Pressable onPress={() => router.push('/(student)/enroll')}>
            <Text style={[s.sectionLink, { color: PRIMARY }]}>+ Enroll</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : courses.length === 0 ? (
          <View style={s.emptyCard}>
            <BookOpen size={40} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No Courses Yet</Text>
            <Text style={s.emptyBody}>Enroll in a course to start tracking your attendance.</Text>
            <Pressable onPress={() => router.push('/(student)/enroll')} style={[s.joinBtn, { backgroundColor: PRIMARY }]}>
              <Text style={s.joinBtnText}>Enroll in a Course</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {courses.map((course) => {
              const stat = courseStats[course.id] ?? { present: 0, total: 0 };
              const pct = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;
              return (
                <Pressable
                  key={course.id}
                  onPress={() => router.push(`/(student)/course/${course.id}`)}
                  style={s.courseCard}
                >
                  <View style={s.courseLeft}>
                    <Text style={s.courseCode}>{course.course_code}</Text>
                    <Text style={s.courseTitle} numberOfLines={1}>{course.course_title}</Text>
                    <View style={[s.sessionBadge, { backgroundColor: colors.primaryDim }]}>
                      <Text style={[s.sessionBadgeText, { color: colors.primaryText }]}>
                        {stat.total > 0 ? `${stat.present}/${stat.total} Sessions` : 'No sessions yet'}
                      </Text>
                    </View>
                  </View>
                  <View style={s.circleWrapper}>
                    <View style={[s.circle, { borderColor: stat.total > 0 ? (pct >= 75 ? colors.primaryDim : '#FEE2E2') : colors.cardBorder }]}>
                      <Text style={[s.circleText, { color: stat.total > 0 ? (pct >= 75 ? PRIMARY : '#EF4444') : colors.textMuted }]}>
                        {stat.total > 0 ? `${pct}%` : '—'}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} style={{ marginTop: 6 }} />
                  </View>
                </Pressable>
              );
            })}
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
      backgroundColor: c.primary, paddingHorizontal: 20, paddingBottom: 24,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    },
    headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', marginRight: 12 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    greeting: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: ff ? 'sans-serif' : undefined },
    username: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    bellBtn: { width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, padding: 12, alignItems: 'center' },
    statNum: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 32 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    sectionLink: { fontSize: 14, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    loadingBox: { paddingVertical: 60, alignItems: 'center' },
    emptyCard: { backgroundColor: c.card, borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: c.cardBorder },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginTop: 14, marginBottom: 8, fontFamily: ff ? 'sans-serif-medium' : undefined },
    emptyBody: { fontSize: 14, color: c.textSub, textAlign: 'center', marginBottom: 20, fontFamily: ff ? 'sans-serif' : undefined },
    joinBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
    joinBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, fontFamily: ff ? 'sans-serif-medium' : undefined },
    courseCard: {
      backgroundColor: c.card, borderRadius: 18, padding: 16,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderWidth: 1, borderColor: c.cardBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    courseLeft: { flex: 1 },
    courseCode: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 4, fontFamily: ff ? 'sans-serif-medium' : undefined },
    courseTitle: { fontSize: 13, color: c.textSub, marginBottom: 10, fontFamily: ff ? 'sans-serif' : undefined },
    sessionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
    sessionBadgeText: { fontSize: 12, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    circleWrapper: { alignItems: 'center', marginLeft: 12 },
    circle: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
    circleText: { fontWeight: '700', fontSize: 14, fontFamily: ff ? 'sans-serif-medium' : undefined },
    notifBanner: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: c.primaryDim,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    notifBannerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    notifIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
      fontFamily: ff ? 'sans-serif-medium' : undefined,
    },
    notifBannerSub: {
      fontSize: 12,
      color: c.textSub,
      marginTop: 2,
      fontFamily: ff ? 'sans-serif' : undefined,
    },
    notifBannerBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifBannerBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      fontFamily: ff ? 'sans-serif-medium' : undefined,
    },
  });
}
