import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, StyleSheet, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '../../context/AuthContext';
import { useSupabaseClient } from '../../lib/supabase';
import { Bell, Users, Clock, Plus, BookOpen, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

const ff = Platform.OS === 'android';

export default function LecturerDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const { colors, isDark } = useTheme();
  
  const [courses, setCourses] = useState<any[]>([]);
  const [courseStats, setCourseStats] = useState<Record<string, { enrolled: number; avgPct: number; hasActiveSession?: boolean }>>({});
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  const SECONDARY = colors.secondary;

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        fetchDashboardData();
      }, 150);
      return () => clearTimeout(timer);
    }, [user])
  );

  // Real-time listener: refresh lecturer dashboard stats live
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`lecturer_dashboard_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_sessions' },
        () => {
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_records' },
        () => {
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'enrollments' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    // 1. Fetch courses
    const { data: coursesData } = await supabase
      .from('courses').select('*')
      .eq('lecturer_id', user.id)
      .order('created_at', { ascending: false });
    const coursesList = coursesData ?? [];

    if (coursesList.length === 0) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const courseIds = coursesList.map((c: any) => c.id);

    // 2. Fetch all enrollments for these courses
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id, student_id')
      .in('course_id', courseIds);

    // 3. Fetch all sessions for these courses
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id, course_id, end_time')
      .in('course_id', courseIds);

    const sessionIds = sessions?.map((s: any) => s.id) ?? [];

    // 4. Fetch all attendance records for these sessions
    let records: any[] = [];
    if (sessionIds.length > 0) {
      const { data } = await supabase
        .from('attendance_records')
        .select('session_id, status')
        .in('session_id', sessionIds);
      records = data ?? [];
    }

    // Process stats
    const uniqueStudents = new Set(enrollments?.map((e: any) => e.student_id)).size;
    setTotalStudents(uniqueStudents);
    setTotalSessions(sessions?.length ?? 0);

    // Per course stats
    const courseStatsMap: Record<string, { enrolled: number; avgPct: number; hasActiveSession: boolean }> = {};
    const now = new Date().toISOString();

    for (const c of coursesList) {
      const courseEnrolled = enrollments?.filter((e: any) => e.course_id === c.id).length ?? 0;
      const courseSessionsObj = sessions?.filter((s: any) => s.course_id === c.id) ?? [];
      const courseSessions = courseSessionsObj.map((s: any) => s.id);
      
      const hasActiveSession = courseSessionsObj.some((s: any) => s.end_time > now);
      
      if (courseSessions.length === 0 || courseEnrolled === 0) {
        courseStatsMap[c.id] = { enrolled: courseEnrolled, avgPct: 0, hasActiveSession };
        continue;
      }

      // Max possible attendances is courseEnrolled * courseSessions.length
      const totalPossible = courseEnrolled * courseSessions.length;
      const presentCount = records.filter((r) => courseSessions.includes(r.session_id) && r.status === 'present').length;
      
      courseStatsMap[c.id] = { enrolled: courseEnrolled, avgPct: Math.round((presentCount / totalPossible) * 100), hasActiveSession };
    }

    setCourses(coursesList);
    setCourseStats(courseStatsMap);
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
      <StatusBar style="light" />
      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <View style={s.headerTop}>
          <View style={s.headerLeft}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback, { backgroundColor: '#002266' }]}>
                <Text style={s.avatarInitial}>
                  {(user?.lastName || user?.firstName || 'L').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={s.greeting}>{getGreeting()}</Text>
              <Text style={s.username}>Dr. {user?.lastName || user?.firstName || 'Lecturer'}</Text>
            </View>
          </View>
          <Pressable style={s.bellBtn}>
            <Bell size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={s.statIcon}><Users size={14} color="#FFFFFF" /></View>
            <Text style={s.statNum}>{totalStudents}</Text>
            <Text style={s.statLabel}>Students</Text>
          </View>
          <View style={s.statCard}>
            <View style={s.statIcon}><Clock size={14} color="#FFFFFF" /></View>
            <Text style={s.statNum}>{totalSessions}</Text>
            <Text style={s.statLabel}>Sessions</Text>
          </View>
          <View style={s.statCard}>
            <View style={s.statIcon}><BookOpen size={14} color="#FFFFFF" /></View>
            <Text style={s.statNum}>{courses.length}</Text>
            <Text style={s.statLabel}>Courses</Text>
          </View>
        </View>
      </View>

      {/* Body */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>My Courses</Text>
          <Pressable
            onPress={() => router.push('/(lecturer)/create-course')}
            style={[s.addBtn, { backgroundColor: colors.secondaryDim }]}
          >
            <Plus size={16} color={SECONDARY} />
            <Text style={[s.addBtnText, { color: SECONDARY }]}>Add</Text>
          </Pressable>
        </View>

        {loading ? (
          <Text style={s.emptyText}>Loading courses...</Text>
        ) : courses.length === 0 ? (
          <View style={s.emptyCard}>
            <BookOpen size={40} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No Courses Yet</Text>
            <Text style={s.emptyBody}>Create your first course to get started.</Text>
            <Pressable
              onPress={() => router.push('/(lecturer)/create-course')}
              style={[s.createBtn, { backgroundColor: SECONDARY }]}
            >
              <Text style={s.createBtnText}>Create Course</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {courses.map((course) => {
              const stats = courseStats[course.id] || { enrolled: 0, avgPct: 0, hasActiveSession: false };
              return (
                <Pressable
                  key={course.id}
                  onPress={() => router.push(`/(lecturer)/course/${course.id}`)}
                  style={s.courseCard}
                >
                  <View style={s.courseInfo}>
                    <Text style={s.courseCode}>{course.course_code}</Text>
                    <Text style={s.courseTitle} numberOfLines={1}>{course.course_title}</Text>
                    <View style={s.avgRow}>
                      <Text style={s.avgLabel}>Avg Attendance</Text>
                      <Text style={s.avgNum}>{stats.avgPct}%</Text>
                    </View>
                  </View>
                  <View style={s.courseRight}>
                    {stats.hasActiveSession && (
                      <View style={[s.activeBadge, { backgroundColor: '#FEE2E2', marginBottom: 8 }]}>
                        <View style={[s.pulseDot, { backgroundColor: '#EF4444' }]} />
                        <Text style={[s.activeText, { color: '#EF4444' }]}>Live</Text>
                      </View>
                    )}
                    <View style={[s.enrollBadge, { backgroundColor: colors.secondaryDim }]}>
                      <Text style={[s.enrollText, { color: SECONDARY }]}>{stats.enrolled} Enrolled</Text>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} style={{ marginTop: 'auto' }} />
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
      backgroundColor: c.secondary, paddingHorizontal: 20, paddingBottom: 24,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', marginRight: 12 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    greeting: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: ff ? 'sans-serif' : undefined },
    username: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    bellBtn: { width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, padding: 12, alignItems: 'center' },
    statIcon: { width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    statNum: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 32 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, gap: 4 },
    addBtnText: { fontSize: 14, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    emptyText: { textAlign: 'center', color: c.textMuted, paddingVertical: 40, fontFamily: ff ? 'sans-serif' : undefined },
    emptyCard: { backgroundColor: c.card, borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: c.cardBorder },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginTop: 14, marginBottom: 8, fontFamily: ff ? 'sans-serif-medium' : undefined },
    emptyBody: { fontSize: 14, color: c.textSub, textAlign: 'center', marginBottom: 20, fontFamily: ff ? 'sans-serif' : undefined },
    createBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
    createBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, fontFamily: ff ? 'sans-serif-medium' : undefined },
    courseCard: {
      backgroundColor: c.card, borderRadius: 18, padding: 16, flexDirection: 'row',
      borderWidth: 1, borderColor: c.cardBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    courseInfo: { flex: 1 },
    courseCode: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 4, fontFamily: ff ? 'sans-serif-medium' : undefined },
    courseTitle: { fontSize: 13, color: c.textSub, marginBottom: 10, fontFamily: ff ? 'sans-serif' : undefined },
    avgRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    avgLabel: { fontSize: 12, color: c.textSub, marginRight: 8, fontFamily: ff ? 'sans-serif' : undefined },
    avgNum: { fontSize: 13, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    courseRight: { alignItems: 'flex-end', paddingLeft: 12 },
    enrollBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    enrollText: { fontSize: 12, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    activeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-end', gap: 6 },
    pulseDot: { width: 6, height: 6, borderRadius: 3 },
    activeText: { fontSize: 11, fontWeight: '700', fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
