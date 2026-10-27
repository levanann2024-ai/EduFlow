# EduFlow authentication setup

Authentication uses PostgreSQL, Argon2id password hashes, short-lived access JWTs, and rotating refresh tokens in an HttpOnly cookie.

## Local development

1. Copy `backend/.env.example` to `backend/.env`. Set a Neon `DATABASE_URL` with TLS enabled (`sslmode=require`), a unique `AUTH_JWT_SECRET` of at least 32 bytes, and the exact frontend origin in `AUTH_ALLOWED_ORIGINS`.
2. Copy `frontend/.env.example` to `frontend/.env`. The Vite proxy defaults to the local backend at `http://localhost:3001`.
3. Start the backend and frontend in separate terminals with `npm run dev` from their respective folders.

To use the three-role demo without a database, explicitly set `EDUFLOW_DEMO_MODE=true` in the backend and `VITE_EDUFLOW_DEMO_MODE=true` in the frontend, then restart both development servers. The role selector is only compiled into Vite development builds. Demo accounts use synthetic identities and cannot access database-backed administration APIs. Demo authentication is rejected when `NODE_ENV=production`; the demo flag must never be enabled on a production backend.

## Database initialization

Run `npm run migrate` from `backend` to apply repository migrations. The runner uses a transaction and advisory lock, requires a Neon TLS connection, and records ordered migration names and checksums. It supports upgrading a schema created by migration 001, takes short-timeout table locks for data preflight and constraint changes, and stops without changing existing rows when the preflight finds conflicts. Migration 003 backfills the new membership role from `users.role`; it does not change membership status or remove rows. Migration 001 remains the bootstrap migration and is not modified by later schema changes.

PostgreSQL integration tests use only a separate loopback database whose name is `eduflow_test` or `eduflow_test_<suffix>`. Set `EDUFLOW_TEST_DATABASE_URL` for that test database and run `npm run test:postgres` from `backend`. Each run creates and drops a random isolated schema inside that explicitly named test database. The test command rejects Neon and all non-loopback hosts; it never reads or falls back to `DATABASE_URL`. Without this variable, the PostgreSQL tests are skipped.

After the schema is applied, an operator can bootstrap the first system administrator once by setting `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and `BOOTSTRAP_ADMIN_PASSWORD` in the local backend environment and running `npm run bootstrap:admin` from `backend`. The command refuses to run if the users table is non-empty. Remove the bootstrap password from the environment immediately afterward.

System administrators can create schools and generate student/teacher invitation links from the user-management page. Each invitation assigns one role; users cannot select or switch roles at login. Invitees set their own password, then complete their profile before entering the app. Student grade/student number and teacher employee number are optional profile fields. The one-time invitation token is only stored as a hash in PostgreSQL; EduFlow does not send email, so administrators must share the generated link through an approved channel.

Expired invitations are retained for history and closed when a replacement invitation is created. Accepting an invitation rechecks that its school is active while holding a transaction lock; suspended schools cannot receive new invitations or accept existing ones.

## Read-only school and class APIs

The backend exposes these authenticated, account-ready endpoints:

- `GET /api/classes` lists active classes visible to the caller. System administrators see active classes across active schools; school administrators are limited to their active school memberships; teachers see classes with an active assignment; students see classes with an active membership. An optional `schoolId` filter cannot expand the caller's scope.
- `GET /api/classes/:classId` returns an active class only when it is within the caller's scope.
- `GET /api/classes/:classId/students` returns active, non-disabled students in a class. Only administrators in scope and assigned teachers can read rosters.

Students and teachers must resolve to exactly one active school for authentication and school/class reads. If they have zero or multiple active schools, auth rejects the scope and class reads return `409 SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION` rather than selecting a school. The versioned schema migration adds a role-aware database uniqueness constraint for active student/lecturer memberships; school administrators may still belong to multiple schools.

These endpoints are read-only. Class creation, membership changes, teacher assignment changes, and frontend integration are not part of this API phase.

## Teacher assignment grading

Run `npm run migrate` to apply migration 008, which adds teacher scores and feedback to submitted class assignments. Assigned teachers can retrieve an assignment's student work with `GET /api/classes/:classId/assignments/:assignmentId/submissions` and save a score from 0 to 10 plus feedback with `PUT /api/classes/:classId/assignments/:assignmentId/submissions/:studentId/grade`. Both routes require an active teacher assignment for the class subject. Students see confirmed scores and feedback from `GET /api/assignments`; resubmitting an answer clears the prior grade so the updated work can be reviewed again.

## Homeroom class overview

Migration 009 adds the class subject catalog and one homeroom teacher/subject assignment per class. Existing active teacher-subject assignments are copied into the class subject catalog; school operators must register additional curriculum subjects and designate the homeroom teacher and subject in `class_subjects` and `class_homeroom_assignments`. Homeroom teachers can read an aggregate class grade summary with `GET /api/classes/:classId/homeroom-gradebook?academicYear=...&semester=...`; access is limited to the designated teacher. Averages use the gradebook weights (regular ×1, midterm ×2, final ×3), and subjects without scores return `null`.

Migration 010 adds `student_term_grades.confirmed_average` for the weighted average calculated and saved with the component scores. Migration 011 adds `previous_confirmed_average`, retaining the TBM from immediately before the most recent save for that student, subject, and term. The gradebook preview calculates directly from current inputs; saving the component scores stores the new TBM and shifts the prior saved TBM into the comparison column. The difference is therefore an edit-to-edit change within the same term, not a semester-over-semester comparison. Confirmed averages are also returned in the homeroom summary. Teachers save changed rows together through `PUT /api/classes/:classId/gradebook`; the operation validates the active roster and assigned subject, then persists the submitted rows in one transaction.

## Deployment

Set `DATABASE_URL`, `AUTH_JWT_SECRET`, and a comma-separated exact `AUTH_ALLOWED_ORIGINS` list in the backend deployment environment. Behind a single reverse proxy, set `TRUST_PROXY_HOPS=1` so rate limits use the caller IP. For a frontend and API on separate sites, configure `AUTH_COOKIE_SAME_SITE=none` and `AUTH_COOKIE_SECURE=true`, and retain the Origin check and credentialed CORS allowlist. Do not place database credentials or signing secrets in frontend variables.
