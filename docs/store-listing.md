# Store listings

Text for the App Store and Google Play listings, the notes for app review, and suggested answers for the
stores' privacy forms. The privacy answers are suggestions for you, as the developer of record, to check
against what [`privacy.md`](./privacy.md) says and what you run.

Store text says Janji works with self-hosted Cal.diy servers but keeps "Cal" out of the app's name, and says
that Janji is independent.

## App Store

| Field                  | Text                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name (30)              | Janji                                                                                                                                                    |
| Subtitle (30)          | Bookings on your own server                                                                                                                              |
| Promotional text (170) | Manage the bookings, event types and availability on your self-hosted Cal.diy server, and get a notification when someone books, reschedules or cancels. |
| Keywords (100)         | booking,scheduling,appointments,calendar,self-hosted,availability,event types,open source,meetings                                                       |
| Category               | Productivity (secondary: Business)                                                                                                                       |
| Age rating             | 4+                                                                                                                                                       |
| Support URL            | `https://github.com/hithereiamaliff/janji-app/blob/main/docs/support.md`                                                                                 |
| Privacy policy URL     | `https://github.com/hithereiamaliff/janji-app/blob/main/docs/privacy.md`                                                                                 |

### Description

> Janji is the phone app for your self-hosted Cal.diy server. Sign in to your own server with an API key and
> manage your scheduling on the go.
>
> Bookings: see upcoming, unconfirmed, past and cancelled bookings, search them, and open one for its time,
> attendees, location and answers. Confirm or decline requests, cancel, reschedule to a free time, mark
> no-shows and add guests.
>
> Event types: copy or share booking links, hide and show event types, edit their basics, choose their
> schedule and make private links.
>
> Availability: edit your schedules' weekly hours, time zones and date overrides, make new schedules and
> choose your default.
>
> Notifications: get a notification when someone books, asks you to confirm, reschedules or cancels, and
> choose which of these you want.
>
> Janji needs a Cal.diy server with Cal API v2 running. It has no accounts of its own and keeps your API key
> in the phone's secure storage.
>
> Janji is open source under the MIT licence. It is an independent project, not made by or affiliated with
> Cal.com, Inc.

### Notes for App Review

> Janji has no accounts of its own: it signs in to a self-hosted Cal.diy scheduling server with an API key
> made on that server. We've set up a demo server for you; its address and API key are in the sign-in
> information fields.
>
> 1. On the first screen, enter the server address, then tap Continue.
> 2. Paste the API key and tap Sign in.
> 3. The demo account has upcoming bookings, event types and schedules to try.
> 4. To see a notification, turn on Booking notifications in Settings, then book a time on the demo booking
>    page: `<demo booking page>`.

Fill in the demo server's address and a key that never expires in App Store Connect's sign-in fields, never
in this repository.

### App Privacy (suggested)

- **Tracking:** no. Janji has no analytics or advertising, and nothing is linked across apps or websites.
- **Data collected:** **Identifiers, Device ID.** The relay keeps the phone's push token while notifications
  are on, to send them. Use: App Functionality. Not linked to the person's identity: the relay knows no names,
  emails or accounts. Not used for tracking.
- **Not collected by the developer:** what the app reads from the person's own server (bookings, profile,
  schedules), which only goes between the phone and that server, and the booking details in notifications,
  which pass through the relay without being kept.

## Google Play

| Field                  | Text                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| App name (30)          | Janji                                                                         |
| Short description (80) | Your self-hosted Cal.diy bookings, schedules and notifications on your phone. |
| Category               | Productivity                                                                  |
| Contact website        | `https://github.com/hithereiamaliff/janji-app/blob/main/docs/support.md`      |
| Privacy policy         | `https://github.com/hithereiamaliff/janji-app/blob/main/docs/privacy.md`      |

The full description is the App Store's.

### Data safety (suggested)

- **Data collected:** Device or other IDs (the push token).
  - Collected, not shared: Expo and Google deliver the notifications as service providers.
  - Not processed ephemerally: kept while notifications are on.
  - Optional: only when the person turns notifications on.
  - Purpose: App functionality.
- **Encrypted in transit:** yes.
- **Deletion:** turning notifications off, or signing out, deletes the phone from the relay.
- **Not declared:** data that only goes between the app and the person's own server, and booking details
  the relay passes on without keeping. Check this reading of Google's definitions before submitting.

## Before you submit

- A demo account on a Cal.diy server, with event types and bookings, and an API key that never expires.
- The repository made public, since the support and privacy links point to it.
- For Google Play with a personal developer account made after November 2023: a closed test with at least
  12 testers for 14 days in a row before production.
