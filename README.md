# Advisory Booking Page — Setup Guide

Self-contained booking flow for **Rakshan Kamalakannan / RKK Studio**.

## Schedule
All days use **Monday slots: 15:00–17:00 IST** (15 or 30 min steps).

## UPI tracing
On payment the UPI note is:

```
BOOKING-{TxnId}-{Phone}-{Name}
```

Example payment notification in GPay/PhonePe:
`BOOKING-1713164829-9876543210-Rajesh — ₹500`

- **TxnId** = `Date.now()` (unique, match against bank alert)
- **Status** starts as `PENDING` until you confirm

## Notification payload (email / webhook)
```
New PENDING: Rajesh 9876543210 ₹500 TxnId 1713164829
email · 30 Mins · 2026-10-16 15:00 IST
UPI Note: BOOKING-1713164829-9876543210-Rajesh
```

## Manual workflow
1. User books → you get PENDING + TxnId + phone + name
2. User pays UPI → bank shows same `BOOKING-TxnId-Phone-Name`
3. Match TxnId → confirm
4. Optional: host `payment_status.json` with `{ "txnId": "...", "status": "PAID" }` so the page advances

## CONFIG (`booking.js`)
```js
vpa: "kkrakshan2006@okaxis",
payeeName: "RKK Studio",
prices: { 15: 500, 30: 1000 },
webhookUrl: "", // Make/Zapier for WhatsApp
notifyEmail: "kkrakshan2006@gmail.com",
schedule: { /* all days = Mon 15:00–17:00 */ }
```

## Files
- `index.html` — UI
- `booking.js` — logic (slots, UPI note, PENDING)
- `vercel.json` — static host
- `payment_status.example.json` — sample confirm file
