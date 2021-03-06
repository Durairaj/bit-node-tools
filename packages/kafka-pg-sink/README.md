# PG Stream

Store [kafka-node](https://github.com/SOHU-Co/kafka-node) events into a postgres database.

### Using

```bash
yarn add @ovotech/kafka-pg-sink
```

Each topic from the consumer stream gets its own "resolver" function that converts the message to an array of values, directly inserted as columns in the database.

```sql
INSERT INTO tableName VALUES (column1Value, column2Value ...) ON CONFLICT DO NOTHING
```

```typescript
import { PGSinkStream, Message } from '@ovotech/kafka-pg-sink';
import { ConsumerGroupStream } from 'kafka-node';
import { Client } from 'pg';

const consumerStream = new ConsumerGroupStream(
  { kafkaHost: 'localhost:29092', groupId: 'my-group', encoding: 'buffer' },
  ['migration-completed'],
);

const pg = new Client('postgresql://postgres:dev-pass@0.0.0.0:5432/postgres');
const pgSink = new PGSinkStream({
  pg,
  topics: {
    'migration-completed': {
      table: 'migration_completed',
      resolver: (message: Message) => {
        const data = getDataSomehow(message.value);
        return [data.column1, data.column2, data];
      },
    },
  },
});

consumerStream.pipe(pgSink);
```

`Message` is the same as the type from `kafka-node`, but is more lenient on the "value field". This allows you to pre-process the message before sending it off to pg-sink, by deserializing an using avro for example.

```typescript
export interface Message {
  topic: string;
  value: any;
  offset?: number;
  partition?: number;
  highWaterOffset?: number;
  key?: string;
}
```

## Usage with a deserializer

You can transform kafka events with a transform stream before they arrive to the sink. For example with `@ovotech/avro-stream`.

```typescript
import { AvroDeserializer, AvroMessage } from '@ovotech/avro-stream';
import { PGSinkStream } from '@ovotech/kafka-pg-sink';
import { ConsumerGroupStream } from 'kafka-node';

const consumerStream = new ConsumerGroupStream(
  { kafkaHost: 'localhost:29092', groupId: 'my-group', encoding: 'buffer' },
  ['migration-completed'],
);
const deserializer = new AvroDeserializer('http://localhost:8080');
const pg = new Client('postgresql://postgres:dev-pass@0.0.0.0:5432/postgres');
const pgSink = new PGSinkStream({
  pg,
  topics: {
    'migration-completed': {
      table: 'migration_completed',
      resolver: (message: AvroMessage) => [message.value.accountId],
    },
  },
});

consumerStream.pipe(deserializer).pipe(pgSink);
```

## Errors

PGSinkStream can emit an `PGSinkError` and `PGSinkMultipleError` depending on whether it was processing batched or normal requests.

### PGSinkError

| Property      | Description                                                                   |
| ------------- | ----------------------------------------------------------------------------- |
| message       | Original error message                                                        |
| chunk         | The event sent from the previous stream to be saved to the database (Message) |
| encoding      | The buffer encoding                                                           |
| originalError | The original error object that was triggered                                  |

### PGSinkMultipleError

| Property      | Description                                                |
| ------------- | ---------------------------------------------------------- |
| message       | Original error message                                     |
| chunks        | An array of `{ chunk: Message, encoding: string }` objects |
| originalError | The original error object that was triggered               |

Example error handling:

```typescript
import { PGSinkStream, PGSinkError, PGSinkMultipleError } from '@ovotech/kafka-pg-sink';

const pgSink = new PGSinkStream();

pgSink.on('error', (error: PGSinkError | PGSinkMultipleError) => {
  if (error instanceof PGSinkError) {
    console.log(error.chunk);
  }
});
```

## Gotchas

A thing to be aware of is that node streams unpipe in an event of an error, which means that you'll need to provide your own error handling and repipe the streams if you want it to be resilient to errors.

## Running the tests

The tests require a running postgres database. This is setup easily with a docker-compose from root project folder:

```bash
docker-compose up
```

Then you can run the tests with:

```bash
yarn test
```

### Coding style (linting, etc) tests

Style is maintained with prettier and tslint

```
yarn lint
```

## Deployment

Deployment is preferment by lerna automatically on merge / push to master, but you'll need to bump the package version numbers yourself. Only updated packages with newer versions will be pushed to the npm registry.

## Contributing

Have a bug? File an issue with a simple example that reproduces this so we can take a look & confirm.

Want to make a change? Submit a PR, explain why it's useful, and make sure you've updated the docs (this file) and the tests (see [test folder](test)).

## License

This project is licensed under Apache 2 - see the [LICENSE](LICENSE) file for details
