import nodemailer from 'nodemailer';
import config from './index';

const transporter = nodemailer.createTransport({
  host: config.email.smtpHost,
  port: config.email.smtpPort,
  secure: false, // Mailhog in dev, SES in prod
  ...(config.env === 'production'
    ? {
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }
    : {}),
});

export default transporter;
