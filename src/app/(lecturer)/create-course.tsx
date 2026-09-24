import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useUser } from '../../context/AuthContext';
import { useSupabaseClient } from '../../lib/supabase';

import { BookOpen, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

const ff = Platform.OS === 'android';

export default function CreateCourseScreen() {
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const SECONDARY = colors.secondary;

  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!courseCode || !courseTitle || !user) {
      setError('Please fill in the course code and title.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const { error: dbError } = await supabase.from('courses').insert({
        course_code: courseCode.toUpperCase(),
        course_title: courseTitle,
        level,
        lecturer_id: user.id,
      });
      
      if (dbError) { setError(dbError.message); } else { router.back(); }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top, 20) + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.bg} translucent={false} />
      {/* Back */}
      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <ChevronLeft size={22} color={colors.text} />
        <Text style={s.backText}>Back</Text>
      </Pressable>

      {/* Icon */}
      <View style={s.iconBlock}>
        <View style={s.iconCircle}>
          <BookOpen size={40} color={SECONDARY} />
        </View>
        <Text style={s.title}>New Course</Text>
        <Text style={s.subtitle}>
          Create a new course for students to join and track attendance.
        </Text>
      </View>

      {/* Error */}
      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Fields */}
      <View style={s.fieldGroup}>
        <View>
          <Text style={s.fieldLabel}>Course Code</Text>
          <TextInput
            style={s.input}
            autoCapitalize="characters"
            value={courseCode}
            placeholder="e.g. CPE 310"
            placeholderTextColor={colors.textMuted}
            onChangeText={setCourseCode}
          />
        </View>
        <View>
          <Text style={s.fieldLabel}>Course Title</Text>
          <TextInput
            style={s.input}
            value={courseTitle}
            placeholder="e.g. Microprocessors & Applications"
            placeholderTextColor={colors.textMuted}
            onChangeText={setCourseTitle}
          />
        </View>
        <View>
          <Text style={s.fieldLabel}>Level (Optional)</Text>
          <TextInput
            style={s.input}
            value={level}
            placeholder="e.g. 300"
            placeholderTextColor={colors.textMuted}
            onChangeText={setLevel}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Create Button */}
      <Pressable
        onPress={handleCreate}
        disabled={loading}
        style={[s.createBtn, { backgroundColor: loading ? colors.secondaryDim : SECONDARY }]}
      >
        <Text style={s.createBtnText}>{loading ? 'Creating...' : 'Create Course'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof import('../../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 24, paddingBottom: 48 },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    backText: { fontSize: 15, fontWeight: '600', color: c.text, marginLeft: 4, fontFamily: ff ? 'sans-serif-medium' : undefined },
    iconBlock: { alignItems: 'center', marginBottom: 32 },
    iconCircle: { width: 88, height: 88, backgroundColor: c.secondaryDim, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '700', color: c.text, marginBottom: 8, fontFamily: ff ? 'sans-serif-medium' : undefined },
    subtitle: { fontSize: 14, color: c.textSub, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12, fontFamily: ff ? 'sans-serif' : undefined },
    errorBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 16 },
    errorText: { color: '#DC2626', textAlign: 'center', fontSize: 14, fontFamily: ff ? 'sans-serif' : undefined },
    fieldGroup: { gap: 14, marginBottom: 28 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 6, fontFamily: ff ? 'sans-serif-medium' : undefined },
    input: {
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, color: c.text, fontFamily: ff ? 'sans-serif' : undefined,
    },
    createBtn: { paddingVertical: 16, borderRadius: 999, alignItems: 'center', elevation: 2 },
    createBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17, fontFamily: ff ? 'sans-serif-medium' : undefined },
  });
}
