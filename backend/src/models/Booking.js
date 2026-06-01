import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required']
  },
  bookingId: {
    type: String,
    required: [true, 'Unique Booking ID is required'],
    unique: true
  },
  ticketCount: {
    type: Number,
    required: [true, 'Ticket count is required'],
    min: [1, 'Must book at least 1 ticket'],
    default: 1
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  orderId: {
    type: String,
    required: [true, 'Razorpay Order ID is required']
  },
  paymentId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Indexes for fast lookup
bookingSchema.index({ userId: 1 });
bookingSchema.index({ eventId: 1 });
bookingSchema.index({ orderId: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
