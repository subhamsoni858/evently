import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import { ErrorResponse } from '../middlewares/error.js';
import { emailQueue } from '../queues/email.queue.js';

// @desc    Verify Razorpay secure checkout payment signature
// @route   POST /api/payments/verify
// @access  Private (Attendee only)
export const verifyPayment = async (req, res, next) => {
  const { bookingId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  if (!bookingId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return next(new ErrorResponse('Payment verification credentials missing from checkout payload', 400));
  }

  // 1. Re-calculate expected signature with HMAC-SHA256 (bypass if sandbox simulator)
  const isMock = razorpay_order_id.startsWith('mock_order_') || razorpay_signature === 'mock_signature_bypass';
  let isValid = false;

  if (isMock) {
    isValid = true;
    console.warn(`💳 Sandbox Payment Simulator Verified for Order: ${razorpay_order_id}`);
  } else {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummykeysecret')
      .update(body.toString())
      .digest('hex');

    isValid = expectedSignature === razorpay_signature;
  }

  if (!isValid) {
    return next(
      new ErrorResponse('Payment checkout signature verification failed. Transaction is unauthorized!', 400)
    );
  }

  // 2. Open MongoDB session / transaction if supported
  const topologyType = mongoose.connection.getClient().topology?.description?.type;
  const useTransaction = topologyType !== 'Single';

  let session = null;
  if (useTransaction) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    const bookingQuery = Booking.findById(bookingId).populate('eventId');
    const booking = useTransaction ? await bookingQuery.session(session) : await bookingQuery;

    if (!booking) {
      if (useTransaction) {
        await session.abortTransaction();
        session.endSession();
      }
      return next(new ErrorResponse('Booking reference not found in database', 404));
    }

    if (booking.status === 'confirmed') {
      // Already verified (possibly by webhook in background)
      if (useTransaction) {
        await session.commitTransaction();
        session.endSession();
      }
      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully and booking is active',
        data: booking,
      });
    }

    // 3. Mark booking confirmed
    booking.status = 'confirmed';
    booking.paymentId = razorpay_payment_id;

    if (useTransaction) {
      await booking.save({ session });
      await session.commitTransaction();
      session.endSession();
    } else {
      await booking.save();
    }

    // 3.5. Real-time Live Organizer Notification Alert
    const io = req.app.get('io');
    const organizerId = booking.eventId?.organizerId;
    if (organizerId) {
      io.to(`organizer:${organizerId}`).emit('new-booking', {
        attendeeName: req.user.name,
        eventTitle: booking.eventId?.title || 'Reserved Event',
        ticketCount: booking.ticketCount,
        totalAmount: booking.totalAmount,
        bookingId: booking.bookingId,
        createdAt: booking.createdAt,
      });
      console.log(`🔌 Emitted real-time new-booking notification to room: organizer:${organizerId}`);
    }

    // 3.6. Enqueue background email confirmation task
    await emailQueue.add('send-confirmation', { bookingId: booking._id });
    console.log(`✉️ Enqueued async booking confirmation email for: ${booking.bookingId}`);

    res.status(200).json({
      success: true,
      message: 'Payment verified and booking is successfully active!',
      data: booking,
    });
  } catch (error) {
    if (useTransaction && session) {
      await session.abortTransaction();
      session.endSession();
    }
    next(error);
  }
};

// @desc    Razorpay Server-to-Server Webhook receiver fail-safe
// @route   POST /api/payments/webhook
// @access  Public
export const handleWebhook = async (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ success: false, message: 'Missing Webhook signature' });
  }

  // 1. Verify webhook signature using the captured raw body buffer
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummywebhooksecret';
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(req.rawBody || JSON.stringify(req.body));
  const digest = shasum.digest('hex');

  if (digest !== signature) {
    console.error('🚨 Webhook signature mismatch!');
    return res.status(400).json({ success: false, message: 'Invalid Webhook signature' });
  }

  const event = req.body.event;

  // Listen for captured orders or captured payments
  if (event === 'payment.captured' || event === 'order.paid') {
    const paymentEntity = req.body.payload.payment.entity;
    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    const topologyType = mongoose.connection.getClient().topology?.description?.type;
    const useTransaction = topologyType !== 'Single';

    let session = null;
    if (useTransaction) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      const bookingQuery = Booking.findOne({ orderId }).populate('eventId').populate('userId');
      const booking = useTransaction ? await bookingQuery.session(session) : await bookingQuery;

      if (booking && booking.status === 'pending') {
        booking.status = 'confirmed';
        booking.paymentId = paymentId;

        if (useTransaction) {
          await booking.save({ session });
          await session.commitTransaction();
          session.endSession();
        } else {
          await booking.save();
        }

        console.log(`🔔 Webhook updated Booking ${booking.bookingId} to confirmed!`);

        // 3.5. Webhook Real-time Live Organizer Notification Alert
        const io = req.app.get('io');
        const organizerId = booking.eventId?.organizerId;
        if (organizerId) {
          io.to(`organizer:${organizerId}`).emit('new-booking', {
            attendeeName: booking.userId?.name || 'Authorized Attendee',
            eventTitle: booking.eventId?.title || 'Reserved Event',
            ticketCount: booking.ticketCount,
            totalAmount: booking.totalAmount,
            bookingId: booking.bookingId,
            createdAt: booking.createdAt,
          });
          console.log(`🔌 Webhook emitted real-time new-booking notification to room: organizer:${organizerId}`);
        }

        // 3.6. Webhook Enqueue background email confirmation task
        await emailQueue.add('send-confirmation', { bookingId: booking._id });
        console.log(`✉️ Webhook enqueued async booking confirmation email for: ${booking.bookingId}`);
      } else {
        if (useTransaction) {
          await session.abortTransaction();
          session.endSession();
        }
      }
    } catch (error) {
      console.error('Webhook processing database error:', error.message);
      if (useTransaction && session) {
        await session.abortTransaction();
        session.endSession();
      }
    }
  }

  res.status(200).json({ status: 'ok' });
};
