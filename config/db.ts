import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

// Both apps must point at the same cluster. The user app ships MONGODB_URI,
// this app originally used MONGO_URI — accept either so neither .env breaks.
const MONGODB_URI = (process.env.MONGODB_URI || process.env.MONGO_URI) as string;

if (!MONGODB_URI) {
  throw new Error(
    'Please define MONGODB_URI (or MONGO_URI) in .env — it must match the user app.'
  );
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((mongooseInstance) => {
        console.log('Successfully connected to MongoDB.');
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('Error connecting to MongoDB:', e);
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
