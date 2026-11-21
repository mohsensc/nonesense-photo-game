# Bryan B-roll vs Saanvi Snaps

Guess which friend took the photo.

Run locally: `npm start`, then open http://localhost:5330. Scores go to `data/leaderboard.json`.

Deploy: import the repo in Vercel, then add an Upstash Redis integration from the Vercel Marketplace so `KV_REST_API_URL` and `KV_REST_API_TOKEN` exist.

Photos live in `photos/` and are listed in `photos.json` as `{"file": "a.jpg", "owner": "bryan" | "saanvi"}`.
