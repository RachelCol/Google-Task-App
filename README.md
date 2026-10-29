# Task Board

A Trello-style board for Google Tasks: lists as columns, priorities, a calendar, and drag and drop. It runs as a plain static site on GitHub Pages and works as a home-screen app on a phone.

- Tasks, lists, due dates, check-offs and order live in Google Tasks.
- Priority is stored as a `[P1]`, `[P2]` or `[P3]` tag at the start of a task's notes.
- List colors, card styles and folded weeks are kept in a small file in the app's private Google Drive folder (`drive.appdata`), so they follow you between devices.
- Tasks added from Gmail keep their "Open email" link.

## Setup

1. In Google Cloud, enable the Google Tasks API and the Google Drive API, and create an OAuth **Web application** client with
   - Authorized JavaScript origin: `https://rachelcol.github.io`
   - Authorized redirect URI: `https://rachelcol.github.io/Google-Task-App/`
2. Put the Client ID in `CLIENT_ID` at the top of `app.js`.
3. Turn on GitHub Pages (Settings > Pages > Deploy from a branch > `main` / root).

Sign-in uses Google's redirect flow with a short-lived token, so there is no server and no client secret.
