# Advisory Booking Page — Setup Guide

Self-contained booking flow for **Rakshan Kamalakannan / RKK Studio**.

## What this page does

| Step | Behaviour |
|------|-----------|
| 1. Duration | 15 min (₹500) or 30 min (₹1,000) — editable in `CONFIG` |
| 2. Schedule | FullCalendar + day-of-week windows (IST). Soft lock via localStorage |
| 3. Details | Name, email, phone with validation |
| 4. UPI | Dynamic UPI deep link + QR. Status = **pending / unverified** only |
| 5. Notify you | Optional webhook (Make/Zapier) + FormSubmit email notify |
| 6. Confirm | **Manual**: you check UPI, then mark verified |

Payment is **never** auto-confirmed. No client-side file download.

## 1. Edit CONFIG (in `booking.js`)

```js
vpa: "kkrakshan2006@okaxis",
payeeName: "RKK Studio",
prices: { 15: 500, 30: 1000 },
webhookUrl: "", // Make/Zapier webhook
defaultMeetLink: "https://meet.google.com/...",
schedule: { /* 0=Sun .. 6=Sat windows in minutes */ }
```

## 2. WhatsApp notify (Make.com)

1. Webhooks → Custom webhook → paste URL into `webhookUrl`
2. Map: name, email, phone, duration, date, time, amount, id
3. Message must say **Payment: UNVERIFIED**

## 3. Manual verification

Check UPI app → send client Meet link → optional `payment_status.json`:

```json
{ "id": "RKK-XXXX", "status": "verified" }
```

## Files

- `index.html` — booking UI
- `booking.js` — app logic (no auto file download)
- `vercel.json` — static config
- `payment_status.example.json` — sample verification file
