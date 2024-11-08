import NotificationService from '../../src/services/notification.service';
import NotificationModel from '../../src/models/notification.model';
import { NotificationChannel, NotificationPriority } from '../../src/types/notification';

jest.mock('../../src/models/notification.model');

describe('NotificationService', () => {
    const mockNotificationRequest = {
        channel: NotificationChannel.EMAIL,
        recipients: [{
            id: '1',
            channel: NotificationChannel.EMAIL,
            destination: 'test@example.com'
        }],
        content: {
            subject: 'Test',
            body: 'Test notification'
        },
        priority: NotificationPriority.MEDIUM
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a notification', async () => {
        const mockSavedNotification = {
            _id: '123',
            status: 'PENDING',
            channel: NotificationChannel.EMAIL,
            createdAt: new Date(),
            ...mockNotificationRequest
        };

        (NotificationModel.prototype.save as jest.Mock).mockResolvedValueOnce(mockSavedNotification);

        const result = await NotificationService.createNotification(mockNotificationRequest);

        expect(result.id).toBe('123');
        expect(result.status).toBe('PENDING');
        expect(result.channel).toBe(NotificationChannel.EMAIL);
    });
});