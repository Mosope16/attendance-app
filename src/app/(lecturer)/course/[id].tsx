import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '../../../context/AuthContext';
import { useSupabaseClient } from '../../../lib/supabase';
import { ChevronLeft, Users, QrCode, User, Clock, RefreshCw, Download } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';

const ff = Platform.OS === 'android';

export default function LecturerCourseDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const { colors, isDark } = useTheme();

  const [course, setCourse] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') StatusBar.setBackgroundColor(isDark ? '#071A40' : colors.secondary);
  }, [isDark, colors.secondary]);

  const loadData = async () => {
    try {
      // Fetch course and students
      const [courseRes, studentsRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', id).single(),
        supabase.from('enrollments').select('id, student:student_id ( id, name, matric_number )').eq('course_id', id)
      ]);

      if (courseRes.data) setCourse(courseRes.data);
      if (studentsRes.data) setStudents(studentsRes.data);

      // Fetch active session
      const now = new Date().toISOString();
      const { data: sessionData } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('course_id', id)
        .gt('end_time', now)
        .order('end_time', { ascending: false })
        .limit(1)
        .single();
      
      setActiveSession(sessionData ?? null);

      // If active session, fetch attendance records
      if (sessionData) {
        const { data: recordsData } = await supabase
          .from('attendance_records')
          .select('student_id')
          .eq('session_id', sessionData.id)
          .eq('status', 'present');
        
        const presentIds = new Set<string>((recordsData ?? []).map((r: any) => r.student_id as string));
        setPresentStudentIds(presentIds);
      } else {
        setPresentStudentIds(new Set<string>());
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [id])
  );

  // Real-time subscription to automatically update the roster when a student marks present
  useEffect(() => {
    if (!activeSession?.id) return;

    const channel = supabase
      .channel(`realtime_attendance_${activeSession.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_records', filter: `session_id=eq.${activeSession.id}` },
        (payload) => {
          setPresentStudentIds((prev) => {
            const newSet = new Set(prev);
            newSet.add(payload.new.student_id);
            return newSet;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id, supabase]);

  // Real-time subscription to update the enrolled list if a new student enrolls
  useEffect(() => {
    const channel = supabase
      .channel(`realtime_enrollments_${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'enrollments', filter: `course_id=eq.${id}` },
        () => {
          // Re-fetch just the students list so the roster updates
          supabase
            .from('enrollments')
            .select('id, student:student_id ( id, name, matric_number )')
            .eq('course_id', id)
            .then(({ data }) => {
              if (data) setStudents(data);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, supabase]);

  const startSession = async () => {
    let latitude = null;
    let longitude = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to use Geo-fencing for attendance.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      latitude = location.coords.latitude;
      longitude = location.coords.longitude;
    } catch (err) {
      Alert.alert('Location Error', 'Could not get your location. Please ensure location services are enabled.');
      return;
    }

    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const endTime = new Date(Date.now() + 10 * 60000).toISOString();
    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({ course_id: id, attendance_code: code, end_time: endTime, latitude, longitude })
      .select()
      .single();
    if (data && !error) {
      setActiveSession(data);
      setPresentStudentIds(new Set());
    } else {
      Alert.alert('Error', 'Failed to start session.');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleExportCSV = async () => {
    try {
      const rows = [['Matric Number', 'Name', 'Status']];
      for (const item of students) {
        const student = item.student;
        if (!student) continue;
        const isPresent = presentStudentIds.has(student.id);
        rows.push([
          student.matric_number || 'N/A',
          student.name || 'N/A',
          isPresent ? 'Present' : 'Absent'
        ]);
      }
      
      const csvString = rows.map(r => r.join(',')).join('\n');
      const filename = `${course.course_code}_Attendance_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = `${(FileSystem as any).documentDirectory || ''}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Attendance' });
      } else {
        alert('Sharing is not available on this device');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to export CSV');
    }
  };

  const SECONDARY = colors.secondary;
  const s = makeStyles(colors);

  if (loading || !course) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={SECONDARY} />
        <Text style={s.loadingText}>Loading course...</Text>
      </View>
    );
  }

  const totalEnrolled = students.length || 0;
  const presentStudents = presentStudentIds.size;
  const progressPercentage = totalEnrolled > 0 ? (presentStudents / totalEnrolled) * 100 : 0;

  const radius = 54;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <View style={s.root}>

      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <ChevronLeft size={22} color="#FFFFFF" />
          </Pressable>
          <View style={s.headerText}>
            <Text style={s.courseCode} numberOfLines={1}>{course.course_code}</Text>
            <Text style={s.courseTitle} numberOfLines={1}>{course.course_title}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.statChip}>
            <Text style={s.statNum}>{totalEnrolled}</Text>
            <Text style={s.statLabel}>Enrolled</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statChip}>
            <Text style={s.statNum}>{activeSession ? presentStudents : '—'}</Text>
            <Text style={s.statLabel}>Present</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statChip}>
            <Text style={s.statNum}>{activeSession ? Math.max(0, totalEnrolled - presentStudents) : '—'}</Text>
            <Text style={s.statLabel}>Absent</Text>
          </View>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        {/* Session Card */}
        {activeSession ? (
          <View style={s.card}>
            <View style={s.liveHeader}>
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>SESSION LIVE</Text>
              </View>
              <Pressable onPress={handleRefresh} style={s.refreshBtn}>
                <RefreshCw size={18} color={SECONDARY} />
              </Pressable>
            </View>

            {/* Progress Ring */}
            <View style={s.ringWrapper}>
              <Svg width={140} height={140}>
                <Circle cx={70} cy={70} r={radius} stroke={colors.cardBorder} strokeWidth={strokeWidth} fill="none" />
                <Circle
                  cx={70} cy={70} r={radius}
                  stroke={SECONDARY} strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round" fill="none"
                  rotation="-90" origin="70, 70"
                />
              </Svg>
              <View style={s.ringCenter}>
                <Text style={[s.ringPct, { color: SECONDARY }]}>{Math.round(progressPercentage)}%</Text>
                <Text style={s.ringLabel}>Present</Text>
              </View>
            </View>

            <Text style={s.codeLabel}>Attendance Code</Text>
            <Text style={[s.codeValue, { color: SECONDARY }]}>{activeSession.attendance_code}</Text>

            {/* Scannable QR for students */}
            <View style={[s.qrBox, { borderColor: colors.cardBorder }]}>
              <QRCode
                value={activeSession.attendance_code}
                size={140}
                color={colors.text}
                backgroundColor={colors.card}
              />
            </View>
            <Text style={s.qrHint}>Students can scan this QR or type the code above</Text>

            <View style={s.timeRow}>
              <Clock size={14} color={colors.textMuted} />
              <Text style={s.timeText}>
                Ends {new Date(activeSession.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.card}>
            <View style={s.placeholderBox}>
              <QRCode value={JSON.stringify({ courseId: id, code: 'WAITING' })} size={130} color={colors.text} />
            </View>
            <Text style={s.readyTitle}>Ready to Start?</Text>
            <Text style={s.readyBody}>Generate a unique session code for students to enter.</Text>
            <Pressable onPress={startSession} style={[s.startBtn, { backgroundColor: SECONDARY }]}>
              <QrCode size={18} color="#FFF" />
              <Text style={s.startBtnText}>Start Session</Text>
            </Pressable>
          </View>
        )}

        {/* Roster */}
        <View style={s.rosterHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.sectionTitle}>Student Roster</Text>
            {refreshing && <ActivityIndicator size="small" color={SECONDARY} />}
          </View>
          <Pressable onPress={handleExportCSV} style={[s.exportBtn, { backgroundColor: colors.secondaryDim }]}>
            <Download size={14} color={SECONDARY} />
            <Text style={[s.exportText, { color: SECONDARY }]}>Export CSV</Text>
          </Pressable>
        </View>

        {students.length === 0 ? (
          <View style={[s.card, s.emptyCard]}>
            <Users size={32} color={colors.textMuted} />
            <Text style={s.emptyText}>No students enrolled yet.</Text>
          </View>
        ) : (
          <View style={s.rosterCard}>
            {students.map((item: any, index: number) => {
              const studentId = item.student?.id;
              const isPresent = activeSession && studentId && presentStudentIds.has(studentId);
              
              return (
                <View
                  key={item.id}
                  style={[s.rosterRow, index < students.length - 1 && s.rosterBorder]}
                >
                  <View style={[s.rosterIcon, { backgroundColor: colors.secondaryDim }]}>
                    <User size={16} color={SECONDARY} />
                  </View>
                  <View style={s.rosterInfo}>
                    <Text style={s.rosterName}>{item.student?.name || 'Unknown'}</Text>
                    <Text style={s.rosterMatric}>{item.student?.matric_number || 'No matric no.'}</Text>
                  </View>
                  {isPresent && <View style={s.presentDot} />}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof import('../../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    centered: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 15, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },

    // Header
    header: {
      backgroundColor: c.secondary, paddingHorizontal: 20, paddingBottom: 20,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    backBtn: {
      width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerText: { flex: 1 },
    courseCode: { fontSize: 20, fontWeight: '700', color: '#FFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    courseTitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14,
    },
    statChip: { flex: 1, alignItems: 'center' },
    statNum: { fontSize: 22, fontWeight: '700', color: '#FFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },

    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },

    // Card
    card: {
      backgroundColor: c.card, borderRadius: 20, padding: 20,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 20,
      alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },

    // Live session
    liveHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 6 },
    liveText: { fontSize: 12, fontWeight: '700', color: '#DC2626', letterSpacing: 1, fontFamily: ff ? 'sans-serif-medium' : undefined },
    refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.secondaryDim, alignItems: 'center', justifyContent: 'center' },
    ringWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    ringCenter: { position: 'absolute', alignItems: 'center' },
    ringPct: { fontSize: 26, fontWeight: '700', fontFamily: ff ? 'sans-serif-medium' : undefined },
    ringLabel: { fontSize: 11, color: c.textMuted, marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    codeLabel: { fontSize: 13, color: c.textMuted, marginBottom: 6, fontFamily: ff ? 'sans-serif' : undefined },
    codeValue: { fontSize: 38, fontWeight: '900', letterSpacing: 10, marginBottom: 8, fontFamily: ff ? 'sans-serif-medium' : undefined },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: { fontSize: 13, color: c.textMuted, fontFamily: ff ? 'sans-serif' : undefined },
    qrBox: { marginVertical: 14, padding: 12, borderRadius: 16, borderWidth: 1, backgroundColor: c.card },
    qrHint: { fontSize: 12, color: c.textMuted, textAlign: 'center', marginBottom: 8, fontFamily: ff ? 'sans-serif' : undefined },

    placeholderBox: {
      width: 160, height: 160, backgroundColor: c.cardAlt, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center', marginBottom: 16, padding: 12,
    },
    readyTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 6, fontFamily: ff ? 'sans-serif-medium' : undefined },
    readyBody: { fontSize: 13, color: c.textSub, textAlign: 'center', marginBottom: 18, lineHeight: 20, fontFamily: ff ? 'sans-serif' : undefined },
    startBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999, gap: 8, elevation: 2 },
    startBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16, fontFamily: ff ? 'sans-serif-medium' : undefined },

    // Roster
    rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    exportBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 6 },
    exportText: { fontSize: 12, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    emptyCard: { gap: 10 },
    emptyText: { fontSize: 14, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
    rosterCard: {
      backgroundColor: c.card, borderRadius: 18, overflow: 'hidden',
      borderWidth: 1, borderColor: c.cardBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    rosterRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    rosterBorder: { borderBottomWidth: 1, borderBottomColor: c.cardBorder },
    rosterIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    rosterInfo: { flex: 1 },
    rosterName: { fontSize: 14, fontWeight: '600', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    rosterMatric: { fontSize: 12, color: c.textMuted, marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    presentDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1B6B3A' },
  });
}
