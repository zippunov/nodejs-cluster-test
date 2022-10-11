import * as ff from 'fastify';
import fastifyView from "@fastify/view";
import ejs from  'ejs';



import QueueManager from './queue'

export function serverFactory(server: ff.FastifyInstance, queue: QueueManager, port: number) {

  server.register(fastifyView, {
    engine: { ejs },
  });

  server.get('/ui', function (req, res) {
    res.view("/templates/index.ejs", { port });
  })

  server.put('/data', async (req, res) => {
    res.send('OK');
    queue.enqueue({timestamp: new Date(), payload: req.body as string});
  });

  server.get('/health', async () => {
    return "OK";
  });

  return server;
}
