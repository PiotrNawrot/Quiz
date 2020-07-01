#/bin/bash

npm run-script compile
npm run-script createdb
node dist/server/server.js &
npx mocha -t 20000 -r ts-node/register scripts/tests/tests.ts
kill %%
