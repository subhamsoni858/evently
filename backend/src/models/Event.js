import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required']
  },
  date: {
    type: Date,
    required: [true, 'Event date is required']
  },
  time: {
    type: String,
    required: [true, 'Event start time is required'],
    match: [/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter time in HH:MM format']
  },
  location: {
    type: String,
    required: [true, 'Event location is required'],
    trim: true
  },
  capacity: {
    type: Number,
    required: [true, 'Event capacity is required'],
    min: [1, 'Capacity must be at least 1']
  },
  seatsRemaining: {
    type: Number,
    required: [true, 'Seats remaining is required'],
    min: [0, 'Seats remaining cannot be negative']
  },
  price: {
    type: Number,
    required: [true, 'Event ticket price is required'],
    min: [0, 'Price cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Event category is required'],
    enum: {
      values: ['Tech', 'Music', 'Comedy', 'Workshop', 'Sports', 'Art', 'Food', 'Business', 'Other'],
      message: 'Category must be one of: Tech, Music, Comedy, Workshop, Sports, Art, Food, Business, Other'
    }
  },
  image: {
    url: {
      type: String,
      required: [true, 'Event poster URL is required']
    },
    publicId: {
      type: String,
      required: [true, 'Event poster Cloudinary publicId is required']
    }
  },
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Event organizer is required']
  },
  averageRating: {
    type: Number,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound/Single Indexes for performance in search and filters
eventSchema.index({ category: 1 });
eventSchema.index({ price: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ organizerId: 1 });

// Full text index on title, description and location for search feature
eventSchema.index({
  title: 'text',
  description: 'text',
  location: 'text'
}, {
  weights: {
    title: 10,
    location: 5,
    description: 1
  },
  name: 'EventSearchIndex'
});

const Event = mongoose.model('Event', eventSchema);

export default Event;
