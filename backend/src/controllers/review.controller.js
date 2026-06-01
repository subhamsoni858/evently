import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import { ErrorResponse } from '../middlewares/error.js';
import redisClient from '../config/redis.js';

// Helper to scan and invalidate event listing cache keys
const clearEventCache = async () => {
  try {
    let cursor = '0';
    do {
      const reply = await redisClient.scan(cursor, 'MATCH', 'events:list:*', 'COUNT', 100);
      cursor = reply[0];
      const keys = reply[1];
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } while (cursor !== '0');
    console.log('⚡ Redis cache invalidated on review update');
  } catch (error) {
    console.error('🔴 Redis scan invalidation failed:', error.message);
  }
};

// Helper to compute and denormalize event average rating & review count
const updateEventRatings = async (eventId) => {
  const stats = await Review.aggregate([
    { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$eventId',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await Event.findByIdAndUpdate(eventId, {
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      reviewCount: stats[0].reviewCount
    });
  } else {
    await Event.findByIdAndUpdate(eventId, {
      averageRating: 0,
      reviewCount: 0
    });
  }

  // Invalidate Redis detail cache for this event
  await redisClient.del(`events:detail:${eventId}`);
  // Invalidate listings caches
  await clearEventCache();
};

// @desc    Create a new post-event review
// @route   POST /api/reviews
// @access  Private (Attendees only)
export const createReview = async (req, res, next) => {
  const { eventId, rating, comment } = req.body;

  if (!eventId || !rating || !comment) {
    return next(new ErrorResponse('Please provide eventId, star rating, and review comment', 400));
  }

  const numericRating = Number(rating);
  if (numericRating < 1 || numericRating > 5) {
    return next(new ErrorResponse('Star rating must be between 1 and 5', 400));
  }

  try {
    // 1. Verify that the event exists and has already occurred
    const event = await Event.findById(eventId);
    if (!event) {
      return next(new ErrorResponse('Event not found', 404));
    }

    const now = new Date();
    if (new Date(event.date) > now) {
      return next(new ErrorResponse('You can only review events that have already concluded.', 400));
    }

    // 2. Verify that the user has a confirmed booking for this event
    const booking = await Booking.findOne({
      userId: req.user._id,
      eventId,
      status: 'confirmed'
    });

    if (!booking) {
      return next(new ErrorResponse('Review rejected: You can only review events that you booked and attended.', 403));
    }

    // 3. Verify duplicate review check
    const existingReview = await Review.findOne({
      userId: req.user._id,
      eventId
    });

    if (existingReview) {
      return next(new ErrorResponse('You have already submitted a review for this event previously.', 400));
    }

    // 4. Create Review
    const review = await Review.create({
      userId: req.user._id,
      eventId,
      rating: numericRating,
      comment
    });

    // 5. Aggregate & Update Event Document Ratings
    await updateEventRatings(eventId);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully!',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reviews for a specific event
// @route   GET /api/reviews/event/:eventId
// @access  Public
export const getEventReviews = async (req, res, next) => {
  const { eventId } = req.params;

  try {
    const reviews = await Review.find({ eventId })
      .populate('userId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if currently logged in attendee is eligible to review an event
// @route   GET /api/reviews/check/:eventId
// @access  Private (Attendees only)
export const checkReviewEligibility = async (req, res, next) => {
  const { eventId } = req.params;

  try {
    // 1. Event existence & date check
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(200).json({ success: true, canReview: false, reason: 'Event not found' });
    }

    const now = new Date();
    if (new Date(event.date) > now) {
      return res.status(200).json({ success: true, canReview: false, reason: 'Event has not occurred yet' });
    }

    // 2. Confirmed booking check
    const booking = await Booking.findOne({
      userId: req.user._id,
      eventId,
      status: 'confirmed'
    });

    if (!booking) {
      return res.status(200).json({ success: true, canReview: false, reason: 'No confirmed booking found for this event' });
    }

    // 3. Duplicate review check
    const existingReview = await Review.findOne({
      userId: req.user._id,
      eventId
    });

    if (existingReview) {
      return res.status(200).json({ success: true, canReview: false, reason: 'You have already reviewed this event' });
    }

    // Eligible!
    res.status(200).json({
      success: true,
      canReview: true
    });
  } catch (error) {
    next(error);
  }
};
