import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Event from './src/models/Event.js';
import redisClient from './src/config/redis.js';

dotenv.config();

const backdateEvents = async () => {
  const connString = process.env.MONGO_URI || 'mongodb://localhost:27017/evently?replicaSet=rs0';
  
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(connString);
    console.log('🟢 MongoDB Connected');

    // Create a timestamp exactly 24 hours in the past
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await Event.updateMany({}, { $set: { date: yesterday } });
    console.log(`🟢 Successfully backdated ${result.modifiedCount} event(s) to yesterday.`);

    // Purge Redis cache keys for events
    console.log('Purging Redis caches...');
    let cursor = '0';
    let clearedCount = 0;
    do {
      const reply = await redisClient.scan(cursor, 'MATCH', 'events:*', 'COUNT', 100);
      cursor = reply[0];
      const keys = reply[1];
      if (keys.length > 0) {
        await redisClient.del(...keys);
        clearedCount += keys.length;
      }
    } while (cursor !== '0');
    console.log(`⚡ Redis cache invalidated (purged ${clearedCount} keys).`);

  } catch (error) {
    console.error('🔴 Operation failed:', error.message);
  } finally {
    await mongoose.disconnect();
    redisClient.disconnect();
    console.log('Connections closed.');
    process.exit(0);
  }
};

backdateEvents();
