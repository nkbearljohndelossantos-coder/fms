import { describe, it, expect } from 'vitest';
import { convertUnit } from '../server/services/unitConversionService.js';

describe('Unit Conversion Engine', () => {
  it('converts direct mass units (g to kg)', () => {
    const result = convertUnit('500', 'g', 'kg');
    expect(result).toBe('0.500000');
  });

  it('converts direct volume units (mL to L)', () => {
    const result = convertUnit('1500', 'mL', 'L');
    expect(result).toBe('1.500000');
  });

  it('converts volume to mass using density KG/L', () => {
    // 500 mL of liquid with density 1.050000 kg/L = 0.525000 kg
    const result = convertUnit('500', 'mL', 'kg', '1.050000');
    expect(result).toBe('0.525000');
  });

  it('converts mass to volume using density KG/L', () => {
    // 1.05 kg of liquid with density 1.050000 kg/L = 1.000000 L = 1000 mL
    const result = convertUnit('1.05', 'kg', 'mL', '1.050000');
    expect(result).toBe('1000.000000');
  });

  it('converts count to mass using unit weight', () => {
    // 10,000 capsules with unit weight of 0.0005 kg per capsule = 5 kg
    const result = convertUnit('10000', 'capsules', 'kg', '1.000000', '0.000500');
    expect(result).toBe('5.000000');
  });

  it('throws error when density is zero during w/v conversion', () => {
    expect(() => convertUnit('100', 'mL', 'kg', '0.000000')).toThrow(/cannot be zero/i);
  });

  it('throws error when unit weight is missing for count conversion', () => {
    expect(() => convertUnit('100', 'capsules', 'kg')).toThrow(/Unit weight is required/i);
  });
});
