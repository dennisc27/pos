/**
 * Messaging Service
 * 
 * This service handles sending messages via different channels (SMS, WhatsApp, Email).
 * It integrates with external providers like Twilio, SendGrid, etc.
 */

import dotenv from 'dotenv';
dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const SMS_PROVIDER = process.env.SMS_PROVIDER || 'twilio'; // 'twilio' | 'custom'
const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'twilio'; // 'twilio' | 'custom'
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'sendgrid'; // 'sendgrid' | 'nodemailer' | 'custom'

// Twilio Configuration (for SMS and WhatsApp)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER; // Format: whatsapp:+1234567890

// Email Configuration
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourcompany.com';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Your Company';

// SendGrid Configuration
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// Nodemailer Configuration (alternative to SendGrid)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

// ============================================================================
// SMS Implementation
// ============================================================================

/**
 * Send SMS via Twilio
 */
async function sendSMSViaTwilio(recipient, message) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio credentials not configured');
  }

  // Dynamic import to avoid loading if not needed
  const twilio = await import('twilio');
  const client = twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  // Normalize phone number (remove spaces, ensure + prefix for international)
  const normalizedPhone = normalizePhoneNumber(recipient);

  const result = await client.messages.create({
    body: message,
    from: TWILIO_PHONE_NUMBER,
    to: normalizedPhone,
  });

  return {
    provider: 'twilio',
    messageId: result.sid,
    status: result.status,
    recipient: normalizedPhone,
  };
}

/**
 * Send SMS via custom provider
 * Implement your custom SMS provider here
 */
async function sendSMSViaCustom(recipient, message) {
  // TODO: Implement your custom SMS provider
  // Example: HTTP API call to your SMS gateway
  throw new Error('Custom SMS provider not implemented');
}

/**
 * Send SMS message
 */
export async function sendSMS(recipient, message) {
  try {
    switch (SMS_PROVIDER) {
      case 'twilio':
        return await sendSMSViaTwilio(recipient, message);
      case 'custom':
        return await sendSMSViaCustom(recipient, message);
      default:
        throw new Error(`Unknown SMS provider: ${SMS_PROVIDER}`);
    }
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
}

// ============================================================================
// WhatsApp Implementation
// ============================================================================

/**
 * Send WhatsApp message via Twilio
 */
async function sendWhatsAppViaTwilio(recipient, message) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    throw new Error('Twilio WhatsApp credentials not configured');
  }

  const twilio = await import('twilio');
  const client = twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  // Normalize phone number and ensure whatsapp: prefix
  const normalizedPhone = normalizePhoneNumber(recipient);
  const whatsappRecipient = normalizedPhone.startsWith('whatsapp:')
    ? normalizedPhone
    : `whatsapp:${normalizedPhone}`;

  const result = await client.messages.create({
    body: message,
    from: TWILIO_WHATSAPP_NUMBER,
    to: whatsappRecipient,
  });

  return {
    provider: 'twilio',
    messageId: result.sid,
    status: result.status,
    recipient: whatsappRecipient,
  };
}

/**
 * Send WhatsApp via custom provider
 */
async function sendWhatsAppViaCustom(recipient, message) {
  // TODO: Implement your custom WhatsApp provider
  // Example: WhatsApp Business API, Twilio, etc.
  throw new Error('Custom WhatsApp provider not implemented');
}

/**
 * Send WhatsApp message
 */
export async function sendWhatsApp(recipient, message) {
  try {
    switch (WHATSAPP_PROVIDER) {
      case 'twilio':
        return await sendWhatsAppViaTwilio(recipient, message);
      case 'custom':
        return await sendWhatsAppViaCustom(recipient, message);
      default:
        throw new Error(`Unknown WhatsApp provider: ${WHATSAPP_PROVIDER}`);
    }
  } catch (error) {
    console.error('Failed to send WhatsApp:', error);
    throw error;
  }
}

// ============================================================================
// Email Implementation
// ============================================================================

/**
 * Send email via SendGrid
 */
async function sendEmailViaSendGrid(recipient, subject, message) {
  if (!SENDGRID_API_KEY) {
    throw new Error('SendGrid API key not configured');
  }

  const sgMail = await import('@sendgrid/mail');
  sgMail.default.setApiKey(SENDGRID_API_KEY);

  const msg = {
    to: recipient,
    from: {
      email: EMAIL_FROM_ADDRESS,
      name: EMAIL_FROM_NAME,
    },
    subject: subject || 'Notification',
    text: message,
    html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
  };

  const [response] = await sgMail.default.send(msg);

  return {
    provider: 'sendgrid',
    messageId: response.headers['x-message-id'],
    status: 'sent',
    recipient,
  };
}

/**
 * Send email via Nodemailer (SMTP)
 */
async function sendEmailViaNodemailer(recipient, subject, message) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error('SMTP credentials not configured');
  }

  const nodemailer = await import('nodemailer');

  const transporter = nodemailer.default.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM_ADDRESS}>`,
    to: recipient,
    subject: subject || 'Notification',
    text: message,
    html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
  });

  return {
    provider: 'nodemailer',
    messageId: info.messageId,
    status: 'sent',
    recipient,
  };
}

/**
 * Send email via custom provider
 */
async function sendEmailViaCustom(recipient, subject, message) {
  // TODO: Implement your custom email provider
  throw new Error('Custom email provider not implemented');
}

/**
 * Send email message
 */
export async function sendEmail(recipient, message, subject = null) {
  try {
    switch (EMAIL_PROVIDER) {
      case 'sendgrid':
        return await sendEmailViaSendGrid(recipient, subject, message);
      case 'nodemailer':
        return await sendEmailViaNodemailer(recipient, subject, message);
      case 'custom':
        return await sendEmailViaCustom(recipient, subject, message);
      default:
        throw new Error(`Unknown email provider: ${EMAIL_PROVIDER}`);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

// ============================================================================
// Unified Send Function
// ============================================================================

/**
 * Send message via specified channel
 * @param {string} channel - 'sms' | 'whatsapp' | 'email'
 * @param {string} recipient - Phone number or email address
 * @param {string} message - Message content
 * @param {string} [subject] - Email subject (only for email channel)
 * @returns {Promise<Object>} Result object with provider info
 */
export async function sendMessage(channel, recipient, message, subject = null) {
  switch (channel) {
    case 'sms':
      return await sendSMS(recipient, message);
    case 'whatsapp':
      return await sendWhatsApp(recipient, message);
    case 'email':
      return await sendEmail(recipient, message, subject);
    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize phone number to international format
 */
function normalizePhoneNumber(phone) {
  if (!phone) return phone;
  
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, assume it's a local number
  // You may need to adjust this based on your country's phone format
  if (!normalized.startsWith('+')) {
    // Example: Add country code for Dominican Republic (+1)
    // Adjust this logic based on your needs
    normalized = `+1${normalized}`;
  }
  
  return normalized;
}

/**
 * Validate email address
 */
export function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  // Basic validation - adjust based on your needs
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  return phoneRegex.test(phone);
}

