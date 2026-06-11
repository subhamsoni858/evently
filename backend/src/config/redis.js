import Redis from 'ioredis';

const redisUri = process.env.REDIS_URI || 'redis://localhost:6379';

console.log('Attempting to connect to Redis...');

const redisClient = new Redis(redisUri, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableOfflineQueue: false, // Don't buffer commands if connection is lost
  commandTimeout: 2000,      // Fail fast after 2 seconds
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redisClient.on('connect', () => {
  console.log('🟢 Redis client connecting...');
});

redisClient.on('ready', () => {
  console.log('🟢 Redis Connected successfully');
});

redisClient.on('error', (err) => {
  console.error(`🔴 Redis Connection Error: ${err.message}`);
});

redisClient.on('close', () => {
  console.warn('⚠️ Redis connection closed');
});

export default redisClient;
