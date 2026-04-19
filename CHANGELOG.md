# Changelog

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
