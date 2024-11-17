import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import connectDB from './config/database';
import logger from './utils/logger';

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1', routes);

// Error Handler - this is the correct way to add error handling middleware in Express
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    // Check if the error is a validation error
    if (err.name === 'ValidationError') {
        // Extract the validation errors
        const validationErrors = err.errors;

        // Log the validation errors without the password value
        logger.error('Validation error:', {
            errors: validationErrors.map((error: any) => ({
                type: error.type,
                msg: error.msg,
                path: error.path,
                location: error.path === 'password' ? 'body' : error.location
            }))
        });

        // Send the validation errors back to the client
        return res.status(400).json({
            status: 'error',
            errors: validationErrors
        });
    }

    // Log other types of errors
    logger.error(err.message, err);

    // Handle other types of errors
    res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message
    });
};

export default app;