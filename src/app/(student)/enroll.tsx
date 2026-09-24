import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '../../context/AuthContext';
import { useSupabaseClient } from '../../lib/supabase';
import { ChevronLeft, Plus, CheckCircle, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

const ff = Platform.OS === 'android';

export default function EnrollScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const { colors } = useTheme();
  const PRIMARY = colors.primary;

  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchCourses();
    }, [user?.id])
  );

  const fetchCourses = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch all courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .order('course_code', { ascending: true });

      // Add derived dept and level directly from the course code string (Proof of Concept)
      const enrichedCourses = (coursesData || []).map(c => {
        const dMatch = c.course_code.match(/^[a-zA-Z]+/);
        const nMatch = c.course_code.match(/[0-9]+/);
        const department = dMatch ? dMatch[0].toUpperCase() : 'OTHER';
        const num = nMatch ? parseInt(nMatch[0], 10) : 0;
        const level = num > 0 ? `${Math.floor(num / 100) * 100}` : 'Other';
        return { ...c, department, level };
      });

      // 2. Fetch my enrollments
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', user.id);

      setAllCourses(enrichedCourses);
      setEnrolledCourseIds(new Set(enrollmentsData?.map(e => e.course_id) || []));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) return;
    setEnrollingId(courseId);

    const { error } = await supabase
      .from('enrollments')
      .insert({
        course_id: courseId,
        student_id: user.id
      });

    setEnrollingId(null);

    if (error) {
      if (error.code === '23505') {
        // Unique violation, already enrolled
        setEnrolledCourseIds(prev => {
          const next = new Set(prev);
          next.add(courseId);
          return next;
        });
      } else {
        Alert.alert('Error', 'Failed to enroll in the course. Please try again.');
      }
    } else {
      // Success
      setEnrolledCourseIds(prev => {
        const next = new Set(prev);
        next.add(courseId);
        return next;
      });
    }
  };

  const s = makeStyles(colors);

  const displayedCourses = allCourses.filter(c => {
    if (selectedDept && c.department !== selectedDept) return false;
    if (selectedLevel && c.level !== selectedLevel) return false;
    return true;
  });

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={s.headerTitle}>Enroll in Course</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.searchMock}>
          <Search size={20} color={colors.textMuted} />
          <Text style={s.searchMockText}>Browse Available Courses</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
        ) : allCourses.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No courses available in the system.</Text>
          </View>
        ) : (
          <>
            {/* Dynamic Filters */}
            <View style={{ marginBottom: 20 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <Pressable
                  onPress={() => setSelectedDept(null)}
                  style={[s.filterChip, !selectedDept && s.filterChipActive]}
                >
                  <Text style={[s.filterText, !selectedDept && s.filterTextActive]}>All Depts</Text>
                </Pressable>
                {Array.from(new Set(allCourses.map(c => c.department))).sort().map(dept => (
                  <Pressable
                    key={dept as string}
                    onPress={() => setSelectedDept(dept as string)}
                    style={[s.filterChip, selectedDept === dept && s.filterChipActive]}
                  >
                    <Text style={[s.filterText, selectedDept === dept && s.filterTextActive]}>{dept as string}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable
                  onPress={() => setSelectedLevel(null)}
                  style={[s.filterChip, !selectedLevel && s.filterChipActive]}
                >
                  <Text style={[s.filterText, !selectedLevel && s.filterTextActive]}>All Levels</Text>
                </Pressable>
                {Array.from(new Set(allCourses.map(c => c.level))).sort().map(lvl => (
                  <Pressable
                    key={lvl as string}
                    onPress={() => setSelectedLevel(lvl as string)}
                    style={[s.filterChip, selectedLevel === lvl && s.filterChipActive]}
                  >
                    <Text style={[s.filterText, selectedLevel === lvl && s.filterTextActive]}>
                      {lvl === 'Other' ? 'Other' : `${lvl} Level`}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={{ gap: 12 }}>
              {displayedCourses.length === 0 ? (
                 <Text style={[s.emptyText, {textAlign: 'center', marginTop: 20}]}>No courses match these filters.</Text>
              ) : displayedCourses.map((course) => {
                const isEnrolled = enrolledCourseIds.has(course.id);
                const isEnrolling = enrollingId === course.id;

              return (
                <View key={course.id} style={s.courseCard}>
                  <View style={s.courseInfo}>
                    <Text style={s.courseCode}>{course.course_code}</Text>
                    <Text style={s.courseTitle} numberOfLines={1}>{course.course_title}</Text>
                  </View>

                  {isEnrolled ? (
                    <View style={s.enrolledBadge}>
                      <CheckCircle size={16} color="#059669" />
                      <Text style={s.enrolledText}>Enrolled</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleEnroll(course.id)}
                      disabled={isEnrolling}
                      style={[s.enrollBtn, { backgroundColor: isEnrolling ? colors.primaryDim : PRIMARY }]}
                    >
                      {isEnrolling ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Plus size={16} color="#FFF" style={{ marginRight: 4 }} />
                          <Text style={s.enrollBtnText}>Enroll</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      backgroundColor: c.primary, paddingHorizontal: 20, paddingBottom: 20,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
      flexDirection: 'row', alignItems: 'center',
    },
    backBtn: { width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    searchMock: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.card,
      paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16,
      borderWidth: 1, borderColor: c.cardBorder, marginBottom: 24, gap: 10,
    },
    searchMockText: { color: c.textMuted, fontSize: 15, fontFamily: ff ? 'sans-serif' : undefined },
    filterChip: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, marginRight: 8,
    },
    filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterText: { color: c.textMuted, fontSize: 13, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
    filterTextActive: { color: '#FFF' },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: c.textMuted, fontSize: 15, fontFamily: ff ? 'sans-serif' : undefined },
    courseCard: {
      backgroundColor: c.card, borderRadius: 16, padding: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: c.cardBorder,
    },
    courseInfo: { flex: 1, marginRight: 16 },
    courseCode: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 4, fontFamily: ff ? 'sans-serif-medium' : undefined },
    courseTitle: { fontSize: 13, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
    enrollBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
    enrollBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14, fontFamily: ff ? 'sans-serif-medium' : undefined },
    enrolledBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, gap: 6 },
    enrolledText: { color: '#059669', fontSize: 13, fontWeight: '600', fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
