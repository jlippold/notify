# 🗄️ Database Schema

## Overview
- Single Postgres database for all data
- Store users (with roles), school entities (students, guardians, staff, courses), and push infra (devices, topics, subscriptions)

## Extensions
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
```

## Users & Roles
```sql
-- roles (normalized, future-proof)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL -- 'School Admin' | 'School Staff' | 'Guardian' (aka Parents) | 'Student'
);

-- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role_id);
```

## School Domain
```sql
-- staff (1:1 with user)
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- guardians (1:1 with user)
CREATE TABLE IF NOT EXISTS guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- students (1:1 with user)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_number TEXT UNIQUE,
  grade_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- guardian-student relationships (many-to-many)
CREATE TABLE IF NOT EXISTS guardian_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT, -- e.g., parent, legal_guardian
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guardian_id, student_id)
);

-- courses
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- e.g., MATH101
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- course_staff (many-to-many)
CREATE TABLE IF NOT EXISTS course_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role TEXT, -- e.g., instructor, assistant
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, staff_id)
);

-- enrollments (students in courses)
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);

-- attendance (optional for notifications)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','tardy','excused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id, session_date)
);

-- grades (optional for notifications)
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assignment TEXT NOT NULL,
  score NUMERIC(5,2),
  max_score NUMERIC(5,2),
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Push Infrastructure
```sql
-- devices (per device token/endpoint)
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android')),
  device_token TEXT NOT NULL,
  sns_endpoint_arn TEXT UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS devices_unique_token_platform ON devices (platform, device_token);
CREATE INDEX IF NOT EXISTS devices_user_idx ON devices(user_id);

-- topics (logical audiences) - dynamically created
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- naming strategy below
  name TEXT NOT NULL,
  description TEXT,
  sns_topic_arn TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- subscriptions (device to topic)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  sns_subscription_arn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, topic_id)
);
```

## Topic Naming Strategy (Dynamic)
- School-wide: `school:notification`
- School-wide by role: `school:role:{guardian|student|staff}`
- Course general: `course:{course_id}:notification`
- Course attendance: `course:{course_id}:attendance`
- Course grade: `course:{course_id}:grade`

Notes
- Create SNS Topic lazily on first use; store in `topics` (slug → sns_topic_arn)
- Subscribe device EndpointArns for relevant users based on their role/relationships:
  - Staff of a course → course topics
  - Students enrolled in a course → course topics
  - Guardians of a student → course attendance/grade topics for that student’s courses; optionally course general notifications
  - Role-wide announcements → subscribe all devices of users with that role to `school:role:{role}`

## Indexing & Constraints
```sql
CREATE INDEX IF NOT EXISTS enrollments_student_idx ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS enrollments_course_idx ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS course_staff_course_idx ON course_staff(course_id);
CREATE INDEX IF NOT EXISTS course_staff_staff_idx ON course_staff(staff_id);
CREATE INDEX IF NOT EXISTS guardian_students_guardian_idx ON guardian_students(guardian_id);
CREATE INDEX IF NOT EXISTS guardian_students_student_idx ON guardian_students(student_id);
```

## Seed Data (roles)
```sql
INSERT INTO roles(name)
VALUES ('School Admin'), ('School Staff'), ('Guardian'), ('Student')
ON CONFLICT (name) DO NOTHING;
```
