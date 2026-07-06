import { describe, expect, it } from 'vitest';
import { LoopbackTransport, TransportRegistry } from './transport';

describe('TransportRegistry', () => {
  it('registers, lists, and creates transports', async () => {
    const reg = new TransportRegistry();
    expect(reg.has('loopback')).toBe(false);

    reg.register('loopback', () => new LoopbackTransport());
    expect(reg.has('loopback')).toBe(true);
    expect(reg.kinds()).toContain('loopback');

    const t = await reg.create('loopback');
    expect(t.kind).toBe('loopback');
  });

  it('rejects duplicate registration and unknown kinds', async () => {
    const reg = new TransportRegistry();
    reg.register('x', () => new LoopbackTransport());
    expect(() => reg.register('x', () => new LoopbackTransport())).toThrow(/already registered/);
    await expect(reg.create('nope')).rejects.toThrow(/No transport registered/);
  });
});

describe('LoopbackTransport', () => {
  it('echoes written bytes to subscribed readers and respects unsubscribe/close', async () => {
    const t = new LoopbackTransport();
    expect(t.isOpen).toBe(false);
    await t.open();
    expect(t.isOpen).toBe(true);

    const chunks: Uint8Array[] = [];
    const off = t.onData((c) => chunks.push(c));

    await t.write(new Uint8Array([1, 2, 3]));
    expect(chunks).toHaveLength(1);
    expect(Array.from(chunks[0])).toEqual([1, 2, 3]);

    off();
    await t.write(new Uint8Array([9]));
    expect(chunks).toHaveLength(1); // unsubscribed reader gets nothing more

    await t.close();
    expect(t.isOpen).toBe(false);
    await expect(t.write(new Uint8Array([1]))).rejects.toThrow(/not open/);
  });
});
