# Avro Stream

Serialize/deserialize [kafka-node](https://github.com/SOHU-Co/kafka-node) streams with [avro](https://avro.apache.org/docs/current/) data, using [confluent schema-registry](https://docs.confluent.io/current/schema-registry/docs/index.html) to hold the schemas.

### Using

```bash
yarn add @ovotech/avro-stream
```

Where `sourceStream` is a node readble stream, producing [kafka-node produce objects](https://github.com/SOHU-Co/kafka-node#sendpayloads-cb-1). With an additional "schema" key holding the avro schema.

If the schema for the topic does not exist inside the schema registry, it would be created. Unless the auto create topic has been set for kafka, it would not create the topic automatically. You'll need to create it yourself.

```typescript
import { AvroSerializer, AvroProduceRequest } from '@ovotech/avro-stream';
import { ReadableMock } from 'stream-mock';
import { ProducerStream } from 'kafka-node';

const data: AvroProduceRequest[] = [
  {
    topic: 'migration-completed',
    partition: 0,
    key: 'some-key',
    schema: {
      type: 'record',
      name: 'TestSchema',
      fields: [{ name: 'accountId', type: 'string' }],
    },
    messages: [{ accountId: '6666666' }, { accountId: '5555555' }],
  },
];

const sourceStream = new ReadableMock(data, { objectMode: true });
const producerStream = new ProducerStream({ kafkaClient: { kafkaHost: 'localhost:29092' } });
const serializer = new AvroSerializer('http://localhost:8081');

sourceStream.pipe(serializer).pipe(producerStream);
```

For deserializing avro kafka events:

```typescript
import { AvroDeserializer } from '@ovotech/avro-stream';
import { WritableMock } from 'stream-mock';
import { ConsumerGroupStream } from 'kafka-node';

const consumerStream = new ConsumerGroupStream(
  {
    kafkaHost: 'localhost:29092',
    groupId: 'my-group',
    encoding: 'buffer',
    fromOffset: 'earliest',
  },
  ['migration-completed'],
);
const deserializer = new AvroDeserializer('http://localhost:8081');
const sinkStream = new WritableMock({ objectMode: true });

consumerStream.pipe(deserializer).pipe(sinkStream);
```

## Custom schema registry implementations

The way avro serialization for kafka works is to embed the schema id as the first 5 bytes of the buffer so the buffer becomes `<id><avro serialized buffer>`. For that to work we need a resolver service that can do id->schema for deserializing and schema->id to serializing kafka events.

The default provided resolver is `SchemaRegistryresolver` using [confluent schema-registry](https://docs.confluent.io/current/schema-registry/docs/index.html) but you can write your own:

```typescript
import { AvroSerializer, AvroDeserializer, SchemaResolver } from '@ovotech/avro-stream';

class MyResolver implements SchemaResolver {
  async toId(topic: string, schema: Schema) {
    return ...
  }

  async fromId(id: number) {
    return ...
  }
}

const resolver = new MyResolver();
const serializer = new AvroSerializer(resolver);
const deserializer = new AvroDeserializer(resolver);
```

## Passing avro schema options

Sometimes you'll want to pass some options to the creation of the avro type from the schema, for example to pass in logical type resolvers. You can do that with the second argument to the constructors.

```typescript
import { AvroSerializer, AvroDeserializer } from '@ovotech/avro-stream';

const serializer new AvroSerializer('...', { logicalTypes: ... });
const deserializer new AvroDeserializer('...', { logicalTypes: ... });
```

## Errors

AvroSerializer can emit an `AvroSerializerError`, and subsequently AvroDeserializer - `AvroDeserializerError`. They are as follows:

### AvroSerializerError

| Property      | Description                                                                   |
| ------------- | ----------------------------------------------------------------------------- |
| message       | Original error message                                                        |
| chunk         | The event sent from the previous stream to be serialized (AvroProduceRequest) |
| encoding      | The buffer encoding                                                           |
| originalError | The original error object that was triggered                                  |

### AvroDeserializer

| Property      | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| message       | Original error message                                                     |
| chunk         | The event sent from the previous stream to be deserialized from kafka-node |
| encoding      | The buffer encoding                                                        |
| originalError | The original error object that was triggered                               |

Example error handling:

```typescript
import { AvroSerializer, AvroSerializerError } from '@ovotech/avro-stream';

const serializer new AvroSerializer('...');

serializer.on('error', (error: AvroSerializerError) => {
  console.log(error.chunk);
})
```

### AvroTopicSender

You can use an `AvroTopicSender` to produce ad-hock kafka messages.

```typescript
import { AvroSerializer, AvroTopicSender } from '@ovotech/avro-stream';
import { ProducerStream } from 'kafka-node';

interface Message {
  accountId: string;
}

const sender = new AvroTopicSender<Message>({
  topic: 'test-topic-1',
  partition: 0,
  key: 'key-1',
  schema: {
    type: 'record',
    name: 'TestSchema1',
    fields: [{ name: 'accountId', type: 'string' }],
  },
});

const producerStream = new ProducerStream({ kafkaClient: { kafkaHost: 'localhost:29092' } });
const serializer = new AvroSerializer('http://localhost:8081');

sender.pipe(serializer).pipe(producerStream);

sender.send({ accountId: '222' }, { accountId: '111' });
sender.close();
```

## Mocks

If you are writing tests for your kafka node streams, you would want to mock a stream of serialized objects, but you have only some produce requests. That's where you can use the `MockAvroSerializer` and `MockSchemaRegistryResolver`.

```typescript
import { DateType } from '@ovotech/avro-logical-types';
import { ReadableMock, WritableMock } from 'stream-mock';
import { AvroProduceRequest, MockAvroSerializer, MockSchemaRegistryResolver } from '@ovotech/avro-stream';

const sourceData: AvroProduceRequest[] = [];

const mockSchemaResolver = new MockSchemaRegistryResolver(sourceData);
const sourceStream = new ReadableMock(sourceData, { objectMode: true });
const sinkStream = new WritableMock({ objectMode: true });
const serializer = new MockAvroSerializer(mockSchemaResolver);

sourceStream.pipe(serializer).pipe(sinkStream);
```

You will get a serialized stream of kafka messages as if its coming from kafka-node itself.

## Gotchas

A thing to be aware of is that node streams unpipe in an event of an error, which means that you'll need to provide your own error handling and repipe the streams if you want it to be resilient to errors.

## Running the tests

The tests require a running schema registry service, kafka and zookeeper. This is setup easily with a docker-compose:

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
