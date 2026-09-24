import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUser } from '../../../context/AuthContext';
import { useSupabaseClient } from '../../../lib/supabase';
import { ChevronLeft, CheckCircle, XCircle, Clock, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { formatDate, formatTime } from '../../../lib/dateUtils';
import { getCurrentAttendanceLocation, validateGeofenceProximity } from '../../../lib/geo';

const ff = Platform.OS === 'android';

export default function StudentCourseDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const { colors, isDark } = useTheme();

  const [course, setCourse] = useState<any>(null);
  const [attendanceCode, setAttendanceCode] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') StatusBar.setBackgroundColor(isDark ? '#0D3320' : colors.primary);
  }, [isDark, colors.primary]);

  useEffect(() => {
    Promise.all([fetchCourseDetails(), fetchAttendanceHistory()])
      .finally(() => setLoading(false));
  }, [id]);

  // Real-time listener: refresh history automatically when attendance is recorded
  useEffect(() => {
    if (!id || !user?.id) return;
    const channel = supabase
      .channel(`student_course_attendance_${id}_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_records' },
        (payload: any) => {
          if (payload?.new?.student_id === user.id) {
            fetchAttendanceHistory();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user?.id, supabase]);

  const fetchCourseDetails = async () => {
    const { data } = await supabase.from('courses').select('*').eq('id', id).single();
    if (data) setCourse(data);
  };

  const fetchAttendanceHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('attendance_records')
      .select('*, session:session_id(start_time, end_time)')
      .eq('student_id', user.id)
      .order('timestamp', { ascending: false });
    if (data) setRecords(data);
  };

  const markAttendance = async () => {
    if (!attendanceCode || !user) return;
    setSubmitting(true);
    setMessage({ text: '', type: '' });

    const now = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, latitude, longitude')
      .eq('course_id', id)
      .eq('attendance_code', attendanceCode.toUpperCase())
      .gt('end_time', now)
      .single();

    if (sessionError || !session) {
      setMessage({ text: 'Invalid or expired code. Try again.', type: 'error' });
      setSubmitting(false);
      return;
    }

    // Geofencing verification (50 meters radius)
    if (session.latitude != null && session.longitude != null) {
      const locResult = await getCurrentAttendanceLocation();
      if (locResult.error || !locResult.coords) {
        setMessage({ text: locResult.error || 'Location access is required to verify your attendance.', type: 'error' });
        setSubmitting(false);
        return;
      }

      const geo = validateGeofenceProximity(
        locResult.coords.latitude,
        locResult.coords.longitude,
        session.latitude,
        session.longitude,
        50
      );

      if (!geo.isWithin) {
        setMessage({ text: geo.message, type: 'error' });
        setSubmitting(false);
        return;
      }
    }

    const { error: recordError } = await supabase.from('attendance_records').insert({
      session_id: session.id,
      student_id: user.id,
      status: 'present',
      timestamp: new Date().toISOString(),
    });

    if (recordError) {
      if (recordError.code === '23505') {
        setMessage({ text: 'You already marked attendance for this session.', type: 'error' });
      } else {
        setMessage({ text: 'Something went wrong. Please try again.', type: 'error' });
      }
    } else {
      setMessage({ text: 'Attendance marked successfully! ✓', type: 'success' });
      setAttendanceCode('');
      fetchAttendanceHistory();
    }
    setSubmitting(false);
  };

  const PRIMARY = colors.primary;
  const s = makeStyles(colors);

  if (loading || !course) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={s.loadingText}>Loading course...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>

      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <ChevronLeft size={22} color="#FFF" />
          </Pressable>
          <View style={s.headerText}>
            <Text style={s.courseCode} numberOfLines={1}>{course.course_code}</Text>
            <Text style={s.courseTitle} numberOfLines={1}>{course.course_title}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        {/* Mark Attendance Card */}
        <Text style={s.sectionTitle}>Mark Attendance</Text>
        <View style={s.card}>
          <Text style={s.cardHint}>
            Enter the 5-character code displayed by your lecturer.
          </Text>

          <View style={s.geoBadge}>
            <MapPin size={13} color={PRIMARY} />
            <Text style={[s.geoBadgeText, { color: PRIMARY }]}>GPS Geofence Protected · 50m Radius</Text>
          </View>

          {message.text ? (
            <View style={[s.messageBanner, message.type === 'error' ? s.errorBanner : s.successBanner]}>
              <Text style={[s.messageText, message.type === 'error' ? s.errorText : s.successText]}>
                {message.text}
              </Text>
            </View>
          ) : null}

          <View style={s.inputRow}>
            <TextInput
              style={[s.codeInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.cardAlt }]}
              autoCapitalize="characters"
              maxLength={5}
              value={attendanceCode}
              onChangeText={setAttendanceCode}
              placeholder="XXXXX"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              onPress={markAttendance}
              disabled={submitting || attendanceCode.length < 5}
              style={[
                s.submitBtn,
                { backgroundColor: submitting || attendanceCode.length < 5 ? colors.primaryDim : PRIMARY },
              ]}
            >
              <Text style={s.submitBtnText}>{submitting ? '...' : 'Submit'}</Text>
            </Pressable>
          </View>
        </View>

        {/* History */}
        <Text style={s.sectionTitle}>Attendance History</Text>

        {records.length === 0 ? (
          <View style={[s.card, s.emptyCard]}>
            <Clock size={32} color={colors.textMuted} />
            <Text style={s.emptyText}>No attendance records yet.</Text>
          </View>
        ) : (
          <View style={s.historyList}>
            {records.map((record: any) => (
              <View key={record.id} style={s.historyRow}>
                <View style={[s.historyIcon, { backgroundColor: record.status === 'present' ? colors.primaryDim : '#FEE2E2' }]}>
                  {record.status === 'present'
                    ? <CheckCircle size={18} color={PRIMARY} />
                    : <XCircle size={18} color="#EF4444" />
                  }
                </View>
                <View style={s.historyInfo}>
                  <Text style={s.historyDate}>
                    {formatDate(record.timestamp, { showDay: true, showYear: false })}
                  </Text>
                  <Text style={s.historyTime}>
                    {formatTime(record.timestamp)}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: record.status === 'present' ? colors.primaryDim : '#FEE2E2' }]}>
                  <Text style={[s.statusText, { color: record.status === 'present' ? colors.primaryText : '#DC2626' }]}>
                    {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
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

    header: {
      backgroundColor: c.primary, paddingHorizontal: 20, paddingBottom: 20,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    backBtn: {
      width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    headerText: { flex: 1 },
    courseCode: { fontSize: 20, fontWeight: '700', color: '#FFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    courseTitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },

    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },

    sectionTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 12, fontFamily: ff ? 'sans-serif-medium' : undefined },

    card: {
      backgroundColor: c.card, borderRadius: 20, padding: 18,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 20,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    cardHint: { fontSize: 13, color: c.textSub, marginBottom: 10, lineHeight: 20, fontFamily: ff ? 'sans-serif' : undefined },
    geoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.primaryDim,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      marginBottom: 14,
      gap: 6,
      alignSelf: 'flex-start',
    },
    geoBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      fontFamily: ff ? 'sans-serif-medium' : undefined,
    },
    messageBanner: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
    errorBanner: { backgroundColor: '#FEE2E2' },
    successBanner: { backgroundColor: '#D1FAE5' },
    messageText: { fontSize: 14, textAlign: 'center', fontFamily: ff ? 'sans-serif' : undefined },
    errorText: { color: '#DC2626' },
    successText: { color: '#059669' },

    inputRow: { flexDirection: 'row', gap: 10 },
    codeInput: {
      flex: 1, borderWidth: 1.5, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: 8,
      fontFamily: ff ? 'sans-serif-medium' : undefined,
    },
    submitBtn: {
      paddingHorizontal: 20, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    submitBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15, fontFamily: ff ? 'sans-serif-medium' : undefined },

    emptyCard: { alignItems: 'center', gap: 10 },
    emptyText: { fontSize: 14, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },

    historyList: {
      backgroundColor: c.card, borderRadius: 18, overflow: 'hidden',
      borderWidth: 1, borderColor: c.cardBorder,
    },
    historyRow: {
      flexDirection: 'row', alignItems: 'center',
      padding: 14, borderBottomWidth: 1, borderBottomColor: c.cardBorder,
    },
    historyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    historyInfo: { flex: 1 },
    historyDate: { fontSize: 14, fontWeight: '600', color: c.text, fontFamily: ff ? 'sans-serif-medium' : undefined },
    historyTime: { fontSize: 12, color: c.textMuted, marginTop: 2, fontFamily: ff ? 'sans-serif' : undefined },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    statusText: { fontSize: 12, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
