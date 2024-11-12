export enum QueuePriority {
    CRITICAL = 'CRITICAL',
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

export interface QueueError {
    message: string;
    code?: string;
    stack?: string;
    timestamp: string;  // Adding timestamp to the type
}

export interface QueueConfig {
    maxAttempts: number;
    backoffDelay: number;
    priority: QueuePriority;
    ttl?: number;
}

export interface QueuedItem<T> {
    id: string;
    data: T;
    priority: QueuePriority;
    attemptCount: number;
    createdAt: Date;
    lastAttemptAt?: Date;
    nextAttemptAt?: Date;
    error?: QueueError[];  // Using the QueueError interface
}

export interface DeadLetterQueueItem<T> extends QueuedItem<T> {
    originalQueue: string;
    failedAt: Date;
    reason: string;
}

export interface QueueStats {
    priorityQueues: Record<QueuePriority, PriorityQueueStats>;
    dlq: DLQStats;
    processingItems: number;
}

export interface PriorityQueueStats {
    size: number;
    oldestItem: QueuedItem<any> | null;
    processingRate?: number;
    errorRate?: number;
}

export interface DLQStats {
    size: number;
    oldestItem: DeadLetterQueueItem<any> | null;
    recentFailures: number;
}

export interface RateLimitConfig {
    windowSeconds: number;
    maxRequests: number;
}

export interface QueueHealthStatus {
    healthy: boolean;
    metrics: {
        queueSizes: Record<QueuePriority, number>;
        dlqSize: number;
        processingItems: number;
        errorRate: number;
        processingRate: number;
    };
    issues: QueueHealthIssue[];
}

export interface QueueHealthIssue {
    type: 'ERROR' | 'WARNING';
    message: string;
    priority?: QueuePriority;
    metric?: string;
    threshold?: number;
    currentValue?: number;
}