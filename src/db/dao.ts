import {Pool, PoolConfig, QueryResult} from 'pg';
import pino from 'pino';

const DATA_INSERT_QUERY = 'INSERT INTO post_data ("timestamp", "data") VALUES ($1, $2)';
let poolInstance: Pool;

export async function init(config: PoolConfig, log: pino.BaseLogger) {
    const pool = new Pool(config);
    const client = await pool.connect();
    client.release();
    log.info('Postgres connected');
    poolInstance = pool;
}

export async function close() {
    if (!poolInstance) return;
    await poolInstance.end();
}

export async function saveData(timestamp: Date, data: string): Promise<QueryResult> {
    if (!poolInstance) throw new Error('DAO not initialized');
    return await poolInstance.query(DATA_INSERT_QUERY, [timestamp, data]);
}

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
