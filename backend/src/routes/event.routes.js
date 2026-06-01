import express from 'express';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getOrganizerEvents,
  getAllEvents,
  getEventById
} from '../controllers/event.controller.js';
import { protect, requireRole } from '../middlewares/auth.middleware.js';
import { isEventOwner } from '../middlewares/event.middleware.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

// Public routes for event discovery
router.get('/', getAllEvents);
router.get('/:id', getEventById);

// Protected routes (Only accessible to authenticated Organizers)
router.get(
  '/host/my-events',
  protect,
  requireRole('organizer'),
  getOrganizerEvents
);

router.post(
  '/',
  protect,
  requireRole('organizer'),
  upload.single('image'), // Stream file upload to Cloudinary before triggering controller
  createEvent
);

router.put(
  '/:id',
  protect,
  requireRole('organizer'),
  isEventOwner, // Validate organizer owns the event resource
  upload.single('image'), // Process image replacements if sent
  updateEvent
);

router.delete(
  '/:id',
  protect,
  requireRole('organizer'),
  isEventOwner,
  deleteEvent
);

export default router;
