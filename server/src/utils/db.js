import mongoose from 'mongoose';

export const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('Missing MONGODB_URI');
        process.exit(1);
    }
    await mongoose.connect(uri);
    console.log('MongoDB connected');
};
