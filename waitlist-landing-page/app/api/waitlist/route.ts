import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 })
    }

    // Ensure the waitlist table exists
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id        SERIAL PRIMARY KEY,
        email     TEXT UNIQUE NOT NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await sql`
      INSERT INTO waitlist (email) VALUES (${email})
      ON CONFLICT (email) DO NOTHING
    `

    return NextResponse.json({ message: "You're on the list!" }, { status: 200 })
  } catch (error) {
    console.error("Waitlist error:", error)
    return NextResponse.json({ error: "Failed to save your email. Please try again." }, { status: 500 })
  }
}
