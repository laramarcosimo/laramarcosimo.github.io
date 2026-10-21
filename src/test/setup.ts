// Las funciones de la app guardan cosas en localStorage: en las pruebas (sin navegador) basta una versión en memoria.
const mem: Record<string, string> = {};
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => void (mem[k] = String(v)),
    removeItem: (k: string) => void delete mem[k],
    clear: () => Object.keys(mem).forEach((k) => delete mem[k]),
  },
});
