import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import transporter from '../config/mail.js';
import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import User from '../models/User.js';

const redisUri = process.env.REDIS_URI || process.env.REDIS_URL || 'redis://localhost:6379';

// Setup connection dedicated for BullMQ (maxRetriesPerRequest must be null)
const queueConnection = new Redis(redisUri, {
  maxRetriesPerRequest: null,
});

// 1. Create BullMQ Queue
export const emailQueue = new Queue('email-queue', {
  connection: queueConnection,
});

// Helper to compile basic HTML templates
const getConfirmationHTML = (userName, eventTitle, eventDate, eventTime, eventVenue, bookingId, ticketCount, totalAmount) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 40px; }
        .header { text-align: center; border-bottom: 1px solid #1f2937; padding-bottom: 24px; }
        .logo { font-size: 24px; font-weight: bold; color: #7C3AED; }
        .title { font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 16px; }
        .details { margin: 24px 0; font-size: 14px; line-height: 1.6; }
        .detail-row { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(31, 41, 55, 0.5); padding: 12px 0; }
        .label { color: #9ca3af; }
        .value { color: #ffffff; font-weight: 600; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; border-top: 1px solid #1f2937; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">✨ Evently</div>
          <div class="title">Booking Confirmed!</div>
        </div>
        <div class="details">
          <p>Hi ${userName},</p>
          <p>Your seats are securely locked in! Below is your premium digital ticket receipt summary:</p>
          
          <div class="detail-row">
            <span class="label">Event Name</span>
            <span class="value">${eventTitle}</span>
          </div>
          <div class="detail-row">
            <span class="label">Scheduled Time</span>
            <span class="value">${eventDate} at ${eventTime}</span>
          </div>
          <div class="detail-row">
            <span class="label">Venue</span>
            <span class="value">${eventVenue}</span>
          </div>
          <div class="detail-row">
            <span class="label">Ticket Alphanumeric ID</span>
            <span class="value" style="font-family: monospace; letter-spacing: 1px;">${bookingId}</span>
          </div>
          <div class="detail-row">
            <span class="label">Seats Reserved</span>
            <span class="value">${ticketCount} Ticket(s)</span>
          </div>
          <div class="detail-row">
            <span class="label">Total Paid</span>
            <span class="value" style="color: #34d399;">${totalAmount}</span>
          </div>
        </div>
        <div class="footer">
          <p>Thank you for choosing Evently! See you at the venue.</p>
          <p>© 2026 Evently Inc. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getCancellationHTML = (userName, eventTitle, bookingId, ticketCount, refundAmount) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 40px; }
        .header { text-align: center; border-bottom: 1px solid #1f2937; padding-bottom: 24px; }
        .logo { font-size: 24px; font-weight: bold; color: #ef4444; }
        .title { font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 16px; }
        .details { margin: 24px 0; font-size: 14px; line-height: 1.6; }
        .detail-row { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(31, 41, 55, 0.5); padding: 12px 0; }
        .label { color: #9ca3af; }
        .value { color: #ffffff; font-weight: 600; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; border-top: 1px solid #1f2937; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎟️ Evently</div>
          <div class="title">Booking Cancelled Successfully</div>
        </div>
        <div class="details">
          <p>Hi ${userName},</p>
          <p>This email confirms that your booking has been cancelled successfully. Below is your refund receipt details:</p>
          
          <div class="detail-row">
            <span class="label">Event Name</span>
            <span class="value">${eventTitle}</span>
          </div>
          <div class="detail-row">
            <span class="label">Booking Alphanumeric ID</span>
            <span class="value" style="font-family: monospace; letter-spacing: 1px;">${bookingId}</span>
          </div>
          <div class="detail-row">
            <span class="label">Tickets Cancelled</span>
            <span class="value">${ticketCount} Ticket(s)</span>
          </div>
          <div class="detail-row">
            <span class="label">Refund Initiated</span>
            <span class="value" style="color: #ef4444;">${refundAmount}</span>
          </div>
        </div>
        <div class="footer">
          <p>Your refund has been safely processed. Expect balances to settle in 3-5 business days.</p>
          <p>© 2026 Evently Inc. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// 2. Create BullMQ Worker to process background emails
export const emailWorker = new Worker('email-queue', async (job) => {
  const { bookingId } = job.data;
  console.log(`📧 Worker ${job.id} picked up task [${job.name}] for Booking ID: ${bookingId}`);

  try {
    const booking = await Booking.findById(bookingId)
      .populate('userId', 'name email')
      .populate({
        path: 'eventId',
        populate: {
          path: 'organizerId',
          select: 'name email',
        },
      });

    if (!booking) {
      console.warn(`⚠️ Booking not found for async email task: ${bookingId}`);
      return;
    }

    const attendee = booking.userId;
    const event = booking.eventId;

    if (job.name === 'send-confirmation') {
      const formattedDate = new Date(event.date).toLocaleDateString('en-US', { dateStyle: 'medium' });
      const formattedAmount = booking.totalAmount === 0 ? 'Free' : `₹${booking.totalAmount.toLocaleString('en-IN')}`;

      const html = getConfirmationHTML(
        attendee.name,
        event.title,
        formattedDate,
        event.time,
        event.location,
        booking.bookingId,
        booking.ticketCount,
        formattedAmount
      );

      await transporter.sendMail({
        from: `Evently Notifications <${process.env.EMAIL_FROM || 'noreply@evently.com'}>`,
        to: attendee.email,
        subject: `🎫 Booking Confirmed! - ${event.title}`,
        html,
      });

      console.log(`🟢 Successfully dispatched booking confirmation email to: ${attendee.email}`);
    } else if (job.name === 'send-cancellation') {
      const formattedAmount = booking.totalAmount === 0 ? 'Free' : `₹${booking.totalAmount.toLocaleString('en-IN')}`;

      const html = getCancellationHTML(
        attendee.name,
        event.title,
        booking.bookingId,
        booking.ticketCount,
        formattedAmount
      );

      await transporter.sendMail({
        from: `Evently Notifications <${process.env.EMAIL_FROM || 'noreply@evently.com'}>`,
        to: attendee.email,
        subject: `🎟️ Booking Cancelled - ${event.title}`,
        html,
      });

      console.log(`🟢 Successfully dispatched cancellation receipt email to: ${attendee.email}`);
    }
  } catch (error) {
    console.error(`🔴 Worker ${job.id} Failed to dispatch email:`, error.message);
    // Do not re-throw the error in order to prevent unhandled rejections from crashing the Express server.
  }
}, {
  connection: queueConnection,
});

// Event listeners to handle job completion, failure, and connection errors cleanly
emailWorker.on('completed', (job) => {
  console.log(`🟢 Job ${job.id} [${job.name}] has completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`🔴 Job ${job?.id} [${job?.name}] failed: ${err.message}`);
});

emailWorker.on('error', (err) => {
  console.error(`🔴 BullMQ Worker Error:`, err.message);
});
