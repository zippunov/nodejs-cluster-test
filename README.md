# Pixaera assignment

## Architecture

Two most critical requirements of the assignment dictates architectural solution.

- Large payload size
- Requirement to respond to the REST API call not waiting for data to be saved.

This leads to the following consideration:

- Under high load, having comparatively large request payload might block other REST calls while NodeJS thread piping large stream. It will be blocked not in a sense of Blocking IO but incoming large stream always will be ready with next buffer processing callbacks.

    So I decided to implement NodeJS with set of identical NodeJS workers.
- As we respond immediately to client request without saving data, we need to store collected data for further processing in the queue.

- Considering that this is just an coding exercise, not real world application, I am using in-memory queue.

    In the real application I would choose real persistent queue like Kafka.

- With this architecture it becomes extremely important to have a proper graceful service shutdown.

![Architecture diagram](/doc/diagram.png)

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
