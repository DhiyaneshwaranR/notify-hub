import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import connectDB from './config/database';

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
app.use((err: Error, req: Request, res: Response, next: NextFunction) => errorHandler(err, req, res, next));

export default app;