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

## This is still WIP.

- proper README documentation
- load test

Will be added later today. I take seriously those things, just have to manage my time bewteen work and family.

## How to run

- Ensure that nodeJs version is >= 16
- Install dependencies
```bash
npm install
```
- run service. (Web application will be automatically opened in 5 sec.)

```bash
PORT=8989 \
PG_USER=gosurf \
PG_PASS=gosurf \
PG_HOST=localhost \
PG_PORT=5432 \
PG_DB=surf \
npm run dev;
```
