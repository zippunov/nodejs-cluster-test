'use strict'
const webcrypto = require('node:crypto').webcrypto;
const autocannon = require('autocannon');

const port = process.env.PORT ? parseInt(process.env.PORT) : 9932;

function generatePayload() {
    const length = 100*1024;
    let payload = '';
    while(payload.length < length) {
        const array = new Uint32Array(500);
        webcrypto.getRandomValues(array);
        payload += array.join('');
    }
    return payload;
}

async function bench() {
    try {
        const result = await autocannon({
            title: 'Pixaera assignment autocannon test',
            url: `http://localhost:${port}`,
            // amount: 20,
            requests: [
                {
                    method: 'PUT',
                    path: '/data',
                    setupRequest: (req) => {
                        req.body = generatePayload();
                        return req
                    }
                }
            ],
            setupClient: (client) => {
                client.setHeaders({ 'Content-Type': 'text/plain', 'Accept': 'text/plain' })
            }
        });
        const out = autocannon.printResult(result, {
            renderResultsTable: true,
            renderLatencyTable: true,
            renderStatusCodes: true
        });
        console.log(out);
        console.log()
    } catch (err) {
        console.error(err);
    }

}

bench();
