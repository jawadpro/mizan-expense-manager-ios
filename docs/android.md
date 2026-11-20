# Android phones

An Android phone sends bank alerts to Mizan the way an iPhone does: it pairs with a one-time code from a QR code and
gets its own key. Android can forward SMS in the background without any automation to switch on, so there's no
Shortcut: a free SMS forwarder app (or the Mizan Companion app) does the sending.

## Connecting

1. In Mizan, open **Connect phone** and pick **Android**. Mizan shows a QR code (on the phone itself, a
   **Connect this phone** button instead).
2. Scan it with the phone's camera. It opens `/pair/android#<code>` on the phone. The code is in the `#fragment`, so
   it's never sent to a server or logged.
3. Tap **Get my key**. The page calls `POST /api/devices/pair` with the code and gets this phone's key, which it shows
   but never stores.
4. Install [SMS to URL Forwarder](https://f-droid.org/packages/tech.bogomolov.incomingsmsgateway/) (F-Droid or
   [GitHub](https://github.com/bogkonstantin/android_income_sms_gateway_webhook/releases); Google Play doesn't allow SMS
   forwarders). Add a rule: sender `*`, the **Webhook URL** and the **JSON template** from the page, and
   **Store failed messages for retry** on.
5. Tap **Send a test**. Mizan reads a sample alert, saves nothing, and from then on lists the phone as connected.

Like an iPhone, a phone only counts as connected once it has used its key. Removing it in **Connect phone** stops the
key at once; **Reconnect** gives it a new one.

## What the phone sends

`POST /api/sms` with `Content-Type: application/json`:

```json
{"key": "mzd_…", "sender": "%from%", "text": "%text%", "receivedAt": %receivedStamp%}
```

- `key` is this phone's key. SMS to URL Forwarder has no place for headers, so Mizan accepts a paired device's key in
  the body when there's no `Authorization` header. Apps that can set headers send `Authorization: Bearer mzd_…`
  instead and leave `key` out.
- `receivedAt` may be ISO 8601 with a time zone (as the iPhone sends it), Unix time in seconds or milliseconds, or left
  out (then it's the time Mizan received it).
- Responses and duplicate handling are the same as for iPhones: sending an alert twice is safe.

## Mizan Companion app

A native app can do the same with no forwarder: scan the QR code (the address is everything before `/pair`, the code
follows `#`), call `POST {address}/api/devices/pair` with `{"code", "name"}`, keep `authorization`, send alerts to
`endpoint`. The same key also reads the widget endpoints (`/api/widgets/monthly`).
