# Pricing & quotation rules
- Quotation integrations (follow-ups, expiry, CRM/booking linking, templates, analytics, PDF model) are pure helpers in src/lib/pricing/phase5.ts; PDFs render in the browser (src/lib/pricing/quote-pdf.ts) only from saved non-draft versions — never from current rates.
- Quotes auto-link to leads only via a verified account id; email matches are staff-reviewed suggestions. Bookings link to a quote only for its owner (verified user or the quote's contact email).
- Quote expiry is reconciled daily by pg_cron job branta-quote-expiry → private.reconcile_quote_expiry() and re-checked on every customer read/response; answered quotes never expire.
