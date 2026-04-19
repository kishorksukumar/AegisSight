# AegisSight v0.2

> Secure, self-hosted offsite backup management platform with real-time agent monitoring.

---

## What's New in v0.2

- 🐳 **Docker-based self-hosting** — full production stack with one command
- 🔒 **Auto SSL** via Let's Encrypt & Certbot directly from the dashboard
- ⚙️ **Settings page** — configure domain, email, and enable HTTPS in the UI
- 👤 **User Management** — multi-user authentication with PBKDF2-hashed passwords
- 📊 **Agent Detail pages** — per-server CPU, RAM, Uptime, job history
- 🔑 **JWT-authenticated dashboard** with login/logout flow

---

## Quick Start (Docker — Recommended)

### Prerequisites
- Docker + Docker Compose v2
- A Linux VPS or server (for production SSL)

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/AegisSight.git
cd AegisSight
```

### 2. Run the installer
```bash
chmod +x install.sh
./install.sh
```

The installer will prompt you for:
- **Admin username & password** — your initial dashboard login
- **Domain** — the public domain you'll host AegisSight on (e.g. `aegis.company.com`)
- **Let's Encrypt email** — for SSL cert expiry notices

It writes a `.env` file, then runs `docker compose up -d --build`.

### 3. Access the dashboard
```
http://your-domain.com
```
Login with the credentials you set during installation.

### 4. Enable SSL
1. Make sure your domain's DNS A record points to this server's IP.
2. In the dashboard → **Settings** → enter your domain → click **Enable SSL (Let's Encrypt)**.
3. AegisSight will run Certbot, obtain a certificate, and reload Nginx automatically. Your site is now HTTPS.

---

## Installing Agents on Servers

Once the master app is running, go to **Agents** → **Add New Server** and generate a secure enrollment token. 
Copy the multi-line install command provided by the dashboard:

```bash
export AGENT_ID=your-agent-id
export AGENT_TOKEN=your-secure-token
curl -fsSL https://your-domain.com/api/install.sh | bash
```

This installs the lightweight AegisSight agent on your Linux server. The agent will:
- Register itself with the dashboard automatically
- Report CPU load, RAM usage, and uptime every 10 seconds
- Execute scheduled backup jobs and stream progress to the dashboard

---

## Local Development

### Backend
```bash
cd master-app/backend
npm install
node server.js
```

### Frontend
```bash
cd master-app/frontend
npm install
npm run dev
```

Dashboard available at `http://localhost:5173` — backend API at `http://localhost:4000`.

---

## Architecture

```
┌──────────────────────────────────────────┐
│            Self-Hosted Server            │
│                                          │
│  ┌─────────┐   ┌──────────┐             │
│  │  Nginx  │──▶│ Frontend │ (React SPA) │
│  │(port 80/│   └──────────┘             │
│  │   443)  │──▶ /api ──▶ ┌──────────┐  │
│  └─────────┘             │ Backend  │  │
│       ▲                  │ Node.js  │  │
│       │                  └────┬─────┘  │
│  ┌────────┐                   │        │
│  │Certbot │            ┌──────▼──────┐ │
│  │(SSL)   │            │  SQLite DB  │ │
│  └────────┘            └─────────────┘ │
└──────────────────────────────────────────┘
           ▲ WebSocket
    ┌──────┴──────┐
    │ Linux Agent │ (on each server)
    └─────────────┘
```

---

## Environment Variables

| Variable            | Description                                     | Default          |
|---------------------|-------------------------------------------------|------------------|
| `ADMIN_USERNAME`    | Initial admin username (first boot only)        | `admin`          |
| `ADMIN_PASSWORD`    | Initial admin password (first boot only)        | *(randomly generated)* |
| `DOMAIN`            | Public domain for Nginx and Let's Encrypt       | `localhost`      |
| `LETSENCRYPT_EMAIL` | Email for SSL cert registration                 | —                |
| `PORT`              | Backend API port                                | `4000`           |
| `ENCRYPTION_KEY`    | AES-256 key for credential storage (auto-gen)  | *(auto)*         |

---

## License
MIT
