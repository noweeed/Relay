# Security and privacy review

## Implemented controls

- Every project-scoped route authenticates first and checks membership; owner/admin-only and owner-only mutations add explicit role checks.
- Candidate and duplicate services re-scope linked records to the project, preventing cross-project object-ID access.
- Refresh sessions are hashed, rotated, revocable, and delivered through secure HTTP-only cookies in production.
- Browser auth mutations reject an untrusted `Origin`; CORS allows only `FRONTEND_URL`.
- Authentication attempts are IP-limited. Transcription, extraction, reprocessing, and command interpretation are limited per authenticated user.
- Helmet security headers, one-megabyte JSON limits, bounded multipart audio, MIME/container verification, and sanitized filenames are enabled.
- Audio remains private. Browser reads require membership; worker access uses short-lived signed URLs or private S3 URLs.
- Logs redact credentials, auth cookies, passwords, token fields, API keys, storage secrets, and response cookies. Request query strings are omitted so audio signatures are not logged.
- AI output is schema validated, source-evidence checked, and never silently merged into project work.

## Data handling

Relay stores account data, project membership, meeting input/audio, transcripts, extracted candidates, tasks, source quotes, activity, commands, and notifications. Provider calls disclose only the content required for extraction, transcription, or embedding. Operators must configure provider retention settings and publish a user-facing retention/deletion policy appropriate to their deployment.

Account deletion follows the implemented project-ownership safeguards. Database backups and object-storage lifecycle policies are deployment responsibilities; deleting an application record does not automatically erase older provider-managed backups.

## Production review items

- Terminate TLS at the trusted platform boundary and keep MongoDB, Redis, and object storage private.
- Use least-privilege service accounts and separate Node read/write access from Python read-only duplicate search.
- Use a shared external rate-limit store when running multiple API replicas.
- Alert on repeated 401/403/429 responses, dead-letter growth, provider failures, and meetings stuck in processing.
- Re-run dependency audits, authorization tests, and the complete integration suite before release.
- Confirm the exact public origin before enabling `SameSite=None` production refresh cookies.

