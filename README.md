# Photo Event Uploader

Simple example: admin page to create events and upload multiple images per event, store files in AWS S3 and metadata in SQLite.

## Quick start

1. Copy `.env.example` to `.env` and fill in AWS credentials and S3_BUCKET.
2. npm install
3. npm run dev
4. Open http://localhost:3000 and create an event, then upload photos.

## Notes
- Images are uploaded to S3 under `S3_PREFIX/eventId/`.
- Metadata stored in `data.sqlite` (see `DATABASE_FILE` env var).
- CSRF protection is enabled (cookie-based) and rate limiting is applied to auth and upload endpoints. The frontend fetches a CSRF token from `/api/auth/csrf-token` and includes it in `X-CSRF-Token` for state-changing requests.
- No authentication is provided in the example. Add auth for production.
