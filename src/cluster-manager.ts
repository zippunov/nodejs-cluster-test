import cluster from 'node:cluster';
import pino from 'pino';
import process from 'node:process';

type AsyncVoidFn = () => Promise<void>;

/**
 * Cluster manager provides starts NodeJs cluster with given number of workers.
 * Resulting cluster handles gracefully termination signals.
 */
export default class ClusterManager {
    private shutdownInProgress: boolean = false;
    private hasCleanWorkerExit: boolean = true;
    private readonly log: pino.BaseLogger;
    private readonly processName = `${cluster.isPrimary ? "primary" : "worker"} process ${process.pid}`;
    private readonly workersCount: number;
    private readonly workerStartFn: AsyncVoidFn;
    private readonly workerStopFn: AsyncVoidFn;

    private activeWorkersCount: number = 0;
    private listeningWorkersCount: number = 0;
    private  shutdownTimer: any;

    /**
     *
     * @param {number} workersCount - number of workers to create
     * @param {AsyncVoidFn} workerStartFn - anonymous async function bootstraps each worker
     * @param {AsyncVoidFn} workerStopFn - anonymous async function - graceful worker shutdown
     * @param {pino.BaseLogger} log - logger instance
     */
    constructor(workersCount: number, workerStartFn: AsyncVoidFn, workerStopFn:AsyncVoidFn, log: pino.BaseLogger) {
        this.workersCount = workersCount;
        this.workerStartFn = workerStartFn;
        this.workerStopFn = workerStopFn;
        this.log = log;
    }

    /**
     * Starts NodeJs cluster
     */
    public async start() {
        if (cluster.isPrimary) {
            await this.bootWorkers();
        } else {
            await this.workerStartFn();
        }
        process.on("SIGTERM", this.gracefulClusterShutdown("SIGTERM"));
        process.on("SIGINT", this.gracefulClusterShutdown("SIGINT"));
    }

    /**
     * bootWorkers: Main cluster process starts all dependent workers
     */
    private bootWorkers = async () => {
        this.log.info(`Setting ${this.workersCount} workers...`);

        for (let i = 0; i < this.workersCount; i++) {
            cluster.fork();
        }

        cluster.on('fork', worker => {
            this.activeWorkersCount++;
            worker.on('listening', () => {
                this.listeningWorkersCount++;
            });
            this.log.info('Cluster: worker ' + worker.process.pid + ' started.');
        });

        cluster.on("exit", (worker, code, signal) => {
            this.log.info(`worker ${worker.process.pid} exited with code ${code} and signal ${signal}`);
            if (this.shutdownInProgress && code != 0) {
                this.hasCleanWorkerExit = false;
            }
            this.activeWorkersCount--;
            this.listeningWorkersCount--;
            this.checkIfNoWorkersAndExit();
        });
    };

    /**
     * @function gracefulClusterShutdown handles cluster shutdown
     * @param {NodeJS.Signals} signal
     */
    private gracefulClusterShutdown = (signal: NodeJS.Signals) => async () => {
        if (this.shutdownInProgress) return;

        this.shutdownInProgress = true;
        this.hasCleanWorkerExit = true;

        this.log.info(`Got ${signal} on ${this.processName}. Graceful shutdown start.`);

        try {
            if (cluster.isPrimary) {
                this.checkIfNoWorkersAndExit();
                this.shutdownTimer = setTimeout(() => {
                    this.log.info('Cluster graceful shutdown: timeout, force exit.');
                    this.clusterExitFunction();
                }, 100000);
                for (const id in cluster.workers) {
                    const pid = cluster.workers[id]?.process.pid;
                    if (pid) process.kill(pid);
                }
            } else {
                await this.workerStopFn();
                this.log.info(`${this.processName} - shutdown successful`);
                process.exit(0);
            }
        } catch (e) {
            this.log.error(e);
            process.exit(1);
        }
    };

    private checkIfNoWorkersAndExit() {
        if (!this.activeWorkersCount) {
            this.log.info('Cluster graceful shutdown: done.');
            if (this.shutdownTimer) clearTimeout(this.shutdownTimer);
            this.clusterExitFunction();
        } else {
            const cnt = this.activeWorkersCount
            const suffix = this.activeWorkersCount > 1 ? 's' : '';
            this.log.info(`Cluster graceful shutdown: wait ${cnt} worker${suffix}.`);
        }
    }

    private clusterExitFunction() {
        this.log.info(`${this.processName} - shutdown successful`);
        process.exit(this.hasCleanWorkerExit ? 0 : 1);
    }
}
