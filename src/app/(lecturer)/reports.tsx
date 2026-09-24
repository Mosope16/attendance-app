import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform, StatusBar, ActivityIndicator, Pressable, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Download, BarChart3 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/AuthContext';
import { useSupabaseClient } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { exportCsv } from '../../lib/exportCsv';

const ff = Platform.OS === 'android';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const SECONDARY = colors.secondary;

  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [studentStats, setStudentStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor(isDark ? '#071A40' : SECONDARY);
      fetchCourses();
    }, [isDark, SECONDARY, user?.id])
  );

  const fetchCourses = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('courses')
      .select('id, course_code, course_title')
      .eq('lecturer_id', user.id);
    if (data && data.length > 0) {
      setCourses(data);
      setSelectedCourse(data[0]);
      await fetchStats(data[0].id);
    } else {
      setCourses([]);
      setStudentStats([]);
    }
    setLoading(false);
  };

  const fetchStats = async (courseId: string) => {
    // Get all sessions for this course
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('course_id', courseId);

    const sessionIds = sessions?.map((s: any) => s.id) ?? [];
    const totalSessions = sessionIds.length;

    // Get enrollments with student info
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student:student_id ( id, name, matric_number )')
      .eq('course_id', courseId);

    if (!enrollments) { setStudentStats([]); return; }

    // For each student, count how many sessions they were present
    const stats = await Promise.all(enrollments.map(async (e: any) => {
      let count = 0;
      if (totalSessions > 0 && e.student?.id) {
        const { count: c } = await supabase
          .from('attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', e.student.id)
          .eq('status', 'present')
          .in('session_id', sessionIds);
        count = c ?? 0;
      }

      const pct = totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0;
      return {
        id: e.student?.id ?? Math.random().toString(),
        name: e.student?.name ?? 'Unknown',
        matric: e.student?.matric_number ?? 'Unknown',
        present: count,
        total: totalSessions,
        attendance: pct,
      };
    }));

    setStudentStats(stats.sort((a, b) => b.attendance - a.attendance));
  };

  const avgAttendance = studentStats.length > 0
    ? Math.round(studentStats.reduce((sum, s) => sum + s.attendance, 0) / studentStats.length)
    : 0;

  const handlePrintCSV = async () => {
    if (!selectedCourse) {
      Alert.alert('No Course Selected', 'Please select a course to export.');
      return;
    }
    if (studentStats.length === 0) {
      Alert.alert('No Student Data', 'There are no enrolled students or sessions to export for this course.');
      return;
    }

    try {
      setExporting(true);
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString();

      const onTrackCount = studentStats.filter((s) => s.attendance >= 75).length;
      const atRiskCount = studentStats.filter((s) => s.attendance < 75).length;

      const rows: (string | number)[][] = [
        ['SMARTATTEND ATTENDANCE REPORT'],
        ['Course Code', selectedCourse.course_code || 'N/A'],
        ['Course Title', selectedCourse.course_title || 'N/A'],
        ['Lecturer / Instructor', `Dr. ${user?.lastName || user?.firstName || 'Lecturer'}`],
        ['Report Generated Date', `${dateStr} ${timeStr}`],
        ['Class Average Attendance', `${avgAttendance}%`],
        ['Total Students Enrolled', studentStats.length],
        ['Students On Track (>= 75%)', onTrackCount],
        ['Students At Risk (< 75%)', atRiskCount],
        [], // blank separator
        ['S/N', 'Matric Number', 'Student Name', 'Present Sessions', 'Total Sessions Held', 'Attendance Rate (%)', 'Status'],
      ];

      studentStats.forEach((st, idx) => {
        const onTrack = st.attendance >= 75;
        rows.push([
          idx + 1,
          st.matric || 'N/A',
          st.name || 'N/A',
          st.present,
          st.total,
          `${st.attendance}%`,
          onTrack ? 'On Track (Eligible)' : 'At Risk (< 75%)',
        ]);
      });

      const filename = `${selectedCourse.course_code}_Attendance_Report_${dateStr}`;
      await exportCsv({
        filename,
        rows,
        dialogTitle: `Print / Share ${selectedCourse.course_code} Attendance CSV`,
      });
    } finally {
      setExporting(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <View>
          <Text style={s.headerTitle}>Reports</Text>
          <Text style={s.headerSub}>Attendance analytics & export</Text>
        </View>
        {courses.length > 0 && (
          <Pressable
            onPress={handlePrintCSV}
            disabled={exporting || studentStats.length === 0}
            style={[s.headerPrintBtn, (exporting || studentStats.length === 0) && { opacity: 0.5 }]}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Download size={16} color="#FFFFFF" />
                <Text style={s.headerPrintText}>Print CSV</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={SECONDARY} size="large" />
        </View>
      ) : courses.length === 0 ? (
        <View style={s.centered}>
          <BarChart3 size={40} color={colors.textMuted} />
          <Text style={s.emptyTitle}>No courses yet</Text>
          <Text style={s.emptySub}>Create a course to see attendance reports.</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {/* Course Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {courses.map((c: any) => (
                <View
                  key={c.id}
                  style={[s.courseTab, selectedCourse?.id === c.id && { backgroundColor: SECONDARY }]}
                >
                  <Text
                    style={[s.courseTabText, selectedCourse?.id === c.id && { color: '#FFF' }]}
                    onPress={() => { setSelectedCourse(c); fetchStats(c.id); }}
                  >
                    {c.course_code}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Average Card */}
          <View style={s.avgCard}>
            <Text style={s.avgLabel}>Average Class Attendance</Text>
            <Text style={s.avgNum}>{avgAttendance}%</Text>
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${avgAttendance}%` as any }]} />
            </View>
            <View style={s.legendRow}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={s.legendText}>{studentStats.filter(s => s.attendance >= 75).length} On Track</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={s.legendText}>{studentStats.filter(s => s.attendance < 75).length} At Risk</Text>
              </View>
            </View>
          </View>

          {/* Student List Section */}
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionLabel}>Student Breakdown</Text>
            {studentStats.length > 0 && (
              <Pressable
                onPress={handlePrintCSV}
                disabled={exporting}
                style={[s.sectionPrintBtn, { backgroundColor: colors.secondaryDim }]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={SECONDARY} />
                ) : (
                  <>
                    <Download size={14} color={SECONDARY} />
                    <Text style={[s.sectionPrintText, { color: SECONDARY }]}>Print CSV</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {studentStats.length === 0 ? (
            <View style={s.noStudents}>
              <Text style={s.noStudentsText}>No enrolled students or no sessions yet.</Text>
            </View>
          ) : (
            <View style={s.studentList}>
              {studentStats.map((student, i) => {
                const atRisk = student.attendance < 75;
                return (
                  <View
                    key={student.id}
                    style={[s.studentRow, i < studentStats.length - 1 && s.studentRowBorder]}
                  >
                    <View style={[s.studentInitial, { backgroundColor: atRisk ? (isDark ? '#450a0a' : '#FEF2F2') : colors.secondaryDim }]}>
                      <Text style={[s.studentInitialText, { color: atRisk ? '#EF4444' : SECONDARY }]}>
                        {student.name?.charAt(0) ?? '?'}
                      </Text>
                    </View>
                    <View style={s.studentInfo}>
                      <Text style={s.studentName}>{student.name}</Text>
                      <Text style={s.studentMatric}>{student.matric ?? '—'} · {student.present}/{student.total} sessions</Text>
                    </View>
                    <View style={[s.attendanceBadge, { backgroundColor: atRisk ? (isDark ? '#450a0a' : '#FEF2F2') : colors.primaryDim }]}>
                      <Text style={[s.attendanceText, { color: atRisk ? '#EF4444' : colors.primaryText }]}>
                        {student.attendance}%
                      </Text>
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
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    headerPrintBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    headerPrintText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    emptySub: { fontSize: 14, color: c.textSub, textAlign: 'center', fontFamily: ff ? 'sans-serif' : undefined },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 32 },
    courseTab: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
    },
    courseTabText: { fontSize: 13, fontWeight: '600', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    avgCard: {
      backgroundColor: c.card, borderRadius: 20, padding: 20, marginBottom: 20,
      borderWidth: 1, borderColor: c.cardBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
      alignItems: 'center',
    },
    avgLabel: { fontSize: 13, color: c.textMuted, marginBottom: 8, fontFamily: ff ? 'sans-serif' : undefined },
    avgNum: { fontSize: 48, fontWeight: '900', color: c.text, fontFamily: ff ? 'sans-serif-black' : undefined },
    progressBg: { width: '100%', height: 8, backgroundColor: c.cardAlt, borderRadius: 999, marginTop: 12, marginBottom: 16, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: c.secondary, borderRadius: 999 },
    legendRow: { flexDirection: 'row', gap: 16 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 12, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
    sectionHeaderRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 12, marginTop: 4,
    },
    sectionLabel: { fontSize: 16, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    sectionPrintBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    },
    sectionPrintText: { fontSize: 12, fontWeight: '700', fontFamily: ff ? 'sans-serif-medium' : undefined },
    noStudents: { backgroundColor: c.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center' },
    noStudentsText: { fontSize: 14, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
    studentList: {
      backgroundColor: c.card, borderRadius: 18, overflow: 'hidden',
      borderWidth: 1, borderColor: c.cardBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    studentRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    studentRowBorder: { borderBottomWidth: 1, borderBottomColor: c.cardBorder },
    studentInitial: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    studentInitialText: { fontSize: 16, fontWeight: '700', fontFamily: ff ? 'sans-serif-medium' : undefined },
    studentInfo: { flex: 1 },
    studentName: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2, fontFamily: ff ? 'sans-serif-medium' : undefined },
    studentMatric: { fontSize: 12, color: c.textMuted, fontFamily: ff ? 'sans-serif' : undefined },
    attendanceBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    attendanceText: { fontSize: 13, fontWeight: '700', fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
