import Queue, {ProcessFunctionCb, QueueOptions} from 'better-queue';
import pino from "pino";


export type QueueProps = Partial<QueueOptions<QueueItem, any>>;
export type ProcessFn = (item: QueueItem, cb:ProcessFunctionCb<any>) => Promise<any>;
export type HealthCheckFn = () => Promise<boolean>;
export type QueueItem = {timestamp: Date, payload: string};


export default class QueueManager {

    private readonly healthCheckFn: HealthCheckFn;
    private readonly queue: Queue;
    private readonly log;
    private healthy = true;
    private healthInterval: any;

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

    enqueue(item:QueueItem ){
        this.queue.push(item)
    }

    private size(): number {
        return (this.queue as any).length;
    }

    public async close() {
        this.log.info(`Starting queue drain. Size: ${this.size()}`);
        if (this.size() > 0) {
            await new Promise<void>(resolve => {
                this.queue.on('drain', () => resolve());
            });
        }
        this.queue.removeAllListeners();
        await new Promise<void>(resolve => {
            this.queue.destroy(() => resolve());
        });
        clearInterval(this.healthInterval);
        this.log.info('Queue closed.');
    }
}
