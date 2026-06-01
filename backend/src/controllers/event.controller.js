import Event from '../models/Event.js';
import { cloudinary } from '../config/cloudinary.js';
import { ErrorResponse } from '../middlewares/error.js';
import redisClient from '../config/redis.js';

// Cache invalidation utility helper
const clearEventCache = async (eventId = null) => {
  try {
    const keys = await redisClient.keys('events:list:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🧹 Redis cache cleared! Deleted ${keys.length} listing keys.`);
    }
    if (eventId) {
      await redisClient.del(`events:detail:${eventId}`);
      console.log(`🧹 Redis detail cache cleared for Event: ${eventId}`);
    }
  } catch (error) {
    console.error('⚠️ Redis Cache Invalidation Failed:', error.message);
  }
};

// @desc    Create a new event
// @route   POST /api/events
// @access  Private (Organizer only)
export const createEvent = async (req, res, next) => {
  const { title, description, date, time, location, capacity, price, category } = req.body;

  try {
    // 1. Check if event poster is uploaded
    if (!req.file) {
      return next(new ErrorResponse('Please upload an event poster image', 400));
    }

    // 2. Basic validations
    if (!title || !description || !date || !time || !location || !capacity || price === undefined || !category) {
      // If validation fails, clean up the recently uploaded image from Cloudinary to avoid storage leaks
      await cloudinary.uploader.destroy(req.file.filename);
      return next(new ErrorResponse('Please provide all required fields', 400));
    }

    // 3. Create Event
    const event = await Event.create({
      title,
      description,
      date: new Date(date),
      time,
      location,
      capacity: Number(capacity),
      seatsRemaining: Number(capacity), // Initially all seats are remaining
      price: Number(price),
      category,
      image: {
        url: req.file.path, // Multer-storage-cloudinary attaches CDN URL here
        publicId: req.file.filename // Multer-storage-cloudinary attaches public ID here
      },
      organizerId: req.user._id
    });

    // Invalidate event listings cache on create
    await clearEventCache();

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    // Clean up uploaded image if Mongo save crashes
    if (req.file) {
      await cloudinary.uploader.destroy(req.file.filename);
    }
    next(error);
  }
};

// @desc    Update an existing event
// @route   PUT /api/events/:id
// @access  Private (Organizer only, owner check)
export const updateEvent = async (req, res, next) => {
  const { title, description, date, time, location, capacity, price, category } = req.body;
  const event = req.event; // Attached in isEventOwner middleware

  try {
    // 1. Update basic text fields
    event.title = title || event.title;
    event.description = description || event.description;
    event.date = date ? new Date(date) : event.date;
    event.time = time || event.time;
    event.location = location || event.location;
    event.price = price !== undefined ? Number(price) : event.price;
    event.category = category || event.category;

    // 2. Handle Capacity Adjustments dynamically
    if (capacity !== undefined && Number(capacity) !== event.capacity) {
      const newCapacity = Number(capacity);
      const delta = newCapacity - event.capacity;
      
      // Prevent reducing capacity below currently booked seats
      const bookedSeats = event.capacity - event.seatsRemaining;
      if (newCapacity < bookedSeats) {
        return next(
          new ErrorResponse(
            `Cannot reduce capacity below currently booked seats (${bookedSeats} seats already booked)`,
            400
          )
        );
      }
      
      event.capacity = newCapacity;
      event.seatsRemaining = event.seatsRemaining + delta;
    }

    // 3. Handle Image Replacement
    if (req.file) {
      // Invalidate/delete the old image from Cloudinary CDN
      await cloudinary.uploader.destroy(event.image.publicId);
      
      // Update image references
      event.image = {
        url: req.file.path,
        publicId: req.file.filename
      };
    }

    const updatedEvent = await event.save();

    // Invalidate event listings and detail caches on update
    await clearEventCache(event._id);

    res.status(200).json({
      success: true,
      data: updatedEvent
    });
  } catch (error) {
    // If Mongo update crashes but user uploaded a new image, clean it up
    if (req.file) {
      await cloudinary.uploader.destroy(req.file.filename);
    }
    next(error);
  }
};

