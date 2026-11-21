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
> 1. On the first screen, tap Get started, enter the server address, then tap Continue.
> 2. Paste the API key and tap Sign in.
> 3. The demo account has upcoming and unconfirmed bookings, event types and schedules to try.
> 4. To see a notification, turn on Booking notifications in Settings and allow notifications, then book a
>    time on the demo booking page: `<demo booking page>`.

Fill in the demo server's address and a key that never expires in App Store Connect's sign-in fields, never
in this repository.

### App Privacy (suggested)

The Expo Update answers follow Expo's
[store privacy declarations](https://docs.expo.dev/eas-update/store-privacy-declarations/) guide.

- **Tracking:** no. Janji has no advertising, and nothing is linked across apps or websites.
- **Identifiers, Device ID:**
  - the phone's push token, which the relay keeps while notifications are on, to send them;
  - Expo Update's random install ID, which Expo keeps with each update check.
  - Use: App Functionality and Analytics (Expo counts installs per update).
  - Not linked to the person's identity: neither the relay nor Expo knows names, emails or accounts.
  - Not used for tracking.
- **Diagnostics, Crash Data:** when an update fails to start, Expo Update gets the failed update IDs and the
  error text. Use: App Functionality. Not linked to the person's identity. Not used for tracking.
- **Not collected by the developer:**
  - what the app reads from the person's own server (bookings, profile, schedules), which only goes between
    the phone and that server;
  - the booking details in notifications, which pass through the relay without being kept.

## Google Play

| Field                  | Text                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| App name (30)          | Janji                                                                         |
| Short description (80) | Your self-hosted Cal.diy bookings, schedules and notifications on your phone. |
| Category               | Productivity                                                                  |
| Contact email          | `hello@techmavie.digital`                                                     |
| Contact website        | `https://github.com/hithereiamaliff/janji-app/blob/main/docs/support.md`      |
| Privacy policy         | `https://github.com/hithereiamaliff/janji-app/blob/main/docs/privacy.md`      |

The full description is the App Store's.

### Data safety (suggested)

These answers also follow Expo's guide.

- **Device or other IDs:** the push token, and Expo Update's install ID.
  - Collected, not shared: Expo and Google act as service providers.
  - Not processed ephemerally: the relay keeps the token while notifications are on, and Expo keeps the
    install ID with each update check.
  - Required: the install ID goes with every update check, even though the push token is optional.
  - Purposes: App functionality and Analytics.
- **App info and performance, Crash logs:** the failed update IDs and error text that Expo Update gets when
  an update fails to start. Collected, not shared, not ephemeral, required. Purpose: Analytics.
- **Encrypted in transit:** yes.
- **Deletion:** turning notifications off, or signing out, deletes the phone from the relay. Other requests
  go to the contact on the support page.
- **Not declared:** data that only goes between the app and the person's own server, and booking details
  the relay passes on without keeping. Check this reading of Google's definitions before submitting.

## Before you submit

- A demo account on a Cal.diy server, with event types and bookings, and an API key that never expires.
- The repository made public, since the support and privacy links point to it.
- [`privacy.md`](./privacy.md) reviewed, and its draft note removed.
- Screenshots for iPhone with Dynamic Island, medium display (6.3-inch, which App Store Connect requires), iPad
  13-inch (Janji supports iPad) and Android phone. 6.9-inch iPhone screenshots are optional.
- For Google Play with a personal developer account made after November 2023: a closed test with at least
  12 testers for 14 days in a row before production.
