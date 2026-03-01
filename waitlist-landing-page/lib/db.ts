// Use the Neon serverless driver which connects via WebSocket — this avoids
// the SSL-mode security warning that the standard `pg` driver emits when
// DATABASE_URL contains `sslmode=require` (or `prefer`/`verify-ca`).
import { neon } from "@neondatabase/serverless"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.")
}

export const sql = neon(process.env.DATABASE_URL)
