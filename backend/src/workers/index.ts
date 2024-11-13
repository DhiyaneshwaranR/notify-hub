import { EmailWorker } from './email.worker';
import { SMSWorker } from './sms.worker';
import { NotificationChannel } from '../types/notification';
import logger from '../utils/logger';
import { workerMetrics } from '../monitoring/metrics';
import config from '../config';

const workers = {
    [NotificationChannel.EMAIL]: new EmailWorker(),
    [NotificationChannel.SMS]: new SMSWorker(),
};

const updateWorkerMetrics = (
    channel: NotificationChannel,
    status: 'running' | 'stopped' | 'failed',
    error?: Error
) => {
    // Set worker status (1 for running, 0 for others)
    workerMetrics.workerStatus.set({
        channel,
        status: 'running'
    }, status === 'running' ? 1 : 0);

    workerMetrics.workerStatus.set({
        channel,
        status: 'stopped'
    }, status === 'stopped' ? 1 : 0);

    workerMetrics.workerStatus.set({
        channel,
        status: 'failed'
    }, status === 'failed' ? 1 : 0);

    // Update active workers count
    const channelConfig = config.queue.channels[channel as NotificationChannel];
    workerMetrics.activeWorkers.set(
        { channel },
        status === 'running' ? channelConfig.workerConcurrency : 0
    );

    // If there's an error, increment error counter
    if (error) {
        workerMetrics.workerErrors.inc({
            channel,
            error_type: error.name || 'unknown'
        });
    }
};

export const startWorkers = async () => {
    const startTime = Date.now();

    for (const [channelKey, worker] of Object.entries(workers)) {
        const channel = channelKey as NotificationChannel;
        try {
            const workerStartTime = Date.now();

            await worker.start();

            // Update metrics for successful start
            updateWorkerMetrics(channel, 'running');

            // Record initialization time
            workerMetrics.initializationTime.observe(
                (Date.now() - workerStartTime) / 1000
            );

            // Set initial concurrency
            const channelConfig = config.queue.channels[channel];
            workerMetrics.concurrency.set(
                { channel },
                channelConfig.workerConcurrency
            );

            logger.info(`Worker started successfully`, { channel });

        } catch (error) {
            updateWorkerMetrics(
                channel,
                'failed',
                error instanceof Error ? error : new Error('Unknown error')
            );

            logger.error(`Worker failed to start`, {
                channel,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Log overall initialization time
    const initializationTime = (Date.now() - startTime) / 1000;
    logger.info('All workers initialized', {
        duration: initializationTime,
        workerCount: Object.keys(workers).length
    });
};

export const stopWorkers = async () => {
    for (const [channelKey, worker] of Object.entries(workers)) {
        const channel = channelKey as NotificationChannel;
        try {
            worker.stop();
            updateWorkerMetrics(channel, 'stopped');

            logger.info(`Worker stopped successfully`, { channel });
        } catch (error) {
            logger.error(`Error stopping worker`, {
                channel,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
};

// Monitor worker health periodically
const monitorWorkers = () => {
    setInterval(async () => {
        for (const [channelKey, worker] of Object.entries(workers)) {
            const channel = channelKey as NotificationChannel;
            try {
                if (worker.isActive()) {
                    const backlog = await worker.getQueueBacklog();
                    workerMetrics.queueBacklog.set(
                        { channel },
                        backlog
                    );

                    const lag = worker.getProcessingLag();
                    workerMetrics.processingLag.set(
                        { channel },
                        lag
                    );
                }
            } catch (error) {
                logger.error(`Error monitoring worker`, {
                    channel,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    }, config.queue.healthCheck.interval);
};

// Start monitoring when workers are started
if (process.env.NODE_ENV !== 'test') {
    monitorWorkers();
}

export default workers;