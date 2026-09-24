import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { db } from './neon';

const NEON_AUTH_URL = process.env.EXPO_PUBLIC_NEON_AUTH_URL || 'https://ep-broad-fire-b5t3ep7p.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth';
const ORIGIN = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.origin
  ? window.location.origin
  : 'http://localhost:8081';

const AUTH_USER_KEY = 'attendance_neon_user';
const AUTH_TOKEN_KEY = 'attendance_neon_token';
const AUTH_COOKIE_KEY = 'attendance_neon_cookie';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'lecturer';
  matric_number?: string | null;
  staff_id?: string | null;
  department?: string | null;
  phone?: string | null;
  createdAt?: string;
}

export interface SessionData {
  token: string;
  cookie?: string | null;
  user: UserProfile;
}

// Storage helpers with web/SSR fallback
async function getStorageItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setStorageItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.error(`Error saving ${key} to storage:`, e);
  }
}

async function removeStorageItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    console.error(`Error deleting ${key} from storage:`, e);
  }
}

export const neonAuth = {
  async getStoredSession(): Promise<SessionData | null> {
    try {
      const userJson = await getStorageItem(AUTH_USER_KEY);
      const token = await getStorageItem(AUTH_TOKEN_KEY);
      const cookie = await getStorageItem(AUTH_COOKIE_KEY);

      if (!userJson || !token) return null;

      const user = JSON.parse(userJson) as UserProfile;

      // Verify that the user profile actually exists in the database
      try {
        const { data: dbUser, error: checkErr } = await db.from('users').select('id').eq('id', user.id).single();
        if (!checkErr && !dbUser) {
          // Stale session (e.g. deleted from DB); clear local storage
          await removeStorageItem(AUTH_USER_KEY);
          await removeStorageItem(AUTH_TOKEN_KEY);
          await removeStorageItem(AUTH_COOKIE_KEY);
          return null;
        }
      } catch {
        // Network issue on startup - allow cached session to continue
      }

      return { token, cookie, user };
    } catch {
      return null;
    }
  },

  async signUp({
    email,
    password,
    name,
    role,
    matricNumber,
    staffId,
  }: {
    email: string;
    password: string;
    name: string;
    role: 'student' | 'lecturer';
    matricNumber?: string;
    staffId?: string;
  }): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      // 1. Better Auth Sign-Up on Neon
      const res = await fetch(`${NEON_AUTH_URL}/sign-up/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': ORIGIN,
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          name: name.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.code) {
        return {
          user: null,
          error: data.message || 'Registration failed. Please check your credentials.',
        };
      }

      const neonUser = data.user;
      const token = data.token || '';
      const cookie = res.headers.get('set-cookie') || '';

      // 2. Insert application profile into public.users
      const profile: UserProfile = {
        id: neonUser.id,
        name: name.trim(),
        email: trimmedEmail,
        role,
        matric_number: role === 'student' ? matricNumber?.trim() || null : null,
        staff_id: role === 'lecturer' ? staffId?.trim() || null : null,
      };

      const { error: dbError } = await db.from('users').insert(profile);
      if (dbError) {
        console.error('Error creating user profile in Neon DB:', dbError);
        return {
          user: null,
          error: typeof dbError === 'string' ? dbError : (dbError.message || 'Database error creating profile.'),
        };
      }

      // 3. Persist session
      await setStorageItem(AUTH_USER_KEY, JSON.stringify(profile));
      if (token) await setStorageItem(AUTH_TOKEN_KEY, token);
      if (cookie) await setStorageItem(AUTH_COOKIE_KEY, cookie);

      return { user: profile, error: null };
    } catch (err: any) {
      console.error('SignUp exception:', err);
      return { user: null, error: err.message || 'Network error during registration.' };
    }
  },

  async signIn({
    identifier,
    password,
  }: {
    identifier: string;
    password: string;
  }): Promise<{ user: UserProfile | null; error: string | null }> {
    try {
      let emailToUse = identifier.trim().toLowerCase();

      // If user typed Matric Number or Staff ID instead of email, resolve it:
      if (!emailToUse.includes('@')) {
        const { data: studentMatch } = await db
          .from('users')
          .select('email')
          .eq('matric_number', identifier.trim())
          .single();

        if (studentMatch?.email) {
          emailToUse = studentMatch.email;
        } else {
          const { data: lecturerMatch } = await db
            .from('users')
            .select('email')
            .eq('staff_id', identifier.trim())
            .single();

          if (lecturerMatch?.email) {
            emailToUse = lecturerMatch.email;
          }
        }
      }

      // 1. Better Auth Sign-In on Neon
      const res = await fetch(`${NEON_AUTH_URL}/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': ORIGIN,
        },
        body: JSON.stringify({
          email: emailToUse,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.code) {
        return {
          user: null,
          error: data.message || 'Invalid email, ID, or password.',
        };
      }

      const neonUser = data.user;
      const token = data.token || '';
      const cookie = res.headers.get('set-cookie') || '';

      // 2. Fetch full user profile from public.users
      const { data: profileData } = await db
        .from('users')
        .select('*')
        .eq('id', neonUser.id)
        .single();

      const user: UserProfile = {
        id: neonUser.id,
        name: profileData?.name || neonUser.name || 'User',
        email: profileData?.email || neonUser.email,
        role: profileData?.role || 'student',
        matric_number: profileData?.matric_number,
        staff_id: profileData?.staff_id,
        department: profileData?.department,
        phone: profileData?.phone,
        createdAt: profileData?.created_at,
      };

      // 3. Persist session
      await setStorageItem(AUTH_USER_KEY, JSON.stringify(user));
      if (token) await setStorageItem(AUTH_TOKEN_KEY, token);
      if (cookie) await setStorageItem(AUTH_COOKIE_KEY, cookie);

      return { user, error: null };
    } catch (err: any) {
      console.error('SignIn exception:', err);
      return { user: null, error: err.message || 'Network error during sign in.' };
    }
  },

  async signOut(): Promise<void> {
    try {
      const token = await getStorageItem(AUTH_TOKEN_KEY);
      const cookie = await getStorageItem(AUTH_COOKIE_KEY);

      const headers: Record<string, string> = {
        'Origin': ORIGIN,
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (cookie) headers['Cookie'] = cookie;

      await fetch(`${NEON_AUTH_URL}/sign-out`, {
        method: 'POST',
        headers,
      }).catch(() => {});
    } catch (e) {
      // ignore
    } finally {
      await removeStorageItem(AUTH_USER_KEY);
      await removeStorageItem(AUTH_TOKEN_KEY);
      await removeStorageItem(AUTH_COOKIE_KEY);
    }
  },

  async refreshProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data } = await db.from('users').select('*').eq('id', userId).single();
      if (data) {
        await setStorageItem(AUTH_USER_KEY, JSON.stringify(data));
        return data as UserProfile;
      }
    } catch (e) {
      console.error('Error refreshing profile:', e);
    }
    return null;
  }
};
