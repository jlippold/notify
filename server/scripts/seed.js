const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
const bcrypt = require('bcrypt');
const { pool, query } = require('../lib/db');

async function upsertRole(name) {
  const r = await query('INSERT INTO roles(name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id', [name]);
  if (r.rows[0]?.id) return r.rows[0].id;
  const sel = await query('SELECT id FROM roles WHERE name=$1', [name]);
  return sel.rows[0].id;
}

async function upsertUser(email, password, roleName) {
  const roleId = await upsertRole(roleName);
  const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rows[0]) return { id: existing.rows[0].id, roleId };
  const hash = await bcrypt.hash(password, 10);
  const ins = await query('INSERT INTO users(email, password_hash, role_id) VALUES ($1,$2,$3) RETURNING id', [email, hash, roleId]);
  return { id: ins.rows[0].id, roleId };
}

async function upsertStaff(userId, title) {
  const r = await query('INSERT INTO staff(user_id, title) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING RETURNING id', [userId, title || null]);
  if (r.rows[0]?.id) return r.rows[0].id;
  const sel = await query('SELECT id FROM staff WHERE user_id=$1', [userId]);
  return sel.rows[0].id;
}

async function upsertGuardian(userId) {
  const r = await query('INSERT INTO guardians(user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING RETURNING id', [userId]);
  if (r.rows[0]?.id) return r.rows[0].id;
  const sel = await query('SELECT id FROM guardians WHERE user_id=$1', [userId]);
  return sel.rows[0].id;
}

async function upsertStudent(userId, studentNumber, gradeLevel) {
  const r = await query('INSERT INTO students(user_id, student_number, grade_level) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO NOTHING RETURNING id', [userId, studentNumber, gradeLevel || null]);
  if (r.rows[0]?.id) return r.rows[0].id;
  const sel = await query('SELECT id FROM students WHERE user_id=$1', [userId]);
  return sel.rows[0].id;
}

async function upsertCourse(code, name, description) {
  const r = await query('INSERT INTO courses(code, name, description) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING RETURNING id', [code, name, description || null]);
  if (r.rows[0]?.id) return r.rows[0].id;
  const sel = await query('SELECT id FROM courses WHERE code=$1', [code]);
  return sel.rows[0].id;
}

async function linkCourseStaff(courseId, staffId, role) {
  await query('INSERT INTO course_staff(course_id, staff_id, role) VALUES ($1,$2,$3) ON CONFLICT (course_id, staff_id) DO NOTHING', [courseId, staffId, role || null]);
}

async function enrollStudent(courseId, studentId) {
  await query('INSERT INTO enrollments(course_id, student_id) VALUES ($1,$2) ON CONFLICT (course_id, student_id) DO NOTHING', [courseId, studentId]);
}

async function linkGuardianStudent(guardianId, studentId, relationship) {
  await query('INSERT INTO guardian_students(guardian_id, student_id, relationship) VALUES ($1,$2,$3) ON CONFLICT (guardian_id, student_id) DO NOTHING', [guardianId, studentId, relationship || null]);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Users
    const admin = await upsertUser('admin@school.test', 'password123', 'School Admin');
    const staffUser = await upsertUser('teacher@school.test', 'password123', 'School Staff');
    const studentUser = await upsertUser('student@school.test', 'password123', 'Student');
    const guardianUser = await upsertUser('parent@school.test', 'password123', 'Guardian');

    // Domain profiles
    const staffId = await upsertStaff(staffUser.id, 'Teacher');
    const studentId = await upsertStudent(studentUser.id, 'S-1001', '10');
    const guardianId = await upsertGuardian(guardianUser.id);
    await linkGuardianStudent(guardianId, studentId, 'parent');

    // Course and relationships
    const courseId = await upsertCourse('MATH101', 'Math 101', 'Intro to Math');
    await linkCourseStaff(courseId, staffId, 'instructor');
    await enrollStudent(courseId, studentId);

    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('Seed complete');
  } catch (e) {
    await client.query('ROLLBACK');
    // eslint-disable-next-line no-console
    console.error('Seed failed', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();


