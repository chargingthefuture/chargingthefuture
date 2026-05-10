# Backend Infrastructure Migration Plan: Railway → Agent-Friendly Platform

**Status:** Planning stage (May 10, 2026)  
**Problem:** Railway doesn't expose MCP server or provide agent-friendly log/shell access  
**Goal:** Month-to-month platform with full agent SSH access, <$20/mo budget, terminal-first

---

## Problem Statement

### Current Architecture
- **Backend:** Next.js app deployed on Railway
- **Database:** Neon PostgreSQL (managed, staging + prod)
- **Secrets:** Infisical (self-hosted on Railway)
- **CI/CD:** GitHub Actions with multi-gate quality pipeline
- **Issue:** Agents (GitHub Copilot, Claude Code, RabbitAI) cannot access Railway logs, MCP server, or run commands

### Why Railway Fails Agents

| Aspect | Railway | Problem |
|---|---|---|
| **Log access** | `railway logs --tail 200` | Not composable; agents can't stream reliably |
| **Server exec** | No SSH available | Agents can't diagnose, restart, or tail logs interactively |
| **MCP server** | Not deployed | Agents have no feedback triage API |
| **Deployment** | `railway up --ci` via Railway CLI | CLI-specific; agents can't automate easily |
| **Scripting** | Limited; Railway-specific | Agents struggle with Railway-specific workflows |

### Requirements

1. **Full agentic access** (SSH, exec, logs, deployments)
2. **Deploy pm-mcp-server as permanent service** (agents trigger feedback triage)
3. **Keep Neon PostgreSQL** (managed, simpler than self-hosting)
4. **Terminal/script-first** (no UI dependency)
5. **Solo dev friendly, GitHub Codespaces compatible**
6. **Month-to-month pricing** (not annual)
7. **NOT AWS or Azure**

### Tech Constraints

- Build requires **8GB RAM** (`NODE_OPTIONS=--max-old-space-size=8192`)
- Infisical currently self-hosted on Railway; need migration path
- **~20 external service dependencies** (Clerk, GetStream, Formance, Supabase, Sentry, etc.)
- **Multi-environment** (staging + production)
- **Single entry point:** Next.js app at `ctf/packages/web`

---

## Solution Options

### Option A: Fly.io (Managed PaaS)

**Status:** NOT RECOMMENDED due to pricing model uncertainty.

**Why it was considered:**
- Native SSH: `fly ssh console`
- Excellent CLI: `fly logs`, `fly deploy`, `fly status`
- Can self-host Infisical
- Similar to Railway operationally

**Why it's blocked:**
- Pricing model unclear (annual discount structure vs. month-to-month)
- Reported to be $28+/mo or unclear commit requirement
- Not suitable for month-to-month budget constraint

---

### Option B: Self-Hosted VPS + Docker Compose ⭐ **RECOMMENDED**

**Why this wins:**

| Aspect | Fly.io | VPS + Docker |
|---|---|---|
| **Monthly cost** | $28+/mo or unclear | €3.99–6/mo VPS + $0 Docker = **~$5–20/mo** |
| **Pricing model** | Unclear annual | **Pure month-to-month** |
| **Agent SSH** | Scoped (`fly ssh`) | **Full root access** |
| **Infrastructure** | Managed (less control) | **Full ownership** |
| **Infisical** | Messy to self-host | **Simple Docker container** |
| **Terminal-first** | CLI + flyctl patterns | **SSH + Docker CLI (standard)** |
| **Complexity** | Fly-specific patterns | **Industry standard Docker** |

---

## Pricing Breakdown (VPS Approach)

| Component | Platform | Monthly Cost | Notes |
|---|---|---|---|
| **App Server** | Hetzner CX11 | €3.99 (~$4.50) | 2 CPU, 4GB RAM, 40GB SSD; EU location |
| | Linode Nanode | $5 | 1 CPU, 1GB RAM; US location |
| **PostgreSQL** | Neon (free tier) | $0 | 3 free compute projects available |
| | Neon (pro) | ~$15 | If you need performance upgrades |
| **Infisical** | Docker on VPS | $0 | Containerized on same VPS |
| **PM-MCP Server** | Docker on VPS | $0 | Another service in docker-compose |
| **Domain/DNS** | Cloudflare | $0 | Free tier sufficient |
| | Route53 | $0.50 | If you use AWS Route53 |
| **Total estimate** | | **$5–20/mo** | Hetzner + free Neon + VPS containers |

**Comparison:** Railway was ~$5–10/mo; Fly.io quoted $28+/mo; VPS approach is **$5–20/mo month-to-month** with full control.

---

## Recommended Architecture: Docker Compose on VPS

### Services Running on Single VPS

