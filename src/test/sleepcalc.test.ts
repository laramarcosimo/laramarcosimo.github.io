import { describe, expect, it } from 'vitest';
import { parseHM, sleepCalc } from '../lib/sleepCalc';

describe('sleepCalc', () => {
  it('cruza la medianoche y resta 30 min', () => {
    expect(sleepCalc('23:30', '07:30')?.sleepH).toBe(7.5);
    expect(sleepCalc('23:30', '07:30')?.inBedH).toBe(8);
  });
  it('mismo día', () => {
    expect(sleepCalc('01:00', '08:00')?.sleepH).toBe(6.5);
  });
  it('no baja de 0', () => {
    expect(sleepCalc('07:00', '07:10')?.sleepH).toBe(0);
  });
  it('horas inválidas', () => {
    expect(parseHM('25:00')).toBeNull();
    expect(sleepCalc('', '07:00')).toBeNull();
  });
});
