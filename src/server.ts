import * as ff from 'fastify';
import fastifyView from '@fastify/view';
import ejs from  'ejs';
import QueueManager from './queue'

/**
 * Factory function. It gets Fastify instance, defines endpoints, and returns instance back.
 * @param {ff.FastifyInstance} server - Fastify instance
 * @param {QueueManager} queue - instance of the queue used in the REST endpoint business logic.
 * @param {number} port - service port number
 */
export function serverFactory(server: ff.FastifyInstance, queue: QueueManager, port: number) {

  /* Register templating engine for Web UI*/
  server.register(fastifyView, {
    engine: { ejs },
  });

  /* Web UI endpoint*/
  server.get('/ui', function (req, res) {
    res.view("/templates/index.ejs", { port });
  })

  /* REST endpoint to receive random string payload */
  server.put('/data', async (req, res) => {
    res.send('OK');
    queue.enqueue({timestamp: new Date(), payload: req.body as string});
  });

  /* REST health check endpoint (not used so far) */
  server.get('/health', async () => {
    return "OK";
  });

  return server;
}
