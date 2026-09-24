-- Supabase Schema with Row-Level Security (RLS) for Clerk Third-Party Auth

-- Create Users Table (Synced from Clerk)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Clerk User ID
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('student', 'lecturer')) NOT NULL,
  matric_number TEXT, -- Only for students
  staff_id TEXT,      -- Only for lecturers
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  lecturer_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- Create Attendance Sessions Table
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  attendance_code TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent')) NOT NULL DEFAULT 'present',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- =======================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Uses (auth.jwt() ->> 'sub') to match the Clerk User ID
-- =======================================================

-- Users Policy
DROP POLICY IF EXISTS "Users can read all users" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

CREATE POLICY "Users can read all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON users FOR INSERT TO authenticated WITH CHECK ((auth.jwt() ->> 'sub') = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE TO authenticated USING ((auth.jwt() ->> 'sub') = id);

-- Courses Policy
DROP POLICY IF EXISTS "Anyone can view courses" ON courses;
DROP POLICY IF EXISTS "Lecturers can create courses" ON courses;
DROP POLICY IF EXISTS "Lecturers can update their courses" ON courses;
DROP POLICY IF EXISTS "Lecturers can delete their courses" ON courses;

CREATE POLICY "Anyone can view courses" ON courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecturers can create courses" ON courses FOR INSERT TO authenticated WITH CHECK ((auth.jwt() ->> 'sub') = lecturer_id);
CREATE POLICY "Lecturers can update their courses" ON courses FOR UPDATE TO authenticated USING ((auth.jwt() ->> 'sub') = lecturer_id);
CREATE POLICY "Lecturers can delete their courses" ON courses FOR DELETE TO authenticated USING ((auth.jwt() ->> 'sub') = lecturer_id);

-- Enrollments Policy
DROP POLICY IF EXISTS "Anyone can view enrollments" ON enrollments;
DROP POLICY IF EXISTS "Students can enroll themselves" ON enrollments;

CREATE POLICY "Anyone can view enrollments" ON enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Students can enroll themselves" ON enrollments FOR INSERT TO authenticated WITH CHECK ((auth.jwt() ->> 'sub') = student_id);

-- Attendance Sessions Policy
DROP POLICY IF EXISTS "Anyone can view attendance sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Lecturers can create sessions" ON attendance_sessions;

CREATE POLICY "Anyone can view attendance sessions" ON attendance_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecturers can create sessions" ON attendance_sessions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM courses WHERE id = course_id AND lecturer_id = (auth.jwt() ->> 'sub'))
);

-- Attendance Records Policy
DROP POLICY IF EXISTS "Students can view their own records" ON attendance_records;
DROP POLICY IF EXISTS "Students can mark attendance" ON attendance_records;

CREATE POLICY "Students can view their own records" ON attendance_records FOR SELECT TO authenticated USING (
  (auth.jwt() ->> 'sub') = student_id OR
  EXISTS (SELECT 1 FROM attendance_sessions s JOIN courses c ON s.course_id = c.id WHERE s.id = session_id AND c.lecturer_id = (auth.jwt() ->> 'sub'))
);
CREATE POLICY "Students can mark attendance" ON attendance_records FOR INSERT TO authenticated WITH CHECK ((auth.jwt() ->> 'sub') = student_id);
