import Queue, {ProcessFunctionCb, QueueOptions} from 'better-queue';
import pino from 'pino';


export type QueueProps = Partial<QueueOptions<QueueItem, any>>;
export type ProcessFn = (item: QueueItem, cb:ProcessFunctionCb<any>) => Promise<any>;
export type HealthCheckFn = () => Promise<boolean>;
export type QueueItem = {timestamp: Date, payload: string};

/**
 * Class QueueManager.
 * Manages initialisation and graceful shutdown of In-Memory queue.
 * Queue getting paused if PG is not online.
 * Queue processes items in concurrent way.
 * Queue retries item processing several times with delay.
 */
export default class QueueManager {

    private readonly healthCheckFn: HealthCheckFn;
    private readonly queue: Queue;
    private readonly log;
    private healthy = true;
    private healthInterval: any;

    /**
     * QueueManager constructor
     * @param {QueueProps} props - queue settings
     * @param {ProcessFn} processFn - function to process each queue item
     * @param {HealthCheckFn} healthCheckFn - function for periodical system health check.
     * @param {pino.BaseLogger} log - logger instance
     */
    constructor(props: QueueProps, processFn: ProcessFn, healthCheckFn: HealthCheckFn, log: pino.BaseLogger) {
        this.log = log;
        this.healthCheckFn = healthCheckFn;
        this.healthInterval = setInterval(async () => {this.healthy = await healthCheckFn()}, 10000);
        props.precondition = cb => cb(null, this.healthy);
        props.preconditionRetryTimeout = 2000;
        this.queue = new Queue(processFn, props);
        this.queue.on('task_failed', (taskId, err) => {
            this.log.error(`Task ${taskId} failed.`, err)
        })
    }

    /**
     * Adds item to queue
     * @param {QueueItem} item
     */
    enqueue(item:QueueItem ){
        this.queue.push(item)
    }

    /**
     * @private
     * @returns {number} - current number of items in the queue
     */
    private size(): number {
        return (this.queue as any).length;
    }

    /**
     * Graceful queue shutdown.
     * @returns {Promise<void>}
     */
    public async close() {
        this.log.info(`Starting queue drain. Size: ${this.size()}`);
        if (this.size() > 0) {
            // if queue is not empty, wait for the 'drain' event
            await new Promise<void>(resolve => {
                this.queue.on('drain', () => resolve());
            });
        }

        // stop queue
        this.queue.removeAllListeners();
        await new Promise<void>(resolve => {
            this.queue.destroy(() => resolve());
        });
        // cleanup health check interval
        clearInterval(this.healthInterval);
        this.log.info('Queue closed.');
    }
}
