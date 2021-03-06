import { Schema, Type } from 'avsc';
import { TimestampType } from '../src';

describe('Unit test', () => {
  it('TimestampType convertion', async () => {
    const type = Type.forSchema(
      {
        type: 'record',
        fields: [{ name: 'startedAt', type: { type: 'long', logicalType: 'timestamp-millies' } }],
      } as Schema,
      { logicalTypes: { 'timestamp-millies': TimestampType } },
    );

    const values = [{ startedAt: new Date('2019-01-14T14:06:53Z') }, { startedAt: 1547474813000 }];
    const expected = [{ startedAt: '2019-01-14T14:06:53.000Z' }, { startedAt: '2019-01-14T14:06:53.000Z' }];

    const buffers = values.map(value => type.toBuffer(value));
    const converted = buffers.map(buffer => type.fromBuffer(buffer));

    expect(buffers[0]).toEqual(buffers[1]);
    expect(converted).toEqual(expected);
    expect(buffers).toMatchSnapshot();
  });

  it('Test resolve from long', () => {
    const type = Type.forSchema(
      {
        type: 'record',
        fields: [{ name: 'startedAt', type: { type: 'long', logicalType: 'timestamp-millies' } }],
      } as Schema,
      { logicalTypes: { 'timestamp-millies': TimestampType } },
    );

    const longType = Type.forSchema({
      type: 'record',
      fields: [{ name: 'startedAt', type: 'long' }, { name: 'name', type: 'string' }],
    } as Schema);

    const expected = { startedAt: '2019-01-14T14:06:53.000Z' };
    const longBuffer = longType.toBuffer({ startedAt: 1547474813000, name: 'test' });
    const resolver = type.createResolver(longType);
    const value = type.fromBuffer(longBuffer, resolver);

    expect(value).toEqual(expected);
  });

  it('Test invalid resolver', () => {
    const type = Type.forSchema(
      {
        type: 'record',
        fields: [{ name: 'startedAt', type: { type: 'long', logicalType: 'timestamp-millies' } }],
      } as Schema,
      { logicalTypes: { 'timestamp-millies': TimestampType } },
    );

    const longType = Type.forSchema({
      type: 'record',
      fields: [{ name: 'startedAt', type: 'string' }],
    } as Schema);

    expect(() => type.createResolver(longType)).toThrowError();
  });
});
