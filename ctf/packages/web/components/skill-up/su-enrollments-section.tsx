'use client';

// "Who enrolled" on the SkillUp admin panel.
//
// The KPI cards count enrollments and the cohort rows show how many seats are gone, but neither
// names anybody — so an admin could see a seat had been taken without being able to see who took it
// (owner report, 2026-08-29). This lists the people, newest first, by the handle they signed up
// under.
import type { SkillUpTokens } from './su-shared';
import type { AdminEnrollment } from './su-admin-shared';

// Clerk could not resolve the handle (deleted account, or no secret key in this runtime). Show a
// short id rather than an empty cell, so the row still points at a specific person.
function memberLabel(enrollment: AdminEnrollment): string {
  return enrollment.username ? `@${enrollment.username}` : `member ${enrollment.userId.slice(0, 10)}`;
}

function formatEnrolledAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function EnrollmentRow({ enrollment, t }: { enrollment: AdminEnrollment; t: SkillUpTokens }) {
  return (
    <div style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>{memberLabel(enrollment)}</span>
        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: t.BG, color: t.MUTED, border: `1px solid ${t.BORDER_SOLID}`, textTransform: 'capitalize' }}>
          {enrollment.status}
        </span>
        <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>{formatEnrolledAt(enrollment.enrolledAtIso)}</span>
      </div>
      <div style={{ fontSize: 12, color: t.MUTED, marginTop: 4 }}>
        {enrollment.cohortTitle || `cohort ${enrollment.cohortId.slice(0, 8)}`}
      </div>
    </div>
  );
}

export function EnrollmentsSection({ enrollments, t }: { enrollments: AdminEnrollment[]; t: SkillUpTokens }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>
        Who enrolled {enrollments.length > 0 ? `(${enrollments.length})` : ''}
      </h2>
      <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginBottom: 12 }}>
        Every enrollment, newest first, by the handle the member signed up under — including the ones
        they have since finished or left, which is why this can be longer than the live count above.
      </p>
      {enrollments.length === 0 ? (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: t.MUTED, fontSize: 13, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          Nobody has enrolled in a cohort yet.
        </div>
      ) : (
        enrollments.map((enrollment) => <EnrollmentRow key={enrollment.id} enrollment={enrollment} t={t} />)
      )}
    </div>
  );
}
