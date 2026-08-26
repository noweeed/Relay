# Relay Frontend

The Relay frontend is built and maintained separately with Lovable.

Place exported or synchronized frontend source in this directory when it becomes part of this workspace. Until then, this README preserves a clear boundary and prevents frontend code from being mixed into the backend.

The frontend should:

- call the Node API under `/api`
- use `/health` for environment diagnostics
- use Socket.IO for processing and task events when implemented
- render server state and validation errors
- avoid direct MongoDB access
- never call the Python AI worker directly

Expected local environment configuration:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Frontend implementation is currently outside the v0.1 backend milestone.
