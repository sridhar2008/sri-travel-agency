# Sri Travel Agency

## Run locally

Requires Node.js 22.5 or newer.

```bash
npm start
```

Open `http://localhost:3000` in a browser. The server serves the website and saves newsletter subscriptions and contact enquiries to `data/submissions.json`.

The hosted site uses Firebase Hosting, Firebase Authentication, and Firestore. Open the site's `#admin` section and sign in with the Firebase Email/Password admin account. Local development still uses `npm start` and the SQLite fallback.

### API

- `POST /api/newsletter` with `{ "email": "traveler@example.com" }`
- `POST /api/contact` with `{ "name": "...", "email": "...", "phone": "...", "destination": "...", "message": "..." }`
- `DELETE /api/admin/submissions/:id` with an admin bearer token to delete a submission