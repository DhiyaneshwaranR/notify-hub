// src/monitoring/metrics.ts
import client from 'prom-client';

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (memory usage, CPU usage, etc.)
client.collectDefaultMetrics({ register });

// Define singleton instances for commonly used metrics
const queueSizeMetric = new client.Gauge({
    name: 'notification_queue_size',
    help: 'Current size of notification queues',
    labelNames: ['channel', 'priority']
});

const dlqSizeMetric = new client.Gauge({
    name: 'notification_dlq_size',
    help: 'Current size of dead letter queues',
    labelNames: ['channel']
});

const processingItemsMetric = new client.Gauge({
    name: 'notification_processing_items',
    help: 'Current number of items being processed',
    labelNames: ['channel']
});

// Register singleton metrics
const singletonMetrics = [queueSizeMetric, dlqSizeMetric, processingItemsMetric];
singletonMetrics.forEach(metric => {
    try {
        register.registerMetric(metric);
    } catch (error) {
        // Metric already registered, ignore
        console.log(`Metric ${metric} already registered`);
    }
});

// Notification metrics
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

// Worker metrics
export const workerMetrics = {
    // Worker status metrics
    workerStatus: new client.Gauge({
        name: 'notification_worker_status',
        help: 'Current status of notification workers (1 = running, 0 = stopped)',
        labelNames: ['channel', 'status']
    }),

    initializationTime: new client.Histogram({
        name: 'notification_worker_initialization_seconds',
        help: 'Time taken to initialize workers',
        buckets: [0.1, 0.5, 1, 2, 5]
    }),

    processingTime: new client.Histogram({
        name: 'notification_processing_duration_seconds',
        help: 'Time taken to process notifications',
        labelNames: ['channel', 'priority', 'success'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    }),

    processedNotifications: new client.Counter({
        name: 'notifications_processed_total',
        help: 'Total number of processed notifications',
        labelNames: ['channel', 'priority', 'status']
    }),

    activeWorkers: new client.Gauge({
        name: 'notification_active_workers',
        help: 'Number of active workers per channel',
        labelNames: ['channel']
    }),

    workerErrors: new client.Counter({
        name: 'notification_worker_errors_total',
        help: 'Total number of worker errors',
        labelNames: ['channel', 'error_type']
    }),

    workerRestarts: new client.Counter({
        name: 'notification_worker_restarts_total',
        help: 'Total number of worker restarts',
        labelNames: ['channel', 'reason']
    }),

    processingLag: new client.Gauge({
        name: 'notification_processing_lag_seconds',
        help: 'Time lag between notification creation and processing',
        labelNames: ['channel', 'priority']
    }),

    queueBacklog: new client.Gauge({
        name: 'notification_queue_backlog',
        help: 'Number of notifications waiting to be processed',
        labelNames: ['channel', 'priority']
    }),

    concurrency: new client.Gauge({
        name: 'notification_worker_concurrency',
        help: 'Current worker concurrency settings',
        labelNames: ['channel']
    })
};

// Queue metrics
export const queueMetrics = {
    queueSize: queueSizeMetric,
    dlqSize: dlqSizeMetric,
    processingItems: processingItemsMetric,

    expiredItems: new client.Counter({
        name: 'notification_expired_items_total',
        help: 'Total number of expired items',
        labelNames: ['channel', 'priority']
    }),

    requeuedItems: new client.Counter({
        name: 'notification_requeued_items_total',
        help: 'Total number of requeued items',
        labelNames: ['channel', 'priority']
    }),

    rateLimit: new client.Gauge({
        name: 'notification_rate_limit',
        help: 'Current rate limit usage',
        labelNames: ['channel', 'priority']
    }),

    processingRate: new client.Gauge({
        name: 'notification_processing_rate',
        help: 'Current processing rate per minute',
        labelNames: ['channel', 'priority']
    }),

    errorRate: new client.Gauge({
        name: 'notification_error_rate',
        help: 'Current error rate per minute',
        labelNames: ['channel', 'priority']
    }),

    circuitBreaker: new client.Gauge({
        name: 'notification_circuit_breaker_status',
        help: 'Circuit breaker status (1 = closed/healthy, 0 = open/unhealthy)',
        labelNames: ['channel']
    }),

    healthIssues: new client.Gauge({
        name: 'notification_health_issues',
        help: 'Total number of health issues',
        labelNames: ['channel', 'type']
    }),

    criticalIssues: new client.Gauge({
        name: 'notification_critical_issues',
        help: 'Number of critical health issues',
        labelNames: ['channel']
    })
};

// Register remaining metrics
[notificationCounter, notificationDuration].forEach(metric => {
    try {
        register.registerMetric(metric);
    } catch (error) {
        console.log(`Metric ${metric} already registered`);
    }
});

Object.values(workerMetrics).forEach(metric => {
    try {
        register.registerMetric(metric);
    } catch (error) {
        console.log(`Metric${metric} already registered`);
    }
});

// Only register non-singleton queue metrics
const nonSingletonQueueMetrics = Object.entries(queueMetrics)
    .filter(([key]) => !['queueSize', 'dlqSize', 'processingItems'].includes(key))
    .map(([, metric]) => metric);

nonSingletonQueueMetrics.forEach(metric => {
    try {
        register.registerMetric(metric);
    } catch (error) {
        console.log(`Metric ${metric} already registered`);
    }
});

// Export singleton metrics for reuse
export const queueSize = queueSizeMetric;
export const dlqSize = dlqSizeMetric;
export const processingItems = processingItemsMetric;

export { register };