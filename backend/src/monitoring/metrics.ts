import client from 'prom-client';

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (memory usage, CPU usage, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
export const notificationCounter = new client.Counter({
    name: 'notifications_total',
    help: 'Total number of notifications sent',
    labelNames: ['channel', 'status']
});

export const notificationDuration = new client.Histogram({
    name: 'notification_duration_seconds',
    help: 'Time taken to process notifications',
    labelNames: ['channel'],
    buckets: [0.1, 0.5, 1, 2, 5]
});

export const queueSize = new client.Gauge({
    name: 'notification_queue_size',
    help: 'Current size of notification queues',
    labelNames: ['channel']
});

register.registerMetric(notificationCounter);
register.registerMetric(notificationDuration);
register.registerMetric(queueSize);

export { register };