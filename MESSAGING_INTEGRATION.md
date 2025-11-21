# Messaging Integration Guide

This guide explains how to implement messaging integrations for SMS, WhatsApp, and Email in the POS system.

## Overview

The system currently **queues** messages in the `notification_messages` table but doesn't actually send them. This guide shows you how to implement the actual sending functionality.

## Architecture

```
Frontend → API Endpoint → queueNotificationMessage() → notification_messages table
                                                              ↓
                                                    Message Processor Worker
                                                              ↓
                                                    Messaging Service
                                                              ↓
                                                    External Providers (Twilio, SendGrid, etc.)
```

## Step 1: Install Required Dependencies

```bash
cd backend
npm install twilio @sendgrid/mail nodemailer
```

## Step 2: Configure Environment Variables

Add these to your `backend/.env` file:

```env
# SMS Provider: 'twilio' | 'custom'
SMS_PROVIDER=twilio

# WhatsApp Provider: 'twilio' | 'custom'
WHATSAPP_PROVIDER=twilio

# Email Provider: 'sendgrid' | 'nodemailer' | 'custom'
EMAIL_PROVIDER=sendgrid

# Twilio Configuration (for SMS and WhatsApp)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# Email Configuration
EMAIL_FROM_ADDRESS=noreply@yourcompany.com
EMAIL_FROM_NAME=Your Company Name

# SendGrid Configuration (for email)
SENDGRID_API_KEY=your_sendgrid_api_key

# OR SMTP Configuration (alternative to SendGrid)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_SECURE=false
```

## Step 3: Set Up Providers

### Twilio (SMS & WhatsApp)

1. Sign up at [Twilio](https://www.twilio.com/)
2. Get your Account SID and Auth Token from the dashboard
3. Purchase a phone number for SMS
4. Enable WhatsApp Sandbox or get WhatsApp Business API access
5. Add credentials to `.env`

### SendGrid (Email)

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create an API key with "Mail Send" permissions
3. Verify your sender email address
4. Add API key to `.env`

### Nodemailer (Email Alternative)

1. Use any SMTP server (Gmail, Outlook, custom, etc.)
2. For Gmail, create an [App Password](https://support.google.com/accounts/answer/185833)
3. Add SMTP credentials to `.env`

## Step 4: Run the Message Processor

The message processor is a worker that continuously processes pending messages from the queue.

### Option 1: Run as Standalone Script

```bash
# Process messages once
node backend/scripts/process-messages.js

# Run continuously (watch mode)
node backend/scripts/process-messages.js --watch
```

### Option 2: Use PM2 (Recommended for Production)

```bash
npm install -g pm2

# Start the message processor
pm2 start backend/scripts/process-messages.js --name message-processor -- --watch

# View logs
pm2 logs message-processor

# Stop
pm2 stop message-processor
```

### Option 3: Use Cron (Linux/Mac)

Add to crontab to run every minute:

```bash
* * * * * cd /path/to/backend && node scripts/process-messages.js
```

### Option 4: Integrate into Main Server

You can also start the processor alongside your main server in `server.js`:

```javascript
// At the end of server.js
if (process.env.ENABLE_MESSAGE_PROCESSOR === 'true') {
  import('./workers/message-processor.js').then(({ startMessageProcessor }) => {
    startMessageProcessor();
  });
}
```

## Step 5: Test the Integration

1. **Test SMS:**
   - Go to CRM → Customers → Select a customer
   - Choose "SMS" channel
   - Send a test message
   - Check Twilio dashboard for delivery status

2. **Test WhatsApp:**
   - Choose "WhatsApp" channel
   - Send a test message
   - Check Twilio dashboard

3. **Test Email:**
   - Choose "Email" channel
   - Send a test message
   - Check recipient inbox and SendGrid dashboard

## Monitoring

### Check Message Status

Query the database to see message status:

```sql
SELECT id, channel, recipient, status, error, sent_at, created_at
FROM notification_messages
ORDER BY created_at DESC
LIMIT 50;
```

### Status Values

- `pending`: Message is queued, waiting to be sent
- `sent`: Message was successfully sent
- `failed`: Message failed after max retries

## Custom Providers

To implement a custom provider:

1. Edit `backend/src/services/messaging.js`
2. Implement the custom function (e.g., `sendSMSViaCustom`)
3. Update the switch statement to use your custom provider
4. Set the provider environment variable to `'custom'`

## Error Handling

- Messages that fail are retried up to 3 times
- After max retries, status is set to `failed`
- Error details are stored in the `error` column (JSON format)
- Failed messages can be manually retried by updating status back to `pending`

## Rate Limiting

The processor includes a 500ms delay between messages to avoid overwhelming providers. Adjust `BATCH_SIZE` and delays in `message-processor.js` based on your provider's rate limits.

## Security Notes

- Never commit `.env` files to version control
- Use environment variables for all sensitive credentials
- Rotate API keys regularly
- Monitor usage to detect unauthorized access

## Troubleshooting

### Messages not sending

1. Check provider credentials in `.env`
2. Verify the message processor is running
3. Check message status in database
4. Review error messages in `notification_messages.error` column
5. Check provider dashboard for delivery issues

### Twilio errors

- Verify phone numbers are in E.164 format (+1234567890)
- Check Twilio account balance
- Verify phone number is verified (for trial accounts)

### Email not sending

- Verify sender email is verified in SendGrid
- Check SMTP credentials are correct
- Check spam folder
- Verify DNS/SPF records for custom domains

## Next Steps

1. Set up monitoring/alerting for failed messages
2. Implement webhooks for delivery status updates
3. Add message templates for common scenarios
4. Implement message scheduling
5. Add analytics/dashboard for message metrics

