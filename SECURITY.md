# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| latest release | ✅ |
| older releases | ❌ (please update) |

## Reporting a vulnerability

Please report security vulnerabilities **privately** — either via [GitHub Security Advisories](https://github.com/romangalaxys10-spec/RyzenDesk/security/advisories/new) ("Report a vulnerability") or by opening an issue marked *security* with minimal detail and we will follow up.

We aim to acknowledge reports within **72 hours** and ship fixes for critical issues as fast as possible.

## Security model notes for operators

- Staff passwords are stored as HMAC-SHA256 hashes keyed by `SESSION_SECRET` — set a strong, unique secret.
- Customer access is via random 36-char secret tokens (`zt_…`), never passwords.
- Sessions are stateless HMAC-signed tokens with a 30-day expiry; suspension/role changes take effect immediately.
- The bootstrap super admin is forced through a password change on first login and cannot touch any data until it completes.
- The JSON database file contains ticket content and tokens — keep the sync repo **private** and the `data/` directory out of any public deployment.
