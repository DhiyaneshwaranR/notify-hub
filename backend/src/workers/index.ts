import { EmailWorker } from './email.worker';
import { NotificationChannel } from '../types/notification';

const workers = {
    [NotificationChannel.EMAIL]: new EmailWorker(),
    // Add other workers as needed
};

export const startWorkers = () => {
    Object.values(workers).forEach(worker => {
        worker.start().catch(error => {
            console.error('Worker failed to start:', error);
        });
    });
};

export default workers;