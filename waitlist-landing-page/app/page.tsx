"use client"

import { useState } from "react"

export default function WaitlistPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("loading")
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("success")
        setMessage(data.message ?? "You're on the list!")
        setEmail("")
      } else {
        setStatus("error")
        setMessage(data.error ?? "Something went wrong. Please try again.")
      }
    } catch {
      setStatus("error")
      setMessage("Something went wrong. Please try again.")
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
      <h1>Join the Waitlist</h1>
      <p>
        Get early access to the Charging the Future platform — secure support
        services for survivors.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1, padding: "8px 12px", fontSize: 16 }}
        />
        <button type="submit" disabled={status === "loading"} style={{ padding: "8px 16px" }}>
          {status === "loading" ? "Submitting…" : "Join"}
        </button>
      </form>
      {message && (
        <p style={{ marginTop: 16, color: status === "error" ? "red" : "green" }}>
          {message}
        </p>
      )}
    </main>
  )
}
