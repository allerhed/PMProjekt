import transporter from '../config/email';
import config from '../config';
import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send an email. Non-blocking — failures are logged but never thrown.
 */
export function sendEmail(options: EmailOptions): void {
  setImmediate(async () => {
    try {
      await transporter.sendMail({
        from: config.email.sender,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      logger.info({ to: options.to, subject: options.subject }, 'Email sent');
    } catch (err) {
      logger.error({ err, to: options.to, subject: options.subject }, 'Failed to send email');
    }
  });
}
