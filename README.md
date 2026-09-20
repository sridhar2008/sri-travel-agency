- `POST /api/contact` with `{ "name": "...", "email": "...", "phone": "...", "state": "...", "destination": "...", "packageId": "...", "travelers": 2, "stayDays": 3, "hotelPlan": "standard", "transport": "...", "estimatedPrice": "...", "suggestion": "...", "tripPlan": { "enquiryId": "ENQ-2026-XXXXX" } }`
# Sri Travel Agency

## Run locally

Requires Node.js 22.5 or newer.

```bash
npm start
```

Open `http://localhost:3000` in a browser. The server serves the website and saves newsletter subscriptions and contact enquiries to `data/submissions.json`.

The hosted site uses Firebase Hosting, Firebase Authentication, and Firestore. Open the site's `#admin` section and sign in with a Firebase Email/Password account that has the custom claim `{ "admin": true }`. Accounts without that claim cannot view or change submissions. Local development still uses `npm start` and the SQLite fallback.

For local admin login, set strong credentials before starting the server. The server will refuse admin login when they are missing and never uses a weak fallback password:

```powershell
$env:ADMIN_USERNAME = 'admin@example.com'
$env:ADMIN_PASSWORD = 'use-a-unique-password-at-least-16-characters'
npm start
```

Keep `data/` private. The server blocks direct access to that directory, and it should also be excluded from deployment and source control. Set the Firebase admin claim from a trusted server or the Firebase Admin SDK, never from browser code.

### API

- `POST /api/newsletter` with `{ "email": "traveler@example.com" }`
- `POST /api/contact` with `{ "name": "...", "email": "...", "phone": "...", "destination": "...", "packageId": "...", "travelers": 2, "transport": "...", "estimatedPrice": "...", "message": "..." }`
- `DELETE /api/admin/submissions/:id` with an admin bearer token to delete a submission