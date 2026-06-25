"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { COLOR } from "./foundation-ui";

// "Enable call alerts on this device" (issue #808 task 5). A provider who allows instant 1:1 calls can
// turn on Web Push so their device wakes when a member rings them, even with the app closed. The in-app
// poll is always the fallback; this only augments it. Per-device: a provider enables alerts on each
// device separately, because a push subscription belongs to one browser on one device.
//
// States covered: unsupported browser, permission denied, enabling, enabled-on-this-device, disabled,
// push-not-configured (the owner has not set the VAPID keys), and error.

type Status =
  | "checking"
  | "unsupported"
  | "unavailable" // push not configured on the server (no VAPID keys)
  | "denied"
  | "enabled"
  | "disabled";

// A VAPID public key is a base64url string; the browser's subscribe call needs it as bytes. Backed by a
// plain ArrayBuffer (not SharedArrayBuffer) so it satisfies the BufferSource type pushManager.subscribe
// expects for applicationServerKey.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function CallAlerts() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Work out the initial state: is push supported, configured on the server, and already subscribed here?
  const init = useCallback(async () => {
    setError(null);
    if (!pushSupported()) {
      setStatus("unsupported");
      return;
    }
    try {
      const res = await fetch("/api/foundation/push/vapid-public-key", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { enabled?: boolean };
      if (!res.ok || !data.enabled) {
        setStatus("unavailable");
        return;
      }
    } catch {
      setStatus("unavailable");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const existing = registration ? await registration.pushManager.getSubscription() : null;
      setStatus(existing ? "enabled" : "disabled");
    } catch {
      setStatus("disabled");
    }
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const keyRes = await fetch("/api/foundation/push/vapid-public-key", { cache: "no-store" });
      const keyData = (await keyRes.json().catch(() => ({}))) as { enabled?: boolean; publicKey?: string };
      if (!keyRes.ok || !keyData.enabled || !keyData.publicKey) {
        setStatus("unavailable");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });

      const json = subscription.toJSON();
      const saveRes = await fetch("/api/foundation/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent.slice(0, 256),
        }),
      });
      if (!saveRes.ok) {
        throw new Error("Could not turn on call alerts. Please try again.");
      }
      setStatus("enabled");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not turn on call alerts. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription) {
        await fetch("/api/foundation/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("disabled");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not turn off call alerts. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const note = (text: string) => (
    <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.5 }}>{text}</div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <BellRing size={16} color={COLOR} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>Call alerts on this device</span>
      </div>

      {error ? (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fecaca",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {status === "checking" ? note("Checking this device…") : null}

      {status === "unsupported"
        ? note("This browser cannot show call alerts. You will still see an incoming call when the app is open.")
        : null}

      {status === "unavailable"
        ? note("Call alerts are not switched on yet. You will still see an incoming call when the app is open.")
        : null}

      {status === "denied"
        ? note(
            "Alerts are blocked for this site in your browser settings. Allow notifications there to turn them on, or keep the app open to see incoming calls.",
          )
        : null}

      {status === "disabled" ? (
        <>
          {note("Get woken to an incoming call on this device even when the app is closed.")}
          <button
            type="button"
            disabled={busy}
            onClick={() => void enable()}
            style={{
              alignSelf: "flex-start",
              padding: "9px 16px",
              borderRadius: 10,
              cursor: busy ? "default" : "pointer",
              background: COLOR,
              color: "#1a1205",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Turning on…" : "Enable call alerts on this device"}
          </button>
        </>
      ) : null}

      {status === "enabled" ? (
        <>
          <div style={{ fontSize: 13, color: COLOR, fontWeight: 600 }}>On for this device</div>
          {note("This device will be woken when a member rings you.")}
          <button
            type="button"
            disabled={busy}
            onClick={() => void disable()}
            style={{
              alignSelf: "flex-start",
              padding: "9px 16px",
              borderRadius: 10,
              cursor: busy ? "default" : "pointer",
              background: "rgba(255,255,255,0.06)",
              color: "#F9FAFB",
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.12)",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Turning off…" : "Turn off on this device"}
          </button>
        </>
      ) : null}
    </div>
  );
}
