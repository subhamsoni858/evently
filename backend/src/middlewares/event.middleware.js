import Event from '../models/Event.js';
import { ErrorResponse } from './error.js';

// Verify that the logged-in user is the owner of the event
export const isEventOwner = async (req, res, next) => {
  const eventId = req.params.id;

  try {
    const event = await Event.findById(eventId);

    if (!event) {
      return next(new ErrorResponse(`Event not found with id of ${eventId}`, 404));
    }

    // Verify ownership: organizerId on the Event matches req.user._id
    if (event.organizerId.toString() !== req.user._id.toString()) {
      return next(
        new ErrorResponse(
          'Not authorized. You do not own this event resource.',
          403
        )
      );
    }

    // Attach event to request so we don't have to query it again in the controller
    req.event = event;
    next();
  } catch (error) {
    return next(new ErrorResponse('Verification of event ownership failed', 500));
  }
};
