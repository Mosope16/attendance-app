# SIWES Logbook: Student Attendance Management System

**Project Title:** Development of a Geo-fenced Student Attendance Management System using React Native (Expo) and Supabase
**Duration:** 2 Weeks (10 Working Days)
**Start Date:** Monday, June 22, 2026

---

## WEEK 1

**Brief Summary:** Environment Setup, Authentication, and Core Architecture.

**Detailed Report:**
During the first week of the SIWES program, the primary focus was on establishing the foundational architecture for the Student Attendance Management System. The project was initialized using React Native and the Expo framework to ensure cross-platform compatibility (iOS and Android). I configured a PostgreSQL database using Supabase, designing a robust relational schema to handle Users, Courses, Enrollments, and Attendance Records. For security, Clerk was integrated to manage user authentication and Role-Based Access Control (RBAC), strictly separating Lecturer and Student functionalities. By the end of the week, the core user interfaces were built using Tailwind CSS, and the fundamental business logic—such as creating courses, smart student enrollment filtering, and generating live attendance sessions via unique PINs—was successfully implemented and tested.

### Day 1 (Monday, June 22, 2026)
**Activities Performed:** 
- Project induction, requirement analysis, and system architecture planning.
- Setup of the development environment (Node.js, Expo CLI, VS Code).
- Initialized the React Native cross-platform project using Expo.
- Configured project folder structure and set up version control (Git).

### Day 2 (Tuesday, June 23, 2026)
**Activities Performed:**
- Provisioned the backend database infrastructure using Supabase (PostgreSQL).
- Designed the relational database schema (Users, Courses, Enrollments, Sessions, Records).
- Integrated Clerk for secure identity management and configured Role-Based Access Control (RBAC) to differentiate between "Lecturer" and "Student" profiles.

### Day 3 (Wednesday, June 24, 2026)
**Activities Performed:**
- Developed the Authentication flow (Sign-In, Sign-Up, Profile completion screens).
- Built the foundational User Interface (UI) for the main dashboards using React Native components and Lucide icons.
- Implemented state management and navigation routing using Expo Router.

### Day 4 (Thursday, June 25, 2026)
**Activities Performed:**
- Implemented the Course Management module for Lecturers (ability to create and manage courses).
- Developed the Smart Course Enrollment system for Students, utilizing database queries to automatically filter and display available courses based on the student's selected Department and Level.

### Day 5 (Friday, June 26, 2026)
**Activities Performed:**
- Built the core Attendance Tracking logic. 
- Created the module for lecturers to generate live, time-bound attendance sessions with unique 5-character PINs and QR codes.
- Developed the student-facing interface to input codes and successfully register presence in the database.

---

## WEEK 2

**Brief Summary:** Real-time Analytics, Data Export, and Geo-fencing Security.

**Detailed Report:**
The second week was dedicated to advancing the system with real-time capabilities, administrative tools, and critical security enhancements. I implemented Supabase Realtime subscriptions to enable live roster updates on the Lecturer Dashboard the exact moment a student registers attendance. Significant progress was made on the analytics front, building dynamic history and reporting modules for both students and lecturers. To facilitate administrative tasks, I integrated native device APIs (`expo-file-system` and `expo-sharing`) to allow lecturers to export attendance data natively as CSV/Excel files. Finally, to combat attendance fraud (e.g., students sharing codes from dorms), I successfully researched and deployed a Geo-fencing feature. By leveraging `expo-location` and the Haversine formula, the app now strictly verifies that students are physically within a 50-meter radius of the classroom before permitting attendance registration.

### Day 6 (Monday, June 29, 2026)
**Activities Performed:**
- Implemented real-time data synchronization using Supabase Realtime subscriptions (`postgres_changes`).
- Upgraded the Lecturer Dashboard to dynamically update the roster and active session metrics (like a "Live" badge) the exact moment a student joins a class, without needing to refresh the page.

### Day 7 (Tuesday, June 30, 2026)
**Activities Performed:**
- Developed the Attendance History and Analytics modules. 
- Built the Student History page to display personal attendance percentages and past logs.
- Built the Lecturer Reports page to calculate course-wide analytics, handling edge-cases like 0% attendance for newly enrolled students with no past sessions.

### Day 8 (Wednesday, July 1, 2026)
**Activities Performed:**
- Engineered a Data Export feature for lecturers to extract attendance records.
- Integrated native APIs (`expo-file-system` and `expo-sharing`) to parse JSON database records into formatted CSV strings, save them as Excel-compatible files, and trigger the native iOS/Android share sheet.

### Day 9 (Thursday, July 2, 2026)
**Activities Performed:**
- Developed an automated In-App Notifications system.
- Hooked the UI into database events so that actions (e.g., joining a course, or a lecturer starting a new session) automatically generate and display real-time alerts on the student's notification screen.

### Day 10 (Friday, July 3, 2026)
**Activities Performed:**
- Researched and integrated Geo-fencing security to prevent attendance fraud.
- Utilized `expo-location` to capture device GPS coordinates and implemented the Haversine mathematical formula in JavaScript to calculate the physical distance between the student and lecturer.
- Applied a strict 50-meter radius validation check before allowing database insertion. Conducted final QA testing and debugging across the app.
