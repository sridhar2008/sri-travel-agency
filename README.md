- `POST /api/contact` with `{ "name": "...", "email": "...", "phone": "...", "state": "...", "destination": "...", "packageId": "...", "travelers": 2, "stayDays": 3, "hotelPlan": "standard", "transport": "...", "estimatedPrice": "...", "suggestion": "...", "tripPlan": { "enquiryId": "ENQ-2026-XXXXX" } }`
# Sri Travel Agency

## Run locally

Requires Node.js 22.5 or newer.

```bash
npm start
```

Open `http://localhost:3000` in a browser. The server serves the website and saves newsletter subscriptions and contact enquiries to `data/submissions.json`.

The hosted site uses Firebase Hosting, Firebase Authentication, and Firestore. The configured owner account `sridhar.govindan2008@gmail.com` can manage submissions after email verification; other accounts must have the custom claim `{ "admin": true }`. Local development still uses `npm start` and the SQLite fallback.

The public `#account` section supports Firebase email/password registration and sign-in. Each account displays Firebase's unique user ID and stores the user's name and mobile number in their own protected `users/{uid}` profile. Password recovery is sent by email for both user and admin accounts; Firebase does not provide SMS password reset for email/password accounts.

To provision the first hosted administrator, create an Email/Password user in Firebase Console under Authentication, then assign that user's UID the `{ "admin": true }` custom claim from a trusted environment as shown below. The browser cannot safely create this claim itself.

If the correct account says it has no admin access, assign the claim from a trusted environment with the Firebase Admin SDK. Do not put a service-account key or claim-setting code in the browser:

```js
await getAuth().setCustomUserClaims('FIREBASE_USER_UID', { admin: true });
```

After assigning the claim, sign out and sign in again so Firebase refreshes the ID token. The Firestore rules intentionally reject every account that does not have this claim.

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