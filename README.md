# Pixaera assignment

## Architecture

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
