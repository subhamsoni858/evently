import express from 'express';
import {
  createReview,
  getEventReviews,
  checkReviewEligibility
} from '../controllers/review.controller.js';
import { protect, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes: Get reviews for a specific event
router.get('/event/:eventId', getEventReviews);

// Protected routes (Attendees only)
router.post('/', protect, requireRole('attendee'), createReview);
router.get('/check/:eventId', protect, requireRole('attendee'), checkReviewEligibility);

export default router;
