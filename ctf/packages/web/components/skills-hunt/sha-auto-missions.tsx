"use client";

// Admin panel for auto-opened missions (Workforce sector gaps): the kill switch and knobs stored
// in skills_hunt_auto_mission_config, plus a "Run now" that opens gap missions for every active
// round on demand (the weekly scheduled run does the same). Lives beside the manual mission list —
// manual creation is untouched.

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens, type SkillsHuntAdminTokens } from "./sha-shared";
import { AdminNumberField } from "./sha-number-field";

type AutoMissionConfig = {
  enabled: boolean;
  minGapThreshold: number;
  maxPerRound: number;
  defaultGoalTarget: number;
  defaultBonusPoints: number;
  updatedAtIso: string | null;
};

const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

type RunResponse = { skipped?: string; rounds?: Array<{ opened: unknown[] }> };

function runNoticeText(data: RunResponse): string {
  if (data.skipped) {
    return `Run skipped: ${data.skipped.split("_").join(" ")}.`;
  }
  const opened = (data.rounds ?? []).reduce((sum, round) => sum + round.opened.length, 0);
  if (opened === 0) {
    return "Run finished — every active round already has its gap missions.";
  }
  return `Run finished — opened ${opened} mission${opened === 1 ? "" : "s"}.`;
}

function ActionButton({ label, busyLabel, busy, disabled, primary, onPress, t }: {
  label: string; busyLabel: string; busy: boolean; disabled: boolean; primary: boolean; onPress: () => void; t: SkillsHuntAdminTokens;
}) {
  const base: React.CSSProperties = primary
    ? { background: t.ACCENT, border: "none", color: "#fff" }
    : { background: "transparent", border: `1px solid ${t.ACCENT}35`, color: t.ACCENT };
  return (
    <button type="button" onClick={onPress} disabled={disabled}
      style={{ ...base, padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
      {busy ? busyLabel : label}
    </button>
  );
}

type PanelBodyProps = {
  config: AutoMissionConfig;
  setConfig: (config: AutoMissionConfig) => void;
  onSave: () => void;
  onRunNow: () => void;
  saving: boolean;
  running: boolean;
  error: string | null;
  notice: string | null;
  t: SkillsHuntAdminTokens;
};

function PanelBody({ config, setConfig, onSave, onRunNow, saving, running, error, notice, t }: PanelBodyProps) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.TEXT, cursor: "pointer" }}>
        <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} />
        Auto-open missions (turn off to stop all generation)
      </label>
      <div style={row}>
        <AdminNumberField id="sham-gap" label="Minimum sector gap" min={0} value={config.minGapThreshold} onChange={(v) => setConfig({ ...config, minGapThreshold: v })} />
        <AdminNumberField id="sham-cap" label="Max auto missions per round" min={0} value={config.maxPerRound} onChange={(v) => setConfig({ ...config, maxPerRound: v })} />
        <AdminNumberField id="sham-target" label="Goal target" min={1} value={config.defaultGoalTarget} onChange={(v) => setConfig({ ...config, defaultGoalTarget: v })} />
        <AdminNumberField id="sham-bonus" label="Bonus points" min={0} value={config.defaultBonusPoints} onChange={(v) => setConfig({ ...config, defaultBonusPoints: v })} />
      </div>
      {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
      {notice && <div style={{ color: t.SUBTLE, fontSize: 13 }}>{notice}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <ActionButton label="Save settings" busyLabel="Saving…" busy={saving} disabled={saving || running} primary onPress={onSave} t={t} />
        <ActionButton label="Run now" busyLabel="Running…" busy={running} disabled={saving || running} primary={false} onPress={onRunNow} t={t} />
      </div>
    </div>
  );
}

export function SkillsHuntAutoMissionPanel({ onRunFinished }: { onRunFinished: () => void }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const [config, setConfig] = useState<AutoMissionConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/skills-hunt/admin/auto-missions/config");
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Unable to load auto-mission settings."));
      }
      const data = (await res.json()) as { config: AutoMissionConfig };
      setConfig(data.config);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load auto-mission settings.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/skills-hunt/admin/auto-missions/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          enabled: config.enabled,
          minGapThreshold: config.minGapThreshold,
          maxPerRound: config.maxPerRound,
          defaultGoalTarget: config.defaultGoalTarget,
          defaultBonusPoints: config.defaultBonusPoints,
        }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Unable to save auto-mission settings."));
      }
      const data = (await res.json()) as { config: AutoMissionConfig };
      setConfig(data.config);
      setNotice("Settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save auto-mission settings.");
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/skills-hunt/admin/auto-missions/run", {
        method: "POST",
        headers: { "x-ctf-csrf": "1" },
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Unable to run the auto-mission generator."));
      }
      setNotice(runNoticeText((await res.json()) as RunResponse));
      onRunFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to run the auto-mission generator.");
    } finally {
      setRunning(false);
    }
  }

  let body: React.ReactNode;
  if (config) {
    body = (
      <PanelBody config={config} setConfig={setConfig} onSave={() => void save()} onRunNow={() => void runNow()}
        saving={saving} running={running} error={error} notice={notice} t={t} />
    );
  } else if (error) {
    body = <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>;
  } else {
    body = <div style={{ color: t.MUTED, fontSize: 13 }}>Loading settings…</div>;
  }

  return (
    <div style={{ marginBottom: 18, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER_STRONG}` }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>Auto missions from Workforce gaps</div>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 12 }}>
        Sectors where Workforce shows the largest talent shortfall get a sector mission opened automatically in each active round. Manual missions are unaffected.
      </div>
      {body}
    </div>
  );
}
