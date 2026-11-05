# Privacy

Janji is an app for your own Cal.diy server. It has no accounts of its own, no analytics and no ads, and it
doesn't sell or share anything about you. This page says what it keeps, where, and for how long.

> Draft, to be reviewed before Janji is published.

## On your phone

- **Your server's address and your API key.** The key is kept only in the phone's secure storage (Keychain on
  iOS, Keystore on Android) and is sent only to your server, to use Cal API v2 for you.
- **What your server shows the app**, such as bookings, event types, schedules and your profile, kept in
  memory while you use it.

Signing out removes the key and your server's details from the phone.

## On your Cal.diy server

Everything Janji changes, it changes on your own server, through the same API the web app's settings use. Turning
notifications on adds one webhook to your account on the server, for that phone; turning them off or signing out
removes it.

## Push notifications

Notifications go through a small relay, a service that runs on Cloudflare. You can run your own; see
`apps/relay/README.md`. For each phone with notifications on, the relay keeps:

- the phone's **Expo push token**, its platform (iOS or Android) and language;
- a **hash** of a token the app proves it owns the phone with, and the **secret** your server signs that phone's
  webhooks with, encrypted;
- for up to a day, Expo's **ticket IDs** for the notifications it sent, to learn whether each reached the phone.

When your server sends the relay a webhook about a booking, the relay checks its signature, writes the
notification and sends it. It doesn't keep or log the booking: the webhook is gone once the notification is sent.

The notification itself, with the event's name, its start time and the first attendee's name, passes through
**Expo's push service** and **Apple Push Notification service or Firebase Cloud Messaging** on its way to your
phone, as all push notifications do.

Turning notifications off, or signing out, deletes the phone from the relay. So does uninstalling the app, once
Apple or Google tell Expo the phone can't get notifications any more.

## Questions

Janji is open source, so you can check all of this in its code. Questions about privacy go to the address on
the support page.
