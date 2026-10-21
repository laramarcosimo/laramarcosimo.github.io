import { describe, expect, it } from 'vitest';
import { decryptBytes, decryptText, encryptBytes, encryptText, isEncrypted } from '../lib/crypto';

describe('cifrado', () => {
  it('cifra y descifra texto y bytes', async () => {
    const c = await encryptText('{"peso":62}', 'dev-1', 'mi-clave-larga');
    expect(isEncrypted(c)).toBe(true);
    expect(c).not.toContain('peso');
    expect(await decryptText(c, 'dev-1', 'mi-clave-larga')).toBe('{"peso":62}');
    const b = new Uint8Array([1, 2, 3, 250]);
    expect(Array.from(await decryptBytes(await encryptBytes(b, 'dev-1', 'x12345678'), 'dev-1', 'x12345678'))).toEqual([1, 2, 3, 250]);
  });
  it('falla con otra contraseña u otro código', async () => {
    const c = await encryptText('hola', 'dev-1', 'clave-uno');
    await expect(decryptText(c, 'dev-1', 'clave-dos')).rejects.toThrow('incorrecta');
    await expect(decryptText(c, 'dev-2', 'clave-uno')).rejects.toThrow('incorrecta');
  });
  it('dos cifrados del mismo texto no son iguales (iv aleatorio)', async () => {
    expect(await encryptText('a', 's', 'clave-uno')).not.toBe(await encryptText('a', 's', 'clave-uno'));
  });
});
