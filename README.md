# rakuma-mercari-frontend

React 19 + Vite SPA. It is a pixel-matched port of the UI prototype in `docs/Rakuma quản lý hệ thống/`.

```sh
npm install
npm run dev     # http://localhost:5173, proxies /api to http://localhost:8080 (override with API_PROXY_TARGET)
npm run build
```

- Data comes from the Go API. The app loads everything once with `GET /api/v1/state`, derives its views in `src/store/compute.js`, and reloads after each write. The server validates every write.
- Design tokens live only in `src/styles/tokens.css`.
- The Docker image serves `dist/` with nginx and proxies `/api` to `backend:8080`. See `../rakuma-mercari-infra`.