```
┌─ Hetzner/Linode VPS (€3.99–5/mo) ────────────────────────┐
│                                                           │
│  ┌─────────────────────────┐                            │
│  │ Next.js App (@ctf/web)  │ ← Port 3000                │
│  │ (Docker container)      │                            │
│  └─────────────────────────┘                            │
│           ↓                                              │
│  ┌─────────────────────────┐                            │
│  │ PM-MCP Server           │ ← Port 3001                │
│  │ (feedback triage)       │                            │
│  └─────────────────────────┘                            │
│           ↓                                              │
│  ┌─────────────────────────┐                            │
│  │ Infisical               │ ← Port 8000 (optional UI)  │
│  │ (secrets management)    │                            │
│  └─────────────────────────┘                            │
│                                                           │
│  All three: Docker containers in docker-compose         │
│  Orchestrated by: docker-compose.yml                    │
│  Volumes: persistent storage for Infisical             │
│                                                           │
└───────────────────────────────────────────────────────────┘
        ↓
┌─ Neon PostgreSQL (managed) ────────────────────────────────┐
│ - Staging: staging database (free tier)                   │
│ - Production: prod database (free or pro tier)            │
│ - Connection: via DATABASE_URL from Infisical            │
└────────────────────────────────────────────────────────────┘
        ↓
┌─ External Services (unchanged) ───────────────────────────┐
│ - Clerk (auth)                   - Sentry (observability) │
│ - GetStream (chat/video/feeds)   - Supabase (storage)    │
│ - Formance (ledger)              - etc. (20 total)       │
└────────────────────────────────────────────────────────────┘
```

### Agent Access (What Agents Can Do)

```bash
# From Codespaces terminal (agents can SSH into VPS):
ssh root@<vps-ip>

# Monitor logs in real-time
docker-compose logs -f web
docker-compose logs -f pm-mcp-server

# Run pre-flight checks
docker-compose exec web pnpm run check:formance-env

# Restart services
docker-compose restart web

# View all running containers
docker-compose ps

# Deploy new code
cd /app && git pull origin main && docker-compose pull && docker-compose up -d

# Query feedback via MCP API
curl -s http://localhost:3001/api/feedback/list | jq .
```

---

## Migration Phases

### Phase 1: VPS Setup (30 min)

1. **Register account** at Hetzner.com or Linode.com
2. **Spin up server:**
   - Hetzner CX11: €3.99/mo (2 CPU, 4GB RAM, 40GB SSD)
   - Linode Nanode: $5/mo (1 CPU, 1GB RAM)
3. **Install SSH key** for Codespaces → VPS access
4. **Install Docker + Docker Compose** on VPS
5. **Test connection:** `ssh root@<vps-ip>`

**Effort:** 30 min (mostly waiting for provisioning)

### Phase 2: Build Dockerfile + Compose Config (1 hour)

**Create: `ctf/Dockerfile.web`**
- Adapts `railway.toml` build/start commands to Docker multi-stage build
- Build stage: `corepack enable && pnpm build` (8GB heap)
- Runtime stage: `pnpm start` with `check:formance-env` pre-flight

**Create: `ctf/docker-compose.yml`**
```yaml
version: '3.9'
services:
  web:
    build:
      context: ./ctf
      dockerfile: Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}  # From Neon
      - INFISICAL_TOKEN=${INFISICAL_TOKEN}
      - INFISICAL_PROJECT_ID=${INFISICAL_PROJECT_ID}
      # All 20 secrets injected from .env.prod
    depends_on:
      - infisical
    restart: unless-stopped

  infisical:
    image: infisical/infisical:latest
    ports:
      - "8000:8000"
    volumes:
      - infisical-data:/app/data
    environment:
      - INSTALL_URL=http://${VPS_IP}:8000
    restart: unless-stopped

  pm-mcp-server:
    build:
      context: ./ctf/packages/pm-mcp-server
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PORT=3001
    depends_on:
      - web
    restart: unless-stopped

volumes:
  infisical-data:
```

**Create: `.env.prod.example`** (commit to repo, not actual secrets)
```
DATABASE_URL=postgresql://user:pass@...
INFISICAL_TOKEN=...
INFISICAL_PROJECT_ID=...
# ... all 20 secrets
```

**Effort:** 1 hour

### Phase 3: Deploy Staging (1 hour)

1. **SSH into VPS:**
   ```bash
   ssh root@<vps-ip>
   ```

2. **Clone repo:**
   ```bash
   cd /app
   git clone https://github.com/chargingthefuture/chargingthefuture.git .
   ```

3. **Create .env.prod with actual secrets** (from Infisical or GitHub Actions secret)

