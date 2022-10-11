import {cpus} from 'node:os';
import cluster from 'node:cluster';
import {serverFactory} from './server';
import * as ff from 'fastify';
import ClusterManager from './cluster-manager';
import migratePostgres from './db/pg-migration';
import QueueManager, {ProcessFn, QueueProps} from "./queue";
import {PoolConfig} from 'pg';
import * as dao from './db/dao'
import open from 'open';

/**
 * Main initialization of the service.
 *
 * Service is composed as a Primary process which handles number of Workers.
 * Each worker has initialized independent Fastify instance, jobs queue and Postgres pool.
 * All workers listen to the single service port managed by the Primary process.
 */


/* Main configuration parameters */
const pgPoolSize = 5;

const port: number = process.env.PORT ? parseInt(process.env.PORT) : 9932;

const pgPoolConfig: PoolConfig = {
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASS || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5432,
    database: process.env.PG_DB || 'test',
    max: pgPoolSize * 2,
    min: pgPoolSize / 2
}

const queueProps: QueueProps = {
    concurrent: pgPoolSize,
    maxRetries: 5,
    retryDelay: 1000
}

let fastifyInstance: ff.FastifyInstance = ff.fastify({
    logger: true,
});

let queue: QueueManager;

/**
 * Each worker process will be initialized by the workerBootstrap function.
 */
const workerBootstrap = async () => {
    // init persistence with PG pool
    await dao.init(pgPoolConfig, fastifyInstance.log);

    // function used by the processing queue to store received data
    const processFn: ProcessFn = async (item, cb) => {
        let err = null;
        try {
            await dao.saveData(item.timestamp, item.payload);
        } catch (e) {
            fastifyInstance.log.error(e);
            err = e;
        }
        cb(err);
    }

    // Queue holds data collected by the REST endpoint. Data will be consumed by the processFn
    queue = new QueueManager(queueProps, processFn, dao.pgHealthCheck(fastifyInstance.log), fastifyInstance.log);

    // Init REST endpoint and web app endpoint
    fastifyInstance = serverFactory(fastifyInstance, queue, port);

    // start service instance
    fastifyInstance.listen({ port }, (err) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
    });
};

/**
 * workerStopFn handles graceful shutdown of single worker.
 * We have to ensure that all data collected in the Queue successfully saved in PG
 * order of shutdown:
 * - REST endpoints
 * - awaiting queue to be drained
 * - closing PG pool
 */
const workerStopFn = async () => {
    await fastifyInstance.close();
    await queue.close();
    fastifyInstance.log.info('Closing PG pool ...');
    await dao.close();
    fastifyInstance.log.info('PG pool closed.');
};

/**
 * main entry point
 */
;(async () => {
    // if this is primary process of the cluster - prepare PG table
    if (cluster.isPrimary) {
        await migratePostgres(pgPoolConfig);
    }
    const workersCount = Math.min(cpus().length, 5);

    /*
     * All workers management implemented withing Cluster Manager.
     * It handles creation and bootstraping Worker processes and their graceful shutdown.
     */

    const clusterManager = new ClusterManager(workersCount, workerBootstrap, workerStopFn, fastifyInstance.log);
    await clusterManager.start();

    /**
     * For easier usage - open browser window with application UI.
     */
    if (cluster.isPrimary) {
        setTimeout(async () => {
            try {
                await open(`http://localhost:${port}/ui`);
            } catch (err) {
                // do nothing;
            }
        }, 5000);
    }
})();
