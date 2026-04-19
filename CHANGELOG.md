# Changelog

## [0.4.2] - 2026-04-19

### Security
- **High**: Replaced remaining `execSync` shell-string calls in `/api/update/apply` (`git pull`, `docker compose up`) and `getCurrentGitCommit()` with `spawnSync` argument arrays — all `execSync` usage is now fully eliminated from the codebase.
- **Medium**: Scoped WebSocket `dashboard:restore_status` broadcasts to only the specific dashboard session that triggered the restore, instead of broadcasting to all connected clients. Uses `x-socket-id` request header passed from the frontend.

## [0.4.1] - 2026-04-19

### Security
- **Critical**: Fixed fatal syntax error (dangling `}`) in `agent-app/backup.js` that caused the agent to crash on startup.
- **Critical**: Replaced all remaining `execSync` shell-string calls (nginx reload, docker restart) with `spawnSync` argument arrays to eliminate shell injection vectors.
- **High**: Removed `/api/agent-bundle.js` and `/api/backup-bundle.js` from the public `openPaths` list — agent bundles now require a valid `AGENT_TOKEN`.
- **High**: Fixed Host Header injection in the dynamic `install.sh` generator — URLs now use the trusted domain stored in the database rather than `req.headers.host`.
- **High**: Added input validation for `POST /api/users` and `PUT /api/users/:id/reset` — username must be 3-32 alphanumeric chars, password minimum 8 characters.
- **High**: Sanitized raw AWS SDK error messages from `POST /api/destinations/verify` — now returns a generic error message; details are logged server-side only.
- **Medium**: Added regex validation for Agent IDs on `POST /api/agents`.
- **Medium**: `decrypt()` fallback now returns `null` instead of raw plaintext for unrecognized input formats.
- **Medium**: Added `express-rate-limit` — login endpoint is now limited to 10 attempts per 15 minutes per IP.
- **Low**: Added `helmet` for standard HTTP security headers (CSP, X-Frame-Options, etc.).
- **Low**: Added mandatory startup validation for `AGENT_TOKEN` in `agent.js` — exits with a clear error instead of failing silently.

## [0.4.0] - 2026-04-19

### Added
- **Automated Remote Restore**: A completely new architecture allowing agents to natively stream and unpack `.tar.gz` archives securely from S3/FTP directly into their local filesystem.
- **Zero-Disk Extract**: Restores stream seamlessly into the `tar` pipe over memory, entirely bypassing the need for temporary storage bloat on the Agent host.
- **Granular Path Recovery**: Restore Modal includes specific input rules for defining isolated extraction targets alongside dedicated, customizable Restore Directory injections instead of defaulting exclusively to live root locations.
- **Live WebSocket Progress Tracking**: Agents actively broadcast reverse-transfer telemetry to the master server enabling dedicated Dashboard tracking for active restoration sequences.

## [0.3.0] - 2026-04-19

### Added
- **Per-Agent Enrollment & Tokens**: Agents now securely authenticate using explicitly generated API tokens (`AGENT_TOKEN`) before broadcasting presence or requesting backup instructions. Agent tokens are hashed and stored centrally.
- **RCE Safeguard**: The `backup.js` archiver implements argument-isolated parameter validation preventing dynamic code injection via malformed directory structures during TAR operations. Setting operations such as Certbot provisioning execute via hardened `spawnSync` sequences.
- **Authenticated Encryption**: S3 API keys and related credentials encrypt natively to `AES-256-GCM` featuring embedded ciphertext versioning and Authentication tagging (`gcm:<iv>:<tag>:<encrypted>`).
- **Timing Safe Authentication**: Enhanced master database sessions incorporating strict 24-hour expiration schedules on Maps, with hardened password comparisons mitigating timing exposure alongside increased PBKDF2 iterations (`600,000`).

### Changed
- Dashboard UI securely triggers via `Same-Origin` protocols natively defaulting to routing internal websockets alongside Relative API URLs.
- Setup parameters default initial `ADMIN_PASSWORD` requirements to dynamically generated secrets.
- Overhauled `install.sh` mechanics: installers extract setup profiles strictly from predefined localized bash `.env` parameters to mitigate script-history token exposure. 
