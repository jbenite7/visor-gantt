# Frontend v2

This Next.js app is intended to run only through the Docker Compose stack at the repository root.

Run the full system with:

```bash
docker compose up --build
```

The frontend is exposed on port `3000` through the Compose stack. The parser service and database are provided by the same stack and use Docker service names internally.
