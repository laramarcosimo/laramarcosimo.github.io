/**
 * Cifrado opcional de lo que se sube a Supabase (copia de datos y fotos): AES-GCM de 256 bits con una clave derivada
 * de TU contraseña (PBKDF2, 200.000 vueltas). La contraseña se queda en este móvil; Supabase solo recibe datos ilegibles.
 * Si pierdes la contraseña, esa copia NO se puede recuperar (ni tú ni nadie).
 */
const PASS = 'apex-enc-pass';
const ON = 'apex-enc-on';

export const getPassphrase = (): string => {
  try {
    return localStorage.getItem(PASS) ?? '';
  } catch {
    return '';
  }
};
export const setPassphrase = (p: string): void => {
  try {
    if (p) localStorage.setItem(PASS, p);
    else localStorage.removeItem(PASS);
  } catch {
    /* sin almacenamiento */
  }
};
export const encryptionOn = (): boolean => {
  try {
    return localStorage.getItem(ON) === '1' && getPassphrase().length > 0;
  } catch {
    return false;
  }
};
export const setEncryption = (on: boolean): void => {
  try {
    localStorage.setItem(ON, on ? '1' : '0');
  } catch {
    /* noop */
  }
};

let cached: { pass: string; salt: string; key: CryptoKey } | null = null;
const keyFor = async (pass: string, salt: string): Promise<CryptoKey> => {
  if (cached && cached.pass === pass && cached.salt === salt) return cached.key;
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new TextEncoder().encode(`apex-coach:${salt}`), iterations: 200_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  cached = { pass, salt, key };
  return key;
};

const toB64 = (u: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b: string): Uint8Array<ArrayBuffer> => {
  const raw = atob(b);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export const PREFIX = 'enc1:';
export const isEncrypted = (s: unknown): s is string => typeof s === 'string' && s.startsWith(PREFIX);

/** Cifra bytes → «enc1:» + base64(iv + datos). `salt` = código de recuperación del dispositivo. */
export async function encryptBytes(bytes: Uint8Array<ArrayBuffer>, salt: string, pass = getPassphrase()): Promise<string> {
  if (!pass) throw new Error('Falta la contraseña de cifrado (Ajustes → Copias de seguridad y datos).');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(pass, salt), bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return PREFIX + toB64(out);
}

export async function decryptBytes(payload: string, salt: string, pass = getPassphrase()): Promise<Uint8Array<ArrayBuffer>> {
  if (!pass) throw new Error('Esta copia está cifrada: escribe tu contraseña de cifrado en Ajustes → Copias de seguridad y datos.');
  const raw = fromB64(payload.slice(PREFIX.length));
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await keyFor(pass, salt), raw.slice(12)));
  } catch {
    throw new Error('Contraseña de cifrado incorrecta (o la copia está dañada).');
  }
}

export const encryptText = (t: string, salt: string, pass?: string): Promise<string> => encryptBytes(new TextEncoder().encode(t) as Uint8Array<ArrayBuffer>, salt, pass);
export const decryptText = async (p: string, salt: string, pass?: string): Promise<string> => new TextDecoder().decode(await decryptBytes(p, salt, pass));
