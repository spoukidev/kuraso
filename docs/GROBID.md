# Optional External GROBID Endpoint (v2.0)

Kuraso ships **without** a bundled Java/GROBID sidecar so it stays under 40 MB and runs on 4 GB RAM student laptops.

If your research lab runs a self-hosted GROBID server (Docker), you can point Kuraso to it for higher-precision TEI XML structure and reference parsing:

```bash
docker run --rm --init -p 8070:8070 lfoppiano/grobid:0.8.1
```

Then configure `http://localhost:8070` as an optional external structure endpoint.
