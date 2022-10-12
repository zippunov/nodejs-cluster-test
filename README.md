# Pixaera assignment

## Architecture

The two most critical assignment requirements dictate the architectural solution.

- Large payload size
- Requirement to respond to the REST API call without waiting for data to be saved.

This leads to the following consideration:

- Under high load, having a comparatively large request payload might block other REST calls while the NodeJS thread piping a large stream. It will be blocked not in a sense of Blocking IO but the incoming large stream always will be ready with the next buffer processing callbacks.

  So I decided to implement NodeJS Cluster with a set of identical NodeJS workers.

- As we respond immediately to client requests without saving data, we need to store collected data for further processing in the queue.

- Considering that this is just a coding exercise, not a real-world application, I am using the in-memory queue.

  In the real application, I would choose a real persistent queue like Kafka or NATS. e.t.c

- With this architecture, it becomes extremely important to have a proper graceful service shutdown.

![Architecture diagram](/doc/diagram.png)

## Web UI

Available at relative URL `/ui`

Writing frontends with bare JS and HTML was never my strong point.

I am quite comfortable with React or Svelte. But using those will significantly complicate project structure. So I decided against it.

I did try my best to make a basic frontend using an EJS template engine. The only purpose of using templates is to transfer application settings (namely service PORT number).

## Configuration

The application expects a number of environment variables to be set in order to run:

```text
PORT    - Service port (default 9932)
PG_USER - Postgres username (default 'postgres')
PG_PASS - Postgres password (default 'postgres')
PG_HOST - Postgres host (default 'localhost')
PG_PORT - Postgres port (default 5432)
PG_DB   - Postrgres database (default 'test')
```

## Database

During start-up, the service runs data migration creating (if not exist) a new table:

```SQL
CREATE TABLE IF NOT EXISTS post_data (
  "id" BIGINT NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "timestamp" TIMESTAMP NOT NULL,
  "data" TEXT
);
```

Again, there are a plethora of rich migration engines in the NodeJs universe. In the real-world scenario, I will use one of them. I have decided to go with the simplest working solution in order to avoid unnecessary project complications.

## How to run

- Ensure that nodeJs version is >= 16
- Install dependencies
```bash
npm install
```
- run service. (Web frontend will be automatically opened in 5 sec.)

```bash
PORT=8989 \
PG_USER=gosurf \
PG_PASS=gosurf \
PG_HOST=localhost \
PG_PORT=5432 \
PG_DB=surf \
npm run dev;
```

## Load Tests

I have created simple load test with `autocannon` framework. It sends ~4K requests in 10 seconds to the running service.
I have chosen random payload size to be 100Kb.

### Test execution

Run service:
```bash
PORT=8989 \
PG_USER=gosurf \
PG_PASS=gosurf \
PG_HOST=localhost \
PG_PORT=5432 \
PG_DB=surf \
npm run dev;
```
Run load test in the separate console window:
```bash
PORT=8989 npm run load-test
```
In 10 seconds resulting report is getting generated:
```bash

┌─────────┬───────┬───────┬───────┬───────┬──────────┬────────┬───────┐
│ Stat    │ 2.5%  │ 50%   │ 97.5% │ 99%   │ Avg      │ Stdev  │ Max   │
├─────────┼───────┼───────┼───────┼───────┼──────────┼────────┼───────┤
│ Latency │ 16 ms │ 18 ms │ 40 ms │ 50 ms │ 20.75 ms │ 7.2 ms │ 96 ms │
└─────────┴───────┴───────┴───────┴───────┴──────────┴────────┴───────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Req/Sec   │ 417     │ 417     │ 427     │ 456     │ 432     │ 12.82   │ 417     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Bytes/Sec │ 69.2 kB │ 69.2 kB │ 70.9 kB │ 75.7 kB │ 71.7 kB │ 2.13 kB │ 69.2 kB │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
┌──────┬───────┐
│ Code │ Count │
├──────┼───────┤
│ 200  │ 4320  │
└──────┴───────┘

┌────────────┬──────────────┐
│ Percentile │ Latency (ms) │
├────────────┼──────────────┤
│ 0.001      │ 15           │
├────────────┼──────────────┤
│ 0.01       │ 15           │
├────────────┼──────────────┤
│ 0.1        │ 15           │
├────────────┼──────────────┤
│ 1          │ 16           │
├────────────┼──────────────┤
│ 2.5        │ 16           │
├────────────┼──────────────┤
│ 10         │ 16           │
├────────────┼──────────────┤
│ 25         │ 17           │
├────────────┼──────────────┤
│ 50         │ 18           │
├────────────┼──────────────┤
│ 75         │ 20           │
├────────────┼──────────────┤
│ 90         │ 34           │
├────────────┼──────────────┤
│ 97.5       │ 40           │
├────────────┼──────────────┤
│ 99         │ 50           │
├────────────┼──────────────┤
│ 99.9       │ 61           │
├────────────┼──────────────┤
│ 99.99      │ 96           │
├────────────┼──────────────┤
│ 99.999     │ 96           │
└────────────┴──────────────┘

4k requests in 10.18s, 717 kB read
```
So we can see that with 100Kb payload average latency is about 21 milliseconds.
Totally we have sent 4320 requests in 10 seconds. All completed with status 200.
Postgres DB shows that all data was successfully saved in the table. 