4. **Deploy:**
   ```bash
   docker-compose up -d --build
   ```

5. **Verify startup:**
   ```bash
   docker-compose logs -f web  # Watch startup; should complete in ~5-10 min
   ```

6. **Health check:**
   ```bash
   curl http://localhost:3000  # Should serve Next.js
   ```

7. **Test agent SSH:**
   ```bash
   # From Codespaces
   ssh root@<vps-ip> docker-compose logs -f web
   ```

**Effort:** 1 hour (mostly waiting for build)

### Phase 4: Update GitHub Actions CI/CD (1 hour)

**File: [`.github/workflows/deploy-backend-railway.yml`](.github/workflows/deploy-backend-railway.yml)**

Replace this:
```yaml
- name: Deploy to Railway
  run: railway up --ci
```

With this:
```yaml
- name: Deploy to VPS
  env:
    VPS_IP: ${{ secrets.VPS_IP }}
    VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
  run: |
    mkdir -p ~/.ssh
    echo "$VPS_SSH_KEY" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
    ssh -o StrictHostKeyChecking=no root@$VPS_IP \
      "cd /app && \
       git pull origin main && \
       docker-compose pull && \
       docker-compose up -d web && \
       docker-compose logs --tail 20 web"
```

**GitHub Actions secrets to add:**
- `VPS_IP` — your VPS public IP
- `VPS_SSH_KEY` — SSH private key for root@VPS_IP

**Effort:** 1 hour

### Phase 5: Update Ona Automation Tasks (30 min)

**File: [`.ona/automations.yaml`](.ona/automations.yaml)**

Replace `railway-debug` task:
```yaml
railway-debug:
  entrypoint: bash
  script: |
    export VPS_IP="${VPS_IP}"
    export VPS_SSH_KEY="${VPS_SSH_KEY}"
    
    mkdir -p ~/.ssh
    echo "$VPS_SSH_KEY" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
    
    echo "=== VPS Status ===" | tee /tmp/railway-debug.log
    ssh -o StrictHostKeyChecking=no root@$VPS_IP docker-compose ps 2>&1 | tee -a /tmp/railway-debug.log || true
    
    echo "" | tee -a /tmp/railway-debug.log
    echo "=== Last 200 log lines ===" | tee -a /tmp/railway-debug.log
    ssh -o StrictHostKeyChecking=no root@$VPS_IP docker-compose logs --tail 200 web 2>&1 | tee -a /tmp/railway-debug.log || {
      echo "WARNING: Could not fetch VPS logs. Verify VPS_IP and VPS_SSH_KEY in Ona secrets." | tee -a /tmp/railway-debug.log
    }
    
    echo "" | tee -a /tmp/railway-debug.log
    echo "=== Summary ===" | tee -a /tmp/railway-debug.log
    LAST_ERROR=$(grep -iE "(error|failed|exit code|cannot|unable|not found)" /tmp/railway-debug.log | tail -5 || echo "No explicit error lines found")
    echo "Last error lines:" | tee -a /tmp/railway-debug.log
    echo "$LAST_ERROR" | tee -a /tmp/railway-debug.log
    
    echo ""
    echo "Full debug log written to /tmp/railway-debug.log"
    echo "Run: cat /tmp/railway-debug.log"
```

Replace `railway-redeploy` task:
```yaml
railway-redeploy:
  entrypoint: bash
  script: |
    export VPS_IP="${VPS_IP}"
    export VPS_SSH_KEY="${VPS_SSH_KEY}"
    
    mkdir -p ~/.ssh
    echo "$VPS_SSH_KEY" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
    
    ssh -o StrictHostKeyChecking=no root@$VPS_IP \
      "cd /app && \
       git pull origin main && \
       docker-compose pull && \
       docker-compose up -d && \
       docker-compose logs --tail 50 web"
```

**Ona secrets to add:**
- `VPS_IP` — your VPS public IP
- `VPS_SSH_KEY` — SSH private key (from GitHub Actions)

**Effort:** 30 min

### Phase 6: Production Cutover (1 hour)

1. **Validate staging works** via agents:
   ```bash
   ssh root@<vps-ip> curl http://localhost:3000 -s | head -20
   ```

2. **(Optional) Use separate VPS for production** (if budget allows):
   - Spin up second Hetzner CX11 (€3.99/mo)
   - Deploy same docker-compose setup with prod secrets

3. **Update GitHub Actions** to deploy `main` branch:
   - If using same VPS: update `DATABASE_URL` to production
   - If separate VPS: create `secrets.VPS_IP_PROD` and route `main` deploys there

