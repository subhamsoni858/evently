import express from 'express';
import {
  createBooking,
  cancelBooking,
  getUserBookings,
  getEventBookings
} from '../controllers/booking.controller.js';
import { protect, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Protect all booking routes - requires authentication
router.use(protect);

// Booking endpoints - attendees only
router.post('/', requireRole('attendee'), createBooking);
router.get('/my-bookings', requireRole('attendee'), getUserBookings);
router.put('/:id/cancel', requireRole('attendee'), cancelBooking);

// Booking endpoints - organizers only
router.get('/event/:eventId', requireRole('organizer'), getEventBookings);

export default router;
