import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import connectDB from './config/db.js';
import redisClient from './config/redis.js';
import { errorHandler } from './middlewares/error.js';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.routes.js';
import eventRouter from './routes/event.routes.js';
import bookingRouter from './routes/booking.routes.js';
import paymentRouter from './routes/payment.routes.js';
import reviewRouter from './routes/review.routes.js';
import { emailWorker } from './queues/email.queue.js';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Socket.io Server Setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Attach Socket.io to global express app object for ease of access in routers
app.set('io', io);

// Midlewares
app.use(helmet({
  contentSecurityPolicy: false, // Turn off for simpler local development
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Socket.io connection logging
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Attendee joins an event room to receive live seat updates
  socket.on('join-event-room', (eventId) => {
    socket.join(`event:${eventId}`);
    console.log(`🔌 Client ${socket.id} joined room event:${eventId}`);
  });

  // Attendee leaves an event room when navigating away
  socket.on('leave-event-room', (eventId) => {
    socket.leave(`event:${eventId}`);
    console.log(`🔌 Client ${socket.id} left room event:${eventId}`);
  });

  // Organizer joins their host room to receive live booking alerts & auto-refresh metrics
  socket.on('join-organizer-room', (organizerId) => {
    socket.join(`organizer:${organizerId}`);
    console.log(`🔌 Organizer ${socket.id} joined room organizer:${organizerId}`);
  });

  // Organizer leaves their host room when navigating away
  socket.on('leave-organizer-room', (organizerId) => {
    socket.leave(`organizer:${organizerId}`);
    console.log(`🔌 Organizer ${socket.id} left room organizer:${organizerId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/events', eventRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/reviews', reviewRouter);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Evently API Gateway',
  });
});

// Comprehensive Health check route checking MongoDB & Redis statuses
app.get('/api/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
  let redisStatus = 'unhealthy';
  try {
    const ping = await redisClient.ping();
    if (ping === 'PONG') {
      redisStatus = 'healthy';
    }
  } catch (error) {
    redisStatus = `unhealthy: ${error.message}`;
  }

  const overallHealthy = mongoStatus === 'healthy' && redisStatus === 'healthy';

  res.status(overallHealthy ? 200 : 500).json({
    success: overallHealthy,
    timestamp: new Date(),
    services: {
      server: 'healthy',
      mongodb: mongoStatus,
      redis: redisStatus,
    },
  });
});

// Catch-all route handler for undefined paths
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl} not found`,
  });
});

// Register Global Error Handler
app.use(errorHandler);

// Mongoose connection and Server start
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // 1. Connect MongoDB Replica Set
  await connectDB();
  
  // 2. Start HTTP & WebSockets Server
  server.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`🔴 Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Import mongoose here to prevent circular refs or undefined vars in health check
import mongoose from 'mongoose';

startServer();

export { app, server, io };
// Nodemon hot reload trigger

