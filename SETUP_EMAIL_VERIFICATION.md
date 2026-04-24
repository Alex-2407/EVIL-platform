# Email Verification System Setup Guide

## Overview

The EVIL Platform now includes a complete email-based verification system that requires users to confirm their email address before they can fully access the platform.

## How It Works

1. **User Registration**: User submits registration form with name, email, password
2. **Code Generation**: Server generates a 6-digit verification code
3. **Email Sent**: Email with code is sent to user's registered email address
4. **Code Entry**: User enters code on `/html/verify-email.html` page
5. **Verification**: Code is validated, user account is marked as verified
6. **Access Granted**: User can now login and access the platform

## Configuration

### Step 1: Choose an Email Provider

You have several options for sending emails:

#### Option A: Mailtrap (Recommended for Testing)

**Best for**: Development, testing, free tier available

1. Sign up at [https://mailtrap.io](https://mailtrap.io)
2. Create a new inbox
3. Go to **Settings** > **Integrations** > **Nodemailer**
4. Copy your credentials

```
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_mailtrap_user_id
SMTP_PASS=your_mailtrap_password
SMTP_SECURE=false
SMTP_FROM_EMAIL=noreply@evil-platform.com
```

#### Option B: Gmail

**Best for**: Personal use with existing Gmail account

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password at [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Use the 16-character app password (not your Gmail password)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your_16_char_app_password
SMTP_SECURE=true
SMTP_FROM_EMAIL=your-email@gmail.com
```

#### Option C: SendGrid

**Best for**: Production, free tier with 100 emails/day

1. Sign up at [https://sendgrid.com](https://sendgrid.com)
2. Create an API key in **Settings** > **API Keys**
3. Copy the full API key

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
SMTP_SECURE=false
SMTP_FROM_EMAIL=your-email@sendgrid.com
```

#### Option D: Any SMTP Server

Use credentials from your SMTP provider:

```
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your_username
SMTP_PASS=your_password
SMTP_SECURE=false
SMTP_FROM_EMAIL=noreply@your-domain.com
```

### Step 2: Update .env File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update email configuration variables in your `.env` file:
   ```
   SMTP_HOST=smtp.mailtrap.io
   SMTP_PORT=587
   SMTP_USER=your_username
   SMTP_PASS=your_password
   SMTP_FROM_EMAIL=noreply@evil-platform.com
   SMTP_SECURE=false
   BASE_URL=http://localhost:5000
   ```

### Step 3: Install Dependencies

If you haven't already, install the required packages:

```bash
npm install
```

This installs `nodemailer` which is required for email functionality.

## API Endpoints

### Register User

**Endpoint**: `POST /api/auth/register`

**Request**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!"
}
```

**Success Response (201)**:
```json
{
  "status": "success",
  "message": "Registrazione iniziata. Controlla la tua email per il codice di verifica.",
  "requiresVerification": true,
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com"
}
```

User is redirected to `verify-email.html?userId=...&email=...`

### Verify Email Code

**Endpoint**: `POST /api/auth/verify-email-code`

**Request**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "code": "123456"
}
```

**Success Response (200)**:
```json
{
  "status": "success",
  "message": "Email verificata con successo",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": true
  }
}
```

User is redirected to `home.html` and logged in.

### Resend Verification Code

**Endpoint**: `POST /api/auth/resend-verification-code`

**Request**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response (200)**:
```json
{
  "status": "success",
  "message": "Codice reinviato alla tua email"
}
```

## Email Templates

### Verification Code Email

The email includes:
- EVIL Platform branding
- User's name
- 6-digit verification code (large, prominent)
- Note that code expires in 10 minutes
- Professional HTML template with dark theme styling

**Code Expiry**: 10 minutes from generation

## Frontend Pages

### Registration (`html/account.html`)

- User enters: name, email, password, confirm password
- On success: redirects to verification page
- Displays success message: "✅ Registrazione completata! Verifica il codice inviato alla tua email."

### Email Verification (`html/verify-email.html`)

- Displays registered email address
- User enters 6-digit code received via email
- Shows "Verifica Email" (Verify Email) heading
- Includes:
  - 6-digit code input field
  - "Verifica Email" (Verify) button
  - "Non hai ricevuto il codice?" (Didn't receive the code?) section
  - "Reinvia codice" (Resend code) button with 60-second cooldown
  - Info section about email security benefits

**Features**:
- Auto-populates code and email from URL parameters
- 60-second cooldown before resend button is enabled
- Clear error messages for invalid/expired codes
- Success message on verification
- Automatic redirect to home.html on success

## Testing

### Test with Mailtrap

1. Open Mailtrap dashboard
2. Create test email address if needed
3. Register with that test email
4. Check Mailtrap inbox for verification email
5. Copy 6-digit code from email
6. Enter code on verify-email.html
7. You should be logged in

### Test with Gmail

1. Create a test Gmail account or use existing
2. Generate app password
3. Configure SMTP with Gmail credentials
4. Register with test Gmail address
5. Check Gmail inbox for verification email
6. Copy code and enter on verification page

## Troubleshooting

### Email Not Arriving

1. **Check Spam Folder**: Sometimes emails end up in spam
2. **Verify SMTP Credentials**: Test credentials in Mailtrap or your provider
3. **Check Server Logs**: Look for error messages in console
4. **Provider Restrictions**: Some providers may block emails from new accounts

### Code Expired

- Codes expire after 10 minutes
- Use "Resend code" button to get a new code
- 60-second cooldown between resend attempts

### Invalid Code

- Make sure you copied the full 6-digit code
- No spaces or extra characters
- Code is case-sensitive (but only contains digits)

### Database Errors

Ensure `users.json` has proper permissions and exists in the project root.

## Production Deployment

For production use:

1. **Use a Reliable Service**: SendGrid, AWS SES, or similar
2. **Set Secure Variables**: Store SMTP credentials in environment secrets
3. **Enable SMTP_SECURE=true**: Use TLS/SSL encryption for port 465
4. **Monitor Email Delivery**: Track bounces and failures
5. **Update BASE_URL**: Set to your production domain
6. **Use Custom Domain**: Set SMTP_FROM_EMAIL to your domain

### Render.com / Heroku Example

Add config variables in your deployment:

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_SECURE=false
BASE_URL=https://your-app.render.com
```

## Security Notes

- Verification codes are hashed with SHA-256 before storage
- Codes expire after 10 minutes
- Only the code hash is stored, never the plain code
- Codes are generated with crypto.randomInt() for security
- SMTP passwords should never be logged
- Always use HTTPS in production

## Architecture

```
Registration Flow:
┌─────────────┐
│   account.html    │  User submits registration
└────────┬──────────┘
         │
         ▼
┌──────────────────────────┐
│ /api/auth/register       │  Create user, generate code
└────────┬─────────────────┘
         │
         ├─► Generate 6-digit code
         ├─► Hash code (SHA-256)
         ├─► Store in user.verificationCodeHash
         ├─► Set 10-min expiry
         └─► Send email via nodemailer
         │
         ▼
┌─────────────────┐
│ verify-email.html  │  User enters code
└────────┬────────────┘
         │
         ▼
┌──────────────────────────┐
│ /api/auth/verify-email-code  │  Validate code
└────────┬─────────────────┘
         │
         ├─► Compare code hash
         ├─► Check expiry
         ├─► Set emailVerified=true
         └─► Generate JWT tokens
         │
         ▼
┌──────────────────┐
│ home.html        │  User logged in ✓
└──────────────────┘
```

## Support

For issues or questions about email verification:
1. Check the logs in your terminal
2. Verify SMTP credentials in .env
3. Test with Mailtrap first (free, reliable)
4. Check your email provider's documentation
