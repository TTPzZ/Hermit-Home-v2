# Password Reset Setup

The project already supports the password reset flow:

```text
User taps "Forgot password"
  -> Vercel API creates a reset token in MongoDB
  -> Vercel API sends an email through SMTP
  -> User taps the email link
  -> Vercel API validates the token
  -> Browser redirects into the Flutter app
  -> User enters and confirms a new password
  -> Vercel API updates the password hash in MongoDB
```

## Required Vercel Environment Variables

```env
PASSWORD_RESET_URL=https://<your-vercel-domain>/reset-password
PASSWORD_RESET_APP_DEEP_LINK_URL=hermithome://reset-password
PASSWORD_RESET_TOKEN_TTL_MINUTES=30

SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-username>
SMTP_PASS=<smtp-password-or-app-password>
SMTP_FROM="Hermit Home <verified-sender-email>"
```

`PASSWORD_RESET_URL` must be the HTTPS Vercel route, not the app deep link. The Vercel route checks token status first, then redirects to `PASSWORD_RESET_APP_DEEP_LINK_URL`.

## SMTP Provider Examples

Gmail app password:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=<google-app-password>
SMTP_FROM="Hermit Home <your_email@gmail.com>"
```

SendGrid:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
SMTP_FROM="Hermit Home <verified-sender-email>"
```

Brevo:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<brevo-smtp-login>
SMTP_PASS=<brevo-smtp-key>
SMTP_FROM="Hermit Home <verified-sender-email>"
```

## Flutter Deep Link

The mobile app already declares the `hermithome://reset-password` scheme:

- Android: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- iOS: `apps/mobile/ios/Runner/Info.plist`

No extra Flutter package is required for the current custom-scheme flow.
