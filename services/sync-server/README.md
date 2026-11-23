# Kuraso Self-Hostable Sync Server (AGPL-3.0)

Run your own private Kuraso sync server for personal multi-device sync or university lab shared collections (shares metadata, annotations, and notes — never copyrighted PDFs).

## Quick Start (Docker)

```bash
docker build -t kuraso-sync services/sync-server
docker run -p 8787:8787 -e KURASO_SYNC_TOKEN="change-me" -v kuraso_sync:/data kuraso-sync
```

## Endpoints

- `GET /health` — health check
- `GET /v1/libraries/:id/sync` — pull latest library snapshot (requires `Authorization: Bearer <token>`)
- `PUT /v1/libraries/:id/sync` — push updated snapshot
