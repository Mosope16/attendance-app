import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useUser } from '../../context/AuthContext';
import { useSupabaseClient } from '../../lib/supabase';
import { Search, Plus, BookOpen, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

const ff = Platform.OS === 'android';

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const { colors, isDark } = useTheme();
  const SECONDARY = colors.secondary;

  const [courses, setCourses] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('courses').select('*')
      .eq('lecturer_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setCourses(data);
  };

  const filtered = courses.filter(
    (c) =>
      c.course_code.toLowerCase().includes(search.toLowerCase()) ||
      c.course_title.toLowerCase().includes(search.toLowerCase())
  );

  const s = makeStyles(colors);

  return (
    <View style={s.root}>
      <StatusBar style="light" backgroundColor={isDark ? '#071A40' : SECONDARY} translucent={false} />
      <View style={[s.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <Text style={s.headerTitle}>All Courses</Text>
        <Pressable
          onPress={() => router.push('/(lecturer)/create-course')}
          style={s.addBtn}
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Search */}
        <View style={s.searchBar}>
          <Search size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search courses..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {filtered.length === 0 ? (
          <View style={s.emptyCard}>
            <BookOpen size={40} color={colors.textMuted} />
            <Text style={s.emptyTitle}>{search ? 'No Results' : 'No Courses Yet'}</Text>
            <Text style={s.emptyBody}>
              {search ? 'Try a different search term.' : 'Tap + to create your first course.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((course) => (
              <Pressable
                key={course.id}
                onPress={() => router.push(`/(lecturer)/course/${course.id}`)}
                style={s.courseCard}
              >
                <View style={s.courseIcon}>
                  <BookOpen size={20} color={SECONDARY} />
                </View>
                <View style={s.courseInfo}>
                  <Text style={s.courseCode}>{course.course_code}</Text>
                  <Text style={s.courseTitle} numberOfLines={1}>{course.course_title}</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
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
      backgroundColor: c.secondary, paddingHorizontal: 20, paddingBottom: 20,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', fontFamily: ff ? 'sans-serif-medium' : undefined },
    addBtn: { width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 32 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.card,
      borderWidth: 1, borderColor: c.cardBorder, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    searchInput: { flex: 1, fontSize: 15, color: c.text, fontFamily: ff ? 'sans-serif' : undefined },
    emptyCard: { backgroundColor: c.card, borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: c.cardBorder },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginTop: 14, marginBottom: 6, fontFamily: ff ? 'sans-serif-medium' : undefined },
    emptyBody: { fontSize: 14, color: c.textSub, textAlign: 'center', fontFamily: ff ? 'sans-serif' : undefined },
    courseCard: {
      backgroundColor: c.card, borderRadius: 16, padding: 14,
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: c.cardBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    courseIcon: { width: 44, height: 44, backgroundColor: c.secondaryDim, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    courseInfo: { flex: 1 },
    courseCode: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 3, fontFamily: ff ? 'sans-serif-medium' : undefined },
    courseTitle: { fontSize: 13, color: c.textSub, fontFamily: ff ? 'sans-serif' : undefined },
  });
}
