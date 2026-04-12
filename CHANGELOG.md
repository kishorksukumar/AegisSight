# Changelog

All notable changes to AegisSight are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [0.2.0] — 2026-04-12

### Added
- 🐳 Docker Compose stack (backend, frontend, Nginx, Certbot)
- `install.sh` — interactive one-command installer prompting for admin credentials and domain
- `update.sh` — safe updater with automatic database backup and env-var patching
- **Login page** — username + password authentication
- **User Management page** — create, delete, and reset password for dashboard users
- **Settings page** — configure domain and enable Let's Encrypt SSL from the dashboard
- **Agent Details page** — per-server view with live CPU, RAM, Uptime gauges and backup history
- Real-time telemetry heartbeat on agents (CPU load, RAM %, uptime broadcast every 10s)
- PBKDF2-hashed password storage — passwords never stored in plaintext
- Admin credentials seeded from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars on first boot
- `nginx/nginx.conf` — HTTPS with SSL termination, WebSocket support, SPA fallback
- `nginx/nginx-no-ssl.conf` — HTTP-only bootstrap config for first-boot before cert

### Changed
- Main dashboard simplified — shows uptime, last backup status per server; click to drill in
- Recent Backup Activity trimmed to last 10 entries on main dashboard
- `apiFetch` wrapper injects JWT `Authorization` header on all API calls automatically

### Fixed
- Agent connector intervals now clean up on socket disconnect (no duplicate intervals on reconnect)
- Dashboard `NavLink` for root `/` now uses `end` prop to prevent always-active state

---

## [0.1.0] — 2026-04-11

### Added
- Initial release
- Mediator (master) backend with SQLite storage and Socket.IO WebSocket hub
- React dashboard with Dashboard, Agents, and Destinations views
- Lightweight Node.js agent for Linux servers
- Backup jobs via `node-cron` supporting `tar` full and incremental archives
- S3, FTP, SFTP, SCP destination types
- AES-256 field-level encryption for stored credentials
- One-line curl agent installer generated server-side
- Real-time backup progress streamed via WebSocket to dashboard
