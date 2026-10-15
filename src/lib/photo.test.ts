import { describe, it, expect } from 'vitest';
import { fitWithin, shrinkPhoto } from './photo';

describe('fitWithin', () => {
  it('scales the long edge of a portrait phone photo down to the cap', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('scales a landscape photo the same way', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('never scales a small photo up', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('rounds to whole pixels and never returns zero', () => {
    expect(fitWithin(5000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe('shrinkPhoto', () => {
  it('keeps the original when the photo cannot be decoded here', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3])], {
      type: 'image/jpeg',
    });
    expect(await shrinkPhoto(original)).toBe(original);
  });
});