4. **Set up Nginx reverse proxy** (optional, on VPS):
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;
       location / {
           proxy_pass http://127.0.0.1:3000;
       }
   }
   ```

5. **Point DNS to VPS IP** (Cloudflare or Route53)

6. **Keep Railway running for 1 week** as rollback fallback

7. **Test production agent access:**
   ```bash
   ssh root@<vps-ip> docker-compose logs -f web
   ```

8. **Monitor for 1 week**, then decommission Railway

**Effort:** 1 hour (mostly waiting for DNS propagation)

---

## File Changes Summary

| File | Action | Effort |
|---|---|---|
| **`ctf/Dockerfile.web`** | Create | 30 min |
| **`ctf/docker-compose.yml`** | Create | 20 min |
| **`.env.prod.example`** | Create | 10 min |
| **`.github/workflows/deploy-backend-railway.yml`** | Modify | 30 min |
| **`.ona/automations.yaml`** | Modify | 15 min |
| **App code** | None | — |
| **Environment variables schema** | None | — |
| **Database connection** | None (Neon unchanged) | — |

**Total effort:** ~6–7 hours (mostly waiting for builds and provisioning)

---

## Key Decisions (To Confirm Before Implementation)

1. **VPS Provider:** Hetzner (€3.99, EU) or Linode ($5, US)?
2. **Database strategy:** Keep free Neon tier, or upgrade if needed?
3. **Keep Infisical?** Self-host on VPS in docker-compose, or simplify to GitHub secrets initially?
4. **Single or dual VPS?**
   - **Single:** Staging + prod on same VPS, different ports/env overrides (cheaper, ~€4)
   - **Dual:** Separate VPS for prod (safer, ~€8 total)
5. **Agents + auto-deploy?** Should GitHub Actions auto-deploy, or require manual `railway-redeploy` trigger?

---

## What Agents Gain

### Before (Railway)
```bash
# Agents cannot do this:
railway logs --tail 200          # auth fails; not composable
railway ssh console             # doesn't exist
infisical run -- <cmd>          # possible, but not automated from agent terminal
```

### After (VPS + Docker)
```bash
# Agents can do all of this from Codespaces:
ssh root@<vps-ip>               # Full shell access
docker-compose logs -f web       # Real-time tail
docker-compose exec web <cmd>    # Run diagnostics
docker-compose ps               # Show all services
docker-compose restart web      # Restart app

# Deploy new code
ssh root@<vps-ip> \
  "cd /app && git pull origin main && \
   docker-compose pull && docker-compose up -d"

# Query MCP server
curl -s http://<vps-ip>:3001/api/feedback/list | jq .
```

**Agents now have full shell access + MCP API + log streaming + deployment control.**

---

## Fallback & Rollback Strategy

| Scenario | Action |
|---|---|
| **VPS down** | Keep Railway running for 1 week; `git revert` and `railway up --ci` to go back |
| **Docker container crash** | SSH into VPS, `docker-compose restart <service>` |
| **Build fails** | SSH into VPS, `docker-compose logs -f web` to diagnose; fix code; `git pull && docker-compose up -d` |
| **Infisical secrets invalid** | Update `.env.prod` on VPS; `docker-compose restart web` |
| **Database connection lost** | Check `DATABASE_URL` in Neon console; update Infisical; restart containers |

---

## Next Steps

1. **Confirm decisions** (see "Key Decisions" section above)
2. **Register VPS account** (Hetzner or Linode)
3. **Create Dockerfile.web** (adapt from `railway.toml`)
4. **Create docker-compose.yml** (see template above)
5. **Update GitHub Actions** (.github/workflows/deploy-backend-railway.yml)
6. **Update Ona tasks** (.ona/automations.yaml)
7. **Deploy to staging** (Phase 3 above)
8. **Test agent access** (SSH, logs, deploy)
9. **Cutover to production** (Phase 6 above)

---

## Questions & Support

- **Hetzner slower than Linode?** No; Hetzner CX11 has same performance, just cheaper
- **Can agents trigger builds?** Yes; they SSH into VPS and run `docker-compose rebuild`
- **How to update secrets?** Edit `.env.prod` on VPS; `docker-compose restart`; or use Infisical UI
- **Database backups?** Neon handles backup; also consider `pg_dump` scripts on VPS
- **Monitoring?** Use VPS logs via agents; or add external monitoring (Sentry, DataDog) via secrets

---

## References

- Current Railway config: [ctf/railway.toml](../railway.toml)
- Current Infisical guide: [ctf/docs/infisical-migration-guide.md](./infisical-migration-guide.md)
- Current Ona setup: [ctf/docs/ona-automation-setup.md](./ona-automation-setup.md)
- Current CI/CD: [.github/workflows/deploy-backend-railway.yml](../../.github/workflows/deploy-backend-railway.yml)
