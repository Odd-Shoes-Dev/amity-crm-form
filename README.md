# Amity Realtors - Client Lead Form

A standalone client-facing form that lets clients submit their own lead
details directly into the Amity CRM, instead of staff manually entering
them. Plain HTML/CSS/JS, no build step, no dependencies.

## Files

| File               | Purpose                                                    |
|--------------------|-------------------------------------------------------------|
| `index.html`       | Form markup                                                |
| `style.css`        | Styling (black / red / white brand colors)                 |
| `script.js`        | Form logic: validation, bot protection, API calls          |
| `public/logo.png`  | Company logo shown in the header                           |
| `apidoc.html`      | Original CRM API documentation (reference only, not served)|

## How it works

On submit, the form sends a `POST` request with the client's details as
JSON to the CRM's `leads.php` endpoint (see `apidoc.html` for the full
API reference). No authentication is required by the API.

The form only asks the client for what's strictly needed to keep it
quick to fill in:

- Full Name (required)
- Phone Number (required)
- Reason / Interest (required)
- Additional Information (optional)

Fields the CRM API requires but that were deliberately left off the
form (to keep it short) are sent with fixed defaults instead of being
asked of the client:

- `source_type` is always sent as `"other"`.
- `gender` is always sent as `"Other"` rather than the API's own
  default of `"Male"`, so it reads as unset/unknown in the CRM instead
  of silently mislabeling clients. Staff can correct both fields later
  during follow-up if needed.

`address` is optional on the API side and is simply not collected or
sent at all.

Key behaviors:

- **Duplicate phone numbers**: as the client leaves the phone field, the
  form calls the CRM's `check_phone` endpoint and shows a note if that
  number is already on file. This is just an early UX hint — the CRM's
  create endpoint itself already de-dupes by phone (it returns
  `is_existing: true` instead of creating a second lead), so a client
  submitting twice will never create duplicate records. The success
  screen reflects this by showing a different message when
  `is_existing` comes back `true`.
- **Phone number format**: the CRM does not validate or reject
  non-Ugandan phone numbers, so the form does not restrict input either
  (the form is open to all).
- **Bot protection** (client-side only, no third-party service required):
  - A hidden honeypot field (`#website`) that real users never see;
    if it has a value on submit, the submission is silently dropped.
  - A time-trap: submissions made less than 3 seconds after the page
    loads are silently dropped (a real person can't fill the form that
    fast).
  
  Note: since the CRM API itself has no authentication, these
  protections stop generic/mass form-spam bots, but cannot stop a
  determined attacker who calls the API endpoint directly. Closing that
  gap fully would require a server-side check (e.g. Cloudflare Turnstile
  verified on the backend), which is out of scope for this standalone
  form.

## IMPORTANT: Hosting and the API URL

`script.js` currently points at a **relative** API path:

```js
const API_URL = '/api/leads.php';
```

This only works if this form is hosted **on the same domain as the CRM**
(e.g. as a subpath of `crm.amityug.com`). If that's the case, no further
changes are needed — same-origin requests are not subject to CORS, so
it will work as-is.

**If this form is instead hosted anywhere else** (a different domain,
a subdomain like `amityug.com`, Vercel, Netlify, etc.), two changes are
required:

1. Change `API_URL` in `script.js` to the full absolute URL:
   ```js
   const API_URL = 'https://crm.amityug.com/api/leads.php';
   ```
2. The CRM server must send back CORS headers allowing that origin,
   otherwise browsers will block the request. At minimum:
   ```
   Access-Control-Allow-Origin: https://<the-form's-domain>
   Access-Control-Allow-Methods: GET, POST
   Access-Control-Allow-Headers: Content-Type
   ```
   Without this, the form will load fine but every submission will fail
   with a network/CORS error in the browser console.

## Local testing

This is a static site — any static file server works. For example:

```bash
python -m http.server 8532
```

Then open `http://localhost:8532`. Note that local testing against the
live CRM API will hit the CORS issue described above unless the form is
served from a domain the CRM already allows.
