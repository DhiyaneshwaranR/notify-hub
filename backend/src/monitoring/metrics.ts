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

export const workerMetrics = {
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

    queueSize: new client.Gauge({
        name: 'notification_queue_size',
        help: 'Current size of notification queues',
        labelNames: ['channel', 'priority']
    }),

    dlqSize: new client.Gauge({
        name: 'notification_dlq_size',
        help: 'Current size of dead letter queues',
        labelNames: ['channel']
    })
};

export const queueMetrics = {
    queueSize: new client.Gauge({
        name: 'notification_queue_size',
        help: 'Current size of notification queues',
        labelNames: ['channel', 'priority']
    }),

    dlqSize: new client.Gauge({
        name: 'notification_dlq_size',
        help: 'Current size of dead letter queues',
        labelNames: ['channel']
    }),

    processingItems: new client.Gauge({
        name: 'notification_processing_items',
        help: 'Current number of items being processed',
        labelNames: ['channel']
    }),

    rateLimit: new client.Gauge({
        name: 'notification_rate_limit',
        help: 'Current rate limit usage',
        labelNames: ['channel', 'priority']
    }),

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
    healthIssues: new client.Gauge({
        name: 'notification_health_issues',
        help: 'Total number of health issues',
        labelNames: ['channel', 'type'] // type can be 'warning' or 'error'
    }),

    criticalIssues: new client.Gauge({
        name: 'notification_critical_issues',
        help: 'Number of critical health issues',
        labelNames: ['channel']
    }),

    circuitBreaker: new client.Gauge({
        name: 'notification_circuit_breaker_status',
        help: 'Circuit breaker status (1 = closed/healthy, 0 = open/unhealthy)',
        labelNames: ['channel']
    }),

    maintenanceRuns: new client.Counter({
        name: 'notification_maintenance_runs_total',
        help: 'Total number of maintenance runs',
        labelNames: ['channel', 'type'] // type can be 'cleanup', 'requeue', 'health_check'
    }),

    maintenanceDuration: new client.Histogram({
        name: 'notification_maintenance_duration_seconds',
        help: 'Duration of maintenance operations',
        labelNames: ['channel', 'operation'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    }),

    recoveryActions: new client.Counter({
        name: 'notification_recovery_actions_total',
        help: 'Total number of automated recovery actions taken',
        labelNames: ['channel', 'action_type']
    })
};

register.registerMetric(notificationCounter);
register.registerMetric(notificationDuration);
register.registerMetric(queueSize);

Object.values(workerMetrics).forEach(metric => client.register.registerMetric(metric));
Object.values(queueMetrics).forEach(metric => client.register.registerMetric(metric));

export { register };