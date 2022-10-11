import {Pool, PoolConfig, QueryResult} from 'pg';
import pino from 'pino';

/**
 * Module that handles persistence operation.
 * - Creates and shudowns PG pool
 * - provides business persistence functions
 * - provides PG health check
 */

const DATA_INSERT_QUERY = 'INSERT INTO post_data ("timestamp", "data") VALUES ($1, $2)';
let poolInstance: Pool;

/**
 * PG pool initialization
 * @param {PoolConfig} config
 * @param {pino.BaseLogger} log - logger instance
 * @returns {Promise<void>}
 */
export async function init(config: PoolConfig, log: pino.BaseLogger) {
    const pool = new Pool(config);
    const client = await pool.connect();
    client.release();
    log.info('Postgres connected');
    poolInstance = pool;
}

/**
 * PG pool shutdown
 * @returns {Promise<void>}
 */
export async function close() {
    if (!poolInstance) return;
    await poolInstance.end();
}

/**
 * Function saveData stores business data received from the REST endpoints delivered through the queue
 * @param {Date} timestamp
 * @param {string} data
 * @returns {Promise<QueryResult>}
 */
export async function saveData(timestamp: Date, data: string): Promise<QueryResult> {
    if (!poolInstance) throw new Error('DAO not initialized');
    return await poolInstance.query(DATA_INSERT_QUERY, [timestamp, data]);
}

/**
 * pgHealthCheck - provides very basic PG health check
 * @param {pino.BaseLogger} log - logger instance
 */
export function pgHealthCheck(log: pino.BaseLogger): () => Promise<boolean> {
    return async () => {
        try {
            await poolInstance.query('SELECT now()');
            log.info('Postrges pool healthy');
            return true;
        } catch(err) {
            log.error('PG health checl error', err);
            return false;
        }
    };
}
