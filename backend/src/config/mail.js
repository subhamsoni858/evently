import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
  port: Number(process.env.EMAIL_PORT) || 2525,
  auth: {
    user: process.env.EMAIL_USER || 'dummy_user',
    pass: process.env.EMAIL_PASS || 'dummy_password',
  },
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error(`🔴 Nodemailer SMTP Transporter Connection Error: ${error.message}`);
  } else {
    console.log('🟢 Nodemailer SMTP Transporter ready to dispatch emails');
  }
});

export default transporter;
