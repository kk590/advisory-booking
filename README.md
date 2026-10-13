# Advisory Booking Page — Setup Guide

Self-contained booking flow for **Rakshan Kamalakannan / RKK Studio**.

## What this page does

| Step | Behaviour |
|------|-----------|
| 1. Duration | 15 min (₹500) or 30 min (₹1,000) — editable in `CONFIG` |
| 2. Schedule | FullCalendar + day-of-week windows (IST). Soft lock via localStorage |
| 3. Details | Name, email, phone with validation |
| 4. UPI | Dynamic UPI deep link + QR. Status = **pending / unverified** only |
| 5. Notify you | Optional webhook (Make/Zapier) + downloads `pending_booking_*.txt` |
| 6. Confirm | **Manual**: you check UPI, then mark verified (see below) |

Payment is **never** auto-confirmed. The UI only shows “confirmed” after you verify.

Production pricing only (test mode removed).

## 1. Edit CONFIG (top of `<script>` in `index.html`)

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
2. Send WhatsApp / email with: name, email, phone, duration, date, time, amount, id
3. Message must say **Payment: UNVERIFIED**

## 3. Manual verification

Check UPI app → email client Meet link → optional `payment_status.json`:

```json
{ "id": "RKK-XXXX", "status": "verified" }
```

## Files

- `index.html` — booking UI
- `vercel.json` — static config
- `payment_status.example.json` — sample verification file
