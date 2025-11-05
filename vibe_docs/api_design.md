# 📘 API Design

## Auth (Form + Session)
- GET `/auth/login` → render form
- POST `/auth/login` → { email, password } → set session cookie on success
- POST `/auth/logout` → clear session

## Push Registration
- POST `/push/register`
  - body: { platform: 'ios'|'android', deviceToken: string }
  - auth: required (binds device to current user)
  - result: { endpointArn }

## Topics
- POST `/topics/ensure`
  - body: { slug: string, name?: string }
  - auth: admin/staff only (optionally admin only)
  - result: { topicArn, slug }

- GET `/push/topics`
  - auth: admin/staff
  - result: [ { slug, name, topicArn } ]

- POST `/push/subscribe`
  - body: { deviceId OR endpointArn, slug }
  - auth: user must own device or have admin/staff privileges
  - result: { subscriptionArn }

- POST `/push/unsubscribe`
  - body: { deviceId OR endpointArn, slug }
  - auth: user must own device or have admin/staff privileges
  - result: { ok: true }

## Publish
- POST `/publish/course`
  - body: {
      courseId: string,
      audience: 'students' | 'guardians' | 'both',
      payload: {
        title: string,
        body: string,
        sound?: string,
        badge?: number,
        link?: string
      },
      type?: 'notification' | 'attendance' | 'grade'  // default 'notification'
    }
  - auth: staff (must be instructor/assistant for course)
  - behavior: ensure topic(s) for course; publish to selected audience topics

- POST `/publish/role`
  - body: {
      role: 'guardian' | 'student' | 'staff',
      payload: {
        title: string,
        body: string,
        sound?: string,
        badge?: number,
        link?: string
      }
    }
  - auth: School Admin only
  - behavior: ensure `school:role:{role}` and publish

- POST `/publish/device`
  - body: {
      deviceId OR endpointArn,
      payload: {... as above ...}
    }
  - auth: user must own device or admin/staff

## Payload Mapping
- iOS (APNS)
  - {
      aps: { alert: { title, body }, sound, badge },
      link
    }
- Android (FCM)
  - {
      notification: { title, body, sound },
      data: { link }
    }

## Authorization Rules
- School Admin: publish to `school:notification` and `school:role:{guardian|student|staff}`; manage topics
- School Staff: publish to courses they teach; manage course topics
- Guardians/Students: can register devices and manage their own subscriptions

## Error Handling
- 401 Unauthorized when no session
- 403 Forbidden when role check fails (e.g., non-admin publishing school-wide)
- 404 Not Found for unknown course/topic/device
- 409 Conflict for duplicate subscriptions

## Notes
- Topics created lazily via `/topics/ensure` or during publish/subscribe flows
- Device ownership enforced by session user id
- DB sources:
  - course staff → from `course_staff`
  - enrollments → from `enrollments`
  - guardians of student → join `guardian_students`
