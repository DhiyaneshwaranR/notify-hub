import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Redis from 'ioredis-mock';
import { jest } from '@jest/globals';
// @ts-ignore
import sgMail from '@sendgrid/mail';
import {
    NotificationRequest,
    NotificationChannel,
    NotificationPriority,
    NotificationContent,
    Recipient
} from '../src/types/notification';
import {register} from "prom-client";

let mongoServer: MongoMemoryServer;

// Configure SendGrid with sandbox mode
sgMail.setApiKey(process.env.SENDGRID_API_KEY || 'TEST_API_KEY');

// Mock Redis
jest.mock('ioredis', () => require('ioredis-mock'));

// Add before all tests
beforeAll(async () => {
    // Clear all metrics before tests
    register.clear();
});

// Add before each test
beforeEach(() => {
    // Reset all metrics before each test
    register.resetMetrics();
});

// Setup function to run before all tests
export const setupTestDB = async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
};

// Cleanup function to run after all tests
export const teardownTestDB = async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
};

// Clear all collections between tests
export const clearCollections = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
};

// Test data type definitions
export const createTestRecipient = (overrides: Partial<Recipient> = {}): Recipient => ({
    id: '123',
    channel: NotificationChannel.EMAIL,
    destination: 'test@example.com',
    metadata: { name: 'Test User' },
    ...overrides
});

export const createTestContent = (overrides: Partial<NotificationContent> = {}): NotificationContent => ({
    subject: 'Test Subject',
    body: 'Test Body',
    ...overrides
});

// Create properly typed test notification
export const createTestNotification = (overrides: Partial<NotificationRequest> = {}): NotificationRequest => ({
    channel: NotificationChannel.EMAIL,
    recipients: [createTestRecipient()],
    content: createTestContent(),
    priority: NotificationPriority.MEDIUM,
    ...overrides
});

// Helper to create notifications with specific channels
export const createMultiChannelNotification = (
    channels: NotificationChannel[]
): NotificationRequest => ({
    ...createTestNotification(),
    channel: channels,
    recipients: channels.map(channel => createTestRecipient({ channel }))
});

// Helper to create notification with scheduled delivery
export const createScheduledNotification = (
    scheduledAt: Date
): NotificationRequest => ({
    ...createTestNotification(),
    scheduledAt
});

// Helper to create notification with attachments
export const createNotificationWithAttachments = (): NotificationRequest => ({
    ...createTestNotification(),
    content: {
        ...createTestContent(),
        attachments: [{
            filename: 'test.pdf',
            content: 'base64encodedcontent',
            contentType: 'application/pdf'
        }]
    }
});

// Mock Redis instance for testing
export const mockRedis = new Redis();