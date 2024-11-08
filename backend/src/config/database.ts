import mongoose from 'mongoose';
import config from './index';

const connectDB = async (): Promise<void> => {
    try {
        // await mongoose.connect(config.mongoose.url, config.mongoose.options);
        await mongoose.connect(config.mongoose.url);
        console.log('MongoDB Connected Successfully');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

export default connectDB;