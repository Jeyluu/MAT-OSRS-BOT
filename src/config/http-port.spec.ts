import { getHttpPort } from './http-port';

describe('getHttpPort', () => {
  it('uses the default HTTP port when PORT is missing or blank', () => {
    expect(getHttpPort(undefined)).toBe(3000);
    expect(getHttpPort('')).toBe(3000);
  });

  it('parses a valid port from the environment', () => {
    expect(getHttpPort('3001')).toBe(3001);
    expect(getHttpPort(8080)).toBe(8080);
  });

  it('rejects invalid TCP ports', () => {
    expect(() => getHttpPort('0')).toThrow('PORT doit etre un entier');
    expect(() => getHttpPort('65536')).toThrow('PORT doit etre un entier');
    expect(() => getHttpPort('3000.5')).toThrow('PORT doit etre un entier');
  });
});
