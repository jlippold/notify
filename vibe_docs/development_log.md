# 📝 Development Log

_Append-only log of decisions, changes, and progress. Never modify past entries._

---

## Log Entry Template

```
### [Date] - [Time]
**Status**: [DISCOVERY/PLANNING/DEVELOPMENT/TESTING/DEPLOYED]
**Changed**: [What was changed/decided]
**Reason**: [Why this change/decision was made]
**Impact**: [How this affects the project]
**Next**: [What needs to be done next]
```

---

## Entries

<!-- New entries go below this line -->
### 2025-11-05 -  🧭 Push notifications approach selected
**Status**: DISCOVERY
**Changed**: Selected AWS SNS Mobile Push for iOS (APNs) and Android (FCM) integration from Express/Node
**Reason**: Single abstraction across APNs/FCM, native fit with AWS, handles endpoint lifecycle
**Impact**: Use `@aws-sdk/client-sns`, store SNS EndpointArns per device in Postgres, create register/send endpoints
**Next**: Create environment_setup.md, document routes and DB schema, implement registration and send flows

### 2025-11-05 -  📣 Topics, badges, sounds, links, and unified DB confirmed
**Status**: DISCOVERY
**Changed**: Added support for SNS Topics (broadcast) and payload fields (badges, sounds, deep links)
**Impact**: DB to include topics, subscriptions; API endpoints for subscribe/unsubscribe; payload mapping for APNS/FCM
**Next**: Define DB schema and auth (simple form login), then implement routes

### 2025-11-05 -  🏫 High school domain entities and dynamic topics
**Status**: DISCOVERY
**Changed**: Added roles ('School Staff','Guardian','Student'); tables for students, guardians, staff, courses, enrollments; dynamic topic naming
**Impact**: Topic slugs: `school:notification`, `course:{course_id}:{notification|attendance|grade}`; dynamic SNS topic creation and subscriptions based on relationships
**Next**: Finalize migrations and implement ensure-topic + subscribe flows

### 2025-11-05 -  📢 Role/course notification scenarios and lazy topic creation
**Status**: DISCOVERY
**Changed**: Support teacher→guardians-of-course, teacher→students-in-course, and school-wide by role topics; lazy ensure-topic on publish/subscribe
**Impact**: Add `school:role:{guardian|student|staff}` topic slugs; implement helper functions for ensureTopic/subscribe/publish
**Next**: Implement API routes to publish by role and by course, and auto-subscribe devices based on enrollment/relationships

### 2025-11-05 -  🛡️ School Admin role and terminology update
**Status**: DISCOVERY
**Changed**: Added 'School Admin' role (authorized to publish school-wide); clarified that guardians are called parents/guardians in domain language
**Impact**: Roles seed updated; authorization policy: only School Admin may publish to school-wide topics; recipients by role remain guardians(students' parents), students, staff
**Next**: Enforce authorization checks in publish endpoints; add UI toggle for school-wide role targeting
