# Janji support

Janji is an app for people who run their own [Cal.diy](https://github.com/calcom/cal.diy) server. It manages
your bookings, event types and availability on that server, and can notify your phone about new, rescheduled
and cancelled bookings. Janji has no accounts of its own: you sign in to your server with an API key.

## Getting started

1. Your server needs **Cal API v2**, the service the app talks to. [Server setup](./server-setup.md) explains
   how to run it and how to check it.
2. In the app, enter your server's address, for example `book.example.com`.
3. Make an API key on your server (Settings, then Developer, then API keys) and paste it into the app. Choose
   **Never expires**: Cal.diy can't renew keys, so a key with an end date stops working on that day.

## Common problems

| What you see                             | What to do                                                                                                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Cal API v2 isn't available there"       | Cal API v2 isn't running, or isn't reachable at `/api/v2`. See [server setup](./server-setup.md). If it runs at another address, enter it under **Show advanced options** when signing in.                                               |
| "Your API key no longer works"           | The key expired or was deleted on the server. Sign in again with a new key.                                                                                                                                                              |
| "Too many requests"                      | Cal API v2 allows 120 requests a minute for each key. Wait a minute and try again.                                                                                                                                                       |
| No notifications                         | Each phone has its own: in Settings on this phone, check that **Booking notifications** is on and that the kinds of booking you want are chosen. If Settings says your phone's settings block them, allow notifications for Janji there. |
| Notifications stopped after reinstalling | Open Janji while online: as it starts, it reconnects the phone. If that doesn't help, turn **Booking notifications** off and on again in Settings.                                                                                       |
| Times look wrong                         | Booking times are shown in your phone's time zone, with a note when your profile's time zone differs. Your availability uses each schedule's own time zone.                                                                              |

## Removing your data

- **Sign out** in Settings. This removes the API key from your phone and turns off its notifications.
- **Delete the API key** on your server (Settings, then Developer, then API keys), so it can't be used again.
- Notifications can be turned off on their own in Settings; this deletes the phone from the notification
  relay and removes its webhook from your server.

[What Janji keeps, and where](./privacy.md) has the details.

## Questions and bug reports

Janji is open source. Report a problem or ask a question in the project's
[issues](https://github.com/hithereiamaliff/janji-app/issues). Please don't post API keys, server addresses
you'd rather keep private, or details of other people's bookings there.
