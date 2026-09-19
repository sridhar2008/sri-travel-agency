# Sri Travel Agency

## Run locally

Requires Node.js 18 or newer.

```bash
npm start
```

Open `http://localhost:3000` in a browser. The server serves the website and saves newsletter subscriptions and contact enquiries to `data/submissions.json`.

Open `http://localhost:3000/#admin` to sign in and view all submissions on the same page. Admin login: username `sriagency`, password `asdfghjkl`.

### API

- `POST /api/newsletter` with `{ "email": "traveler@example.com" }`
- `POST /api/contact` with `{ "name": "...", "email": "...", "phone": "...", "destination": "...", "message": "..." }`