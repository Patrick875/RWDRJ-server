# RWDRJ API

The backend is an Express API backed by MongoDB and Cloudinary. It can run as a normal Node process for local development or as a Netlify Function in production.

## Local development

1. Copy `.env.example` to `.env` and fill in local values.
2. Install dependencies with `npm install`.
3. Start the API with `npm run start:dev`.
4. Check `GET /health` and `GET /ready`.

The API defaults to port `8080`. The frontend origin must be listed in `ALLOWED_ORIGINS`.

## Admin authentication

Admin login is available at `POST /api/admin/login`. The API returns a bearer token for the frontend and also sets a secure HTTP-only cookie in production. Send the bearer token as:

```text
Authorization: Bearer <token>
```

Public signup is disabled unless `ALLOW_PUBLIC_SIGNUP=true`. Administrators should invite users through the admin API instead.

Roles are `administrator`, `publisher`, `editor`, and `viewer`. Publishing and user-management operations require elevated roles.

## CMS API

Public content is available under `/api/cms`:

- `GET /api/cms/pages/:slug`
- `GET /api/cms/content?type=news|publication|event|impact_story|report|resource`
- `GET /api/cms/content/:slug`
- `GET /api/cms/settings`

Protected CMS operations are available under `/api/admin`:

- `/pages`
- `/content`
- `/settings`
- `/users`
- `/audit-logs`

Pages and content entries support draft, published, and archived states. Updates increment a revision and can provide `baseRevision` to detect conflicting edits.

## Netlify deployment

The Netlify entry point is `netlify/functions/api.js`, with routing configured in `netlify.toml`. Configure production secrets in Netlify environment variables or Secrets Controller; do not commit them to this repository.

Netlify provides function logs and deployment previews. The API also emits request IDs and structured request timing logs for troubleshooting.
