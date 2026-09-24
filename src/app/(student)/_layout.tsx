import React, { useCallback } from 'react';
import { StatusBar, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Home, ClipboardCheck, Clock, User } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function StudentLayout() {
  const { colors, isDark } = useTheme();

  // Re-apply green status bar every time a student screen is focused,
  // preventing purple bleed-in from lecturer screens.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(isDark ? '#000000ff' : colors.primary);
      }
    }, [isDark, colors.primary])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
          elevation: 0,
          shadowOpacity: 0,
          height: 60,
          paddingBottom: 8,
          backgroundColor: colors.bg,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="mark"
        options={{
          title: 'Mark',
          tabBarIcon: ({ color, size }) => <ClipboardCheck color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      
      {/* Hidden Screens */}
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: 'Notifications',
        }}
      />
      <Tabs.Screen
        name="course/[id]"
        options={{
          href: null,
          title: 'Course Attendance',
        }}
      />
      <Tabs.Screen
        name="attendance-success"
        options={{
          href: null,
          title: 'Success',
        }}
      />
      <Tabs.Screen
        name="personal-info"
        options={{
          href: null,
          title: 'Personal Info',
        }}
      />
      <Tabs.Screen
        name="enroll"
        options={{
          href: null,
          title: 'Enroll in Course',
        }}
      />
    </Tabs>
  );
}
