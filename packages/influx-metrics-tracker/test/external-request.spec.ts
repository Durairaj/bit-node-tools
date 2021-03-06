import { ExternalRequestMetricsTracker } from '../src/external-request';

describe('Track actions relating to consuming an event from Kafka', () => {
  let mockInflux: any;
  let mockLogger: any;
  let tracker: ExternalRequestMetricsTracker;

  beforeEach(() => {
    mockInflux = { writePoints: jest.fn().mockResolvedValue(undefined) };
    mockLogger = { error: jest.fn(), warn: jest.fn() };
    tracker = new ExternalRequestMetricsTracker(mockInflux, mockLogger);
  });

  it('Should track a request time without a status code', async () => {
    const externalServiceName = 'test-external-service';
    const requestName = 'test-request';
    const timeMs = 1234;

    await tracker.trackRequestTime(externalServiceName, requestName, timeMs);

    expect(mockInflux.writePoints).toHaveBeenLastCalledWith([
      {
        measurement: 'external-request-time',
        tags: {
          externalServiceName,
          requestName,
        },
        fields: {
          count: 1,
          timeMs: 1234,
        },
      },
    ]);
  });

  it.each([200, 404, 500])('Should track a request time with a status code: %d', async statusCode => {
    const externalServiceName = 'test-external-service';
    const requestName = 'test-request';
    const timeMs = 123;

    await tracker.trackRequestTime(externalServiceName, requestName, timeMs, statusCode);

    expect(mockInflux.writePoints).toHaveBeenLastCalledWith([
      {
        measurement: 'external-request-time',
        tags: {
          externalServiceName,
          requestName,
          status: statusCode.toString(10),
        },
        fields: {
          count: 1,
          timeMs: 123,
        },
      },
    ]);
  });

  it.each([[1234.5, 1235], [123.4, 123], [10, 10]])(
    'Should round response times to the nearest millisecond: %d',
    async (exactTime, expectedTrackedTime) => {
      const externalServiceName = 'test-external-service';
      const requestName = 'test-request';

      await tracker.trackRequestTime(externalServiceName, requestName, exactTime);

      expect(mockInflux.writePoints).toHaveBeenLastCalledWith([
        {
          measurement: 'external-request-time',
          tags: {
            externalServiceName,
            requestName,
          },
          fields: {
            count: 1,
            timeMs: expectedTrackedTime,
          },
        },
      ]);
    },
  );
});
