# TSMS — Transit Summit Management System

A mobile-friendly starter website for online applications and summit administration.

## Included features

- Online student application form
- Unique application ID generated after submission
- LRD 500 registration fee field
- Payment reference and optional receipt URL
- Firebase email/password administrator sign-in
- Live application dashboard using Firestore snapshots
- Application approval/rejection
- Manual payment verification and participant verification
- Search and status filters
- CSV export
- Mobile-responsive layout

## Important limitations

This is a starter implementation, not a fully deployed service. It will not collect live applications until you connect it to your own Firebase project and publish it. The public application-status checker needs a trusted backend/Cloud Function to mirror limited status fields into `publicApplicationStatus`; it is intentionally not allowed to read private application records. Until that backend is added, applicants should keep their application ID and contact the organizing committee for a status update.

Payment is recorded, not processed. Do not ask applicants for a mobile money PIN or password. Verify payments in the official payment account before marking them as verified.

## Step 1 — Create Firebase project

1. Open https://console.firebase.google.com/ and sign in with an account controlled by the summit organizers.
2. Create a project, for example `transit-summit-management`.
3. Add a Web app to the project.
4. Copy the Firebase web configuration shown by Firebase.
5. Open `app.js` and replace the placeholder values in `firebaseConfig`.
6. In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.
7. In Authentication → Users, create an account for yourself and each authorized committee member. Do not publish or share passwords.

## Step 2 — Enable Firestore

1. In Firebase Console, create a Cloud Firestore database.
2. Choose the location carefully; use a location supported for your project and audience.
3. Open the Rules tab and paste the contents of `firestore.rules`, then publish the rules.
4. In Authentication → Users, copy the UID for each administrator.
5. In Firestore, create a collection named `admins`.
6. For each admin, create a document whose **document ID is exactly that user's Auth UID**. A harmless field such as `role: "admin"` can be added. Do not allow public users to write to this collection.

The security rules allow anonymous users to create validated application records, but only users with an `admins/{UID}` document can read or modify applications.

## Step 3 — Run locally

Because this site uses JavaScript modules, run it from a local web server rather than opening `index.html` directly.

If Python is installed, open a terminal in this folder and run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Step 4 — Publish the site

One option is Firebase Hosting:

1. Install Node.js, then install the Firebase CLI using the official Firebase instructions.
2. Run `firebase login`.
3. In this project folder, run `firebase init hosting`.
4. Use this folder as the public directory, configure it as a single-page app if asked, and do not overwrite the existing `index.html`.
5. Run `firebase deploy`.

Official instructions:
- Firebase Console: https://console.firebase.google.com/
- Firebase web setup: https://firebase.google.com/docs/web/setup
- Firebase Authentication: https://firebase.google.com/docs/auth
- Cloud Firestore: https://firebase.google.com/docs/firestore
- Firestore security rules: https://firebase.google.com/docs/firestore/security/get-started
- Firebase Hosting: https://firebase.google.com/docs/hosting

## Step 5 — Enable safe public status checks (recommended before launch)

For privacy, the public status form must not query the private `applications` collection. This starter queries a separate `publicApplicationStatus` collection, but no client-side code writes to that collection.

Before launch, add a trusted Firebase Cloud Function (or another secured backend) that runs when an application is created or updated and writes only:
- `applicationId`
- `applicationStatus`
- `paymentStatus`
- `participantStatus`

Use a non-guessable document ID or another abuse-resistant lookup design. Consider rate limiting and avoiding public disclosure of personal information. Never mirror names, phone numbers, school names, payment references, or receipt URLs to the public collection.

## Privacy and operating checklist

- Publish a privacy notice explaining why student data is collected, who can access it, how long it is retained, and how applicants can request correction/deletion.
- Collect only information needed to administer the summit.
- If applicants are minors, establish appropriate parent/guardian consent and safeguarding procedures before launch.
- Restrict admin access and remove accounts when committee members leave.
- Verify payment against the official account before updating payment status.
- Back up records and test the system with dummy data before opening registration.
- Do not upload sensitive receipt documents to public file hosting. If you later add uploads, use authenticated or carefully restricted storage rules.
- Test the security rules with Firebase's Rules Playground or Emulator before accepting real applications.

## Recommended next upgrades

- Secure Cloud Function for status lookup
- QR-code participant badges and check-in
- Certificate generation
- School representative accounts with restricted permissions
- Registration closing date and capacity limit
- Audit log for admin actions
- Firebase App Check and abuse/rate-limiting protections
