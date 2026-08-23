# Field Ledger — front end for the UAF-LR Task Manager

A static HTML/JS front end that talks to your Apps Script backend purely
over `fetch()`. No build step, no framework — host it anywhere that serves
static files (GitHub Pages, Netlify, etc).

## Files

```
index.html         Login screen + the full app (all role-scoped tabs)
feedback.html       Public, no-login page for the task-reminder "give feedback" link
css/style.css        All styling
js/config.js          <-- the one file you need to edit
js/api.js             fetch() wrapper (handles the text/plain CORS trick)
js/app.js             App logic: auth, routing, every tab
js/feedback.js         Logic for the public feedback page
```

## Setup

1. **Deploy the Apps Script backend** (per the comments at the top of your
   `Code.gs`): run `setupApp`, `installNotificationTrigger`,
   `setupDocumentsFeature`, `migrateRolesFeature`, then
   **Deploy > New deployment > Web app**, execute as *Me*, access *Anyone*.
   Copy the `/exec` URL.

2. **Edit `js/config.js`** and paste that URL into `API_URL`:
   ```js
   const CONFIG = {
     API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
     ...
   };
   ```

3. **Push this folder to a GitHub repo** and enable GitHub Pages
   (Settings > Pages > deploy from branch, root or `/docs`).

4. Once your Pages URL is live, go back to the Apps Script editor and run,
   once:
   ```js
   setFeedbackPageUrl('https://yourname.github.io/your-repo/feedback.html');
   ```
   This makes task-reminder emails link to your hosted feedback page
   instead of the raw script URL (avoids the Android "unable to open
   file" issue mentioned in the backend's comments).

5. Log in at `index.html` with the default admin account. The password
   is printed in the Apps Script execution log after running `setupApp`.
   Change it immediately under **Account**.

## What each role sees

| Role | Tabs |
|---|---|
| Admin | Contacts, Tasks, Team logins, Announcements, Documents, Reassignment requests, All comments, Reports (PDF), Account |
| Coordinator | Contacts (view/add), Tasks (view/add), Announcements, Documents (view only), Account |
| Implementer | My tasks (mark done, request a new deadline or reassignment), Reports (documents), Announcements, Account |
| Partners / Donor / Supporter | Reports (documents), Announcements, Comments, Account |

This mirrors the role rules already enforced server-side in `Code.gs`
(`ROLE_OPTIONS`, `ROLES_REQUIRING_CONTACT_LINK`, `VIEW_SCOPED_ROLES`,
`COMMENTING_ROLES`) — the front end just hides what a role can't call;
the backend is still the actual authority, since every write action
re-checks `requireAuth()` itself.

## Notes

- Sessions are stored in `localStorage` (`fl_session`) and validated
  against `getSessionInfo` on load. Sessions expire server-side after
  12 hours (`SESSION_DURATION_HOURS`).
- Document uploads are read client-side and sent as base64 in the POST
  body — fine for typical PDFs, but very large files may be slow over
  Apps Script's request-size limits.
- PDF exports come back as base64 and are converted to a downloadable
  blob client-side.
- Nothing here uses `localStorage` for anything sensitive beyond the
  session token itself, same as any normal web app session.
