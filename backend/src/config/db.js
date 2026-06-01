import mongoose from 'mongoose';

const connectDB = async () => {
  const connString = process.env.MONGO_URI || 'mongodb://localhost:27017/evently?replicaSet=rs0';
  
  console.log(`Attempting to connect to MongoDB...`);
  
  const options = {
    autoIndex: true, // Auto-build indexes in development, disable in production for perf
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  };

  let retries = 5;
  while (retries > 0) {
    try {
      const conn = await mongoose.connect(connString, options);
      console.log(`🟢 MongoDB Connected: ${conn.connection.host}`);
      
      // Handle connection errors after initial connection
      mongoose.connection.on('error', (err) => {
        console.error(`🚨 MongoDB connection error: ${err.message}`);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB connection lost. Reconnecting...');
      });

      return conn;
    } catch (error) {
      console.error(`🔴 MongoDB connection failed: ${error.message}`);
      retries -= 1;
      console.log(`Retries remaining: ${retries}. Waiting 5 seconds before retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.error('💥 Could not connect to MongoDB after multiple attempts. Exiting...');
  process.exit(1);
};

export default connectDB;