// @desc    Delete an event
// @route   DELETE /api/events/:id
// @access  Private (Organizer only, owner check)
export const deleteEvent = async (req, res, next) => {
  const event = req.event; // Attached in isEventOwner middleware

  try {
    // 1. Delete image from Cloudinary
    await cloudinary.uploader.destroy(event.image.publicId);

    // 2. Cascade bookings cancellation (Optional: detailed in Day 5/8 checkouts)
    // 3. Remove event document
    await event.deleteOne();

    // Invalidate event listings and detail caches on delete
    await clearEventCache(event._id);

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully and media assets removed from CDN'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all events created by logged-in organizer
// @route   GET /api/events/organizer
// @access  Private (Organizer only)
export const getOrganizerEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ organizerId: req.user._id }).sort({ date: 1 });
    
    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all upcoming events (Public Discovery basis)
// @route   GET /api/events
// @access  Public
export const getAllEvents = async (req, res, next) => {
  const { search, category, price, dateRange, page = 1, limit = 6 } = req.query;

  // Generate a distinct Redis cache key representing these exact search/filter combinations
  const cacheKey = `events:list:${JSON.stringify(req.query)}`;

  try {
    // 1. Attempt Redis Cache Lookup
    const cachedResponse = await redisClient.get(cacheKey);
    if (cachedResponse) {
      const responsePayload = JSON.parse(cachedResponse);
      return res.status(200).json({
        ...responsePayload,
        fromCache: true // Dynamic tag to identify caching performance gains
      });
    }

    const queryObj = {};

    // 1. Force filter upcoming events by default (excluding past ones)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    queryObj.date = { $gte: today };

    // 2. Full-text search or dynamic regex partial matches
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      queryObj.$or = [
        { title: searchRegex },
        { location: searchRegex },
        { description: searchRegex }
      ];
    }

    // 3. Category Filter
    if (category && category !== 'All') {
      queryObj.category = category;
    }

    // 4. Price range filters
    if (price) {
      if (price === 'free') {
        queryObj.price = 0;
      } else if (price === 'paid') {
        queryObj.price = { $gt: 0 };
      }
    }

    // 5. Date filters (Today, This Week, This Month)
    if (dateRange) {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));
        const endOfToday = new Date(now.setHours(23, 59, 59, 999));
        queryObj.date = { $gte: startOfToday, $lte: endOfToday };
      } else if (dateRange === 'week') {
        const endOfWeek = new Date(now.setDate(now.getDate() + 7));
        queryObj.date = { $gte: today, $lte: endOfWeek };
      } else if (dateRange === 'month') {
        const endOfMonth = new Date(now.setMonth(now.getMonth() + 1));
        queryObj.date = { $gte: today, $lte: endOfMonth };
      }
    }

    // 6. Pagination mathematics
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skipNum = (pageNum - 1) * limitNum;

    // 7. Execute Queries
    const totalEvents = await Event.countDocuments(queryObj);
    const events = await Event.find(queryObj)
      .populate('organizerId', 'name email')
      .sort({ date: 1 })
      .skip(skipNum)
      .limit(limitNum);

    const totalPages = Math.ceil(totalEvents / limitNum);

    const responsePayload = {
      success: true,
      count: events.length,
      currentPage: pageNum,
      totalPages: totalPages,
      totalEvents: totalEvents,
      data: events
    };

    // 8. Cache response payload in Redis for 5 minutes (300 seconds)
    await redisClient.setex(cacheKey, 300, JSON.stringify(responsePayload));

    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single event by ID
// @route   GET /api/events/:id
// @access  Public
export const getEventById = async (req, res, next) => {
  const eventId = req.params.id;
  const cacheKey = `events:detail:${eventId}`;

  try {
    // 1. Attempt Redis Cache Lookup
    const cachedResponse = await redisClient.get(cacheKey);
    if (cachedResponse) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedResponse),
        fromCache: true
      });
    }

    const event = await Event.findById(eventId).populate('organizerId', 'name email');

    if (!event) {
      return next(new ErrorResponse(`Event not found with id of ${eventId}`, 404));
    }

    // 2. Cache detailed event document in Redis for 10 minutes (600 seconds)
    await redisClient.setex(cacheKey, 600, JSON.stringify(event));

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    next(error);
  }
};
