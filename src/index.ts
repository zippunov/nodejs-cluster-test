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

const workerBootstrap = async () => {
    await dao.init(pgPoolConfig, fastifyInstance.log);

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

    queue = new QueueManager(queueProps, processFn, dao.pgHealthCheck(fastifyInstance.log), fastifyInstance.log);

    fastifyInstance = serverFactory(fastifyInstance, queue, port);

    fastifyInstance.listen({ port }, (err) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
    });
};

const workerStopFn = async () => {
    await fastifyInstance.close();
    await queue.close();
    fastifyInstance.log.info('Closing PG pool ...');
    await dao.close();
    fastifyInstance.log.info('PG pool closed.');
};

;(async () => {
    if (cluster.isPrimary) {
        await migratePostgres(pgPoolConfig);
    }
    const workersCount = Math.min(cpus().length, 5);

    const clusterManager = new ClusterManager(workersCount, workerBootstrap, workerStopFn, fastifyInstance.log);
    await clusterManager.start();
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
