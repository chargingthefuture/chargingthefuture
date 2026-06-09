"use client";

import { Award, BookOpen, CheckCircle, Coins, Lock, Star, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BORDER, GREEN, MUTED, SUBTLE, SURFACE, TEXT, TRACK_COLORS, type Achievement } from "./lu-shared";

// Achievements screen — layout aligned to design/.../survivor-hub/LevelUpAchievements.tsx.
// Real data only: every value comes from GET /api/levelup/achievements.
// The mockup splits badges into Earned / In Progress / Locked with per-badge
// emoji, rarity, and a progress fraction. The achievements endpoint exposes only
// an `earned` boolean (plus name, description, track, icon, creditReward), so we
// render two honest buckets — Earned (earned === true) and Locked (not yet
// earned). There is no partial-progress signal in the backend, so no "In
// Progress" section, no progress bars, no rarity, and no emoji are invented; the
// real `icon` name is mapped to a Lucide glyph.

const ICONS: Record<string, LucideIcon> = {
  trophy: Trophy,
  award: Award,
  users: Users,
  star: Star,
  "book-open": BookOpen,
  bookopen: BookOpen,
  coins: Coins,
  "check-circle": CheckCircle,
};

function iconFor(name: string): LucideIcon {
  return ICONS[name?.toLowerCase?.() ?? ""] ?? Trophy;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function StatCard({ label, value, color, Icon }: { label: string; value: string; color: string; Icon: LucideIcon }) {
  return (
    <div style={{ flex: 1, minWidth: 150, background: SURFACE, borderRadius: 10, padding: "14px 16px", border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 12, color: SUBTLE }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function EmptyAchievements() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "48px 0", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: `${GREEN}10`, border: `1px solid ${GREEN}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Trophy size={24} style={{ color: GREEN, opacity: 0.5 }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 6 }}>No badges yet</div>
        <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6, maxWidth: 360 }}>Earn badges by completing cohort milestones. Badges are awarded — they are never bought or spent.</div>
      </div>
    </div>
  );
}

function BadgeTile({ achievement }: { achievement: Achievement }) {
  const tc = TRACK_COLORS[achievement.track] ?? GREEN;
  const Icon = iconFor(achievement.icon);
  return (
    <div style={{ background: SURFACE, borderRadius: 12, padding: "16px 14px", border: `1px solid ${achievement.earned ? `${GREEN}30` : BORDER}`, textAlign: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, margin: "0 auto 10px", background: achievement.earned ? `${GREEN}18` : BORDER, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {achievement.earned ? <Icon size={20} color={GREEN} /> : <Lock size={18} color={MUTED} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: achievement.earned ? TEXT : SUBTLE, marginBottom: 4, lineHeight: 1.3 }}>{achievement.name}</div>
      {achievement.track && (
        <div style={{ display: "inline-block", fontSize: 10, color: tc, background: `${tc}15`, padding: "2px 7px", borderRadius: 20, marginBottom: 8 }}>{achievement.track}</div>
      )}
      {achievement.description && (
        <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.5, marginBottom: 8 }}>{achievement.description}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {achievement.creditReward > 0 ? (
          <span style={{ fontSize: 11, color: achievement.earned ? GREEN : SUBTLE, fontWeight: 600 }}>+{achievement.creditReward} SC</span>
        ) : <span />}
        {achievement.earned && achievement.earnedAtIso && (
          <span style={{ fontSize: 10, color: MUTED }}>{formatDate(achievement.earnedAtIso)}</span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ Icon, color, title, count, dim }: { Icon: LucideIcon; color: string; title: string; count: number; dim?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <Icon size={15} color={color} />
      <span style={{ fontSize: 15, fontWeight: 600, color: dim ? SUBTLE : TEXT }}>{title}</span>
      <span style={{ fontSize: 12, color: dim ? MUTED : SUBTLE }}>— {count} {count === 1 ? "badge" : "badges"}</span>
    </div>
  );
}

export function LevelUpAchievements({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return <EmptyAchievements />;

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);
  const scFromBadges = earned.reduce((sum, a) => sum + (a.grantedCredits || a.creditReward), 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <span style={{ background: `${GREEN}18`, color: GREEN, fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20, border: `1px solid ${GREEN}30` }}>{earned.length} earned</span>
        <span style={{ fontSize: 13, color: SUBTLE }}>of {achievements.length} total badges</span>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Badges earned" value={String(earned.length)} color="#F59E0B" Icon={Trophy} />
        <StatCard label="Still locked" value={String(locked.length)} color={SUBTLE} Icon={Lock} />
        <StatCard label="SC from achievements" value={`${scFromBadges} SC`} color={GREEN} Icon={Coins} />
      </div>

      {earned.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader Icon={CheckCircle} color={GREEN} title="Earned" count={earned.length} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {earned.map((a) => <BadgeTile key={a.id} achievement={a} />)}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <SectionHeader Icon={Lock} color={MUTED} title="Locked" count={locked.length} dim />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, opacity: 0.7 }}>
            {locked.map((a) => <BadgeTile key={a.id} achievement={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}
