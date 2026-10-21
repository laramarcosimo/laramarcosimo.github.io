import { describe, expect, it } from 'vitest';
import { addToPantry, askUnits, configureUnits, deductFromPantry, setPackQty, spendUnits, suggestUnits, syncPackUnits, unitsSummary } from '../lib/pantry';
import type { PantryItem } from '../lib/types';

const base = (over: Partial<PantryItem> = {}): PantryItem => ({ id: 'a', name: 'Pan Bimbo', qty: 1, ...over });

describe('despensa por unidades', () => {
  it('reconoce productos habituales por el nombre', () => {
    expect(suggestUnits('Pan Bimbo blanco')?.label).toBe('rebanadas');
    expect(suggestUnits('Salchichas de pavo')).toMatchObject({ per: 24, inner: 6 });
    expect(suggestUnits('Pechuga de pollo')?.label).toBe('pechugas');
    expect(suggestUnits('Aceite de oliva')).toBeUndefined();
  });

  it('un producto nuevo reconocido se añade con sus unidades', () => {
    const [p] = addToPantry([], ['Pan de molde']);
    expect(p.unitsPerPack).toBe(16);
    expect(p.units).toBe(16);
  });

  it('descuenta rebanadas, no el paquete entero', () => {
    const p = configureUnits(base(), 'rebanadas', 16);
    const after = spendUnits([p], 'a', 2);
    expect(after[0].units).toBe(14);
    expect(after[0].qty).toBe(1);
    expect(unitsSummary(after[0])).toBe('14 rebanadas');
  });

  it('el paquete se acaba al gastar la última unidad', () => {
    const p = configureUnits(base(), 'rebanadas', 2);
    expect(spendUnits(spendUnits([p], 'a', 1), 'a', 1)).toEqual([]);
  });

  it('con dos paquetes, gastar uno por uno baja los envases al vaciar el primero', () => {
    const p = configureUnits(base({ qty: 2 }), 'rebanadas', 16);
    expect(p.units).toBe(32);
    const after = spendUnits([p], 'a', 17)[0];
    expect(after.units).toBe(15);
    expect(after.qty).toBe(1);
  });

  it('packs dentro del envase: 4 packs de 6 salchichas', () => {
    const p = configureUnits(base({ name: 'Salchichas' }), 'salchichas', 24, 6);
    expect(unitsSummary(p)).toBe('4 packs de 6 · 24 salchichas');
    const after = spendUnits([p], 'a', 6)[0];
    expect(unitsSummary(after)).toBe('3 packs de 6 · 18 salchichas');
    expect(unitsSummary(spendUnits([after], 'a', 1)[0])).toBe('2 packs de 6 + 5 · 17 salchichas');
  });

  it('un ingrediente de una comida descuenta una unidad suelta', () => {
    const p = configureUnits(base({ name: 'Pechugas de pollo', qty: 1 }), 'pechugas', 3);
    const after = deductFromPantry([p], ['pechugas de pollo']);
    expect(after[0].units).toBe(2);
  });

  it('sin conteo por unidades sigue gastando envases', () => {
    const p: PantryItem = { id: 'b', name: 'Leche', qty: 2 };
    expect(spendUnits([p], 'b', 1)[0].qty).toBe(1);
    expect(spendUnits([{ ...p, qty: 1 }], 'b', 1)).toEqual([]);
  });

  it('añadir otro envase suma sus unidades; poner N envases los deja enteros', () => {
    const p = spendUnits([configureUnits(base(), 'rebanadas', 16)], 'a', 4)[0];
    const added = addToPantry([p], ['Pan Bimbo'])[0];
    expect(added.units).toBe(28);
    expect(added.qty).toBe(2);
    expect(setPackQty(added, 3)?.units).toBe(48);
    expect(setPackQty(added, 0)).toBeNull();
  });

  it('los productos que ya tenías reciben sus unidades al abrir la app', () => {
    const r = syncPackUnits([base({ qty: 2 }), { id: 'h', name: 'Huevos', qty: 6 }], undefined);
    expect(r.pantry[0].units).toBe(32);
    expect(r.pantry[1].unitsPerPack).toBeUndefined(); // huevos/pechugas: ya pueden estar contados por pieza
  });

  it('recuerda lo que lees o corriges y lo aplica al mismo producto después', () => {
    const corregido = configureUnits(base({ name: 'Tortitas de arroz Quaker' }), 'tortitas', 12);
    const aprendido = syncPackUnits([corregido], undefined);
    expect(Object.values(aprendido.packInfo ?? {})[0]).toMatchObject({ unitsPerPack: 12, unitLabel: 'tortitas' });
    const nuevo: PantryItem = { id: 'n', name: 'Tortitas de arroz Quaker', qty: 2 };
    const r = syncPackUnits([nuevo], aprendido.packInfo);
    expect(r.pantry[0].unitsPerPack).toBe(12);
    expect(r.pantry[0].units).toBe(24);
  });

  it('el producto de otra marca no hereda el dato', () => {
    const a = syncPackUnits([configureUnits(base({ name: 'Pan Bimbo' }), 'rebanadas', 22)], undefined);
    const r = syncPackUnits([{ id: 'x', name: 'Pan Hacendado', qty: 1 }], a.packInfo);
    expect(r.pantry[0].unitsPerPack).toBeUndefined();
  });

  it('si quitas el conteo no se vuelve a aplicar solo', () => {
    const off = configureUnits(configureUnits(base(), 'rebanadas', 16), '', 0);
    expect(syncPackUnits([off], undefined).pantry[0].unitsPerPack).toBeUndefined();
  });

  it('pregunta por huevos y pechugas, y deja de preguntar si contestas', () => {
    const lista: PantryItem[] = [{ id: 'h', name: 'Huevos', qty: 6 }, { id: 'p', name: 'Pechuga de pollo', qty: 3 }, base()];
    expect(askUnits(lista).map((x) => x.item.id)).toEqual(['h', 'p']);
    const no = configureUnits(lista[0], '', 0);
    expect(askUnits([no, lista[1]]).map((x) => x.item.id)).toEqual(['p']);
    const si = configureUnits(lista[1], 'pechugas', 3);
    expect(askUnits([si])).toHaveLength(0);
  });

  it('lo aprendido viaja en la copia de seguridad (JSON) y se conserva al restaurar', () => {
    const aprendido = syncPackUnits([configureUnits(base({ name: 'Pan Bimbo' }), 'rebanadas', 22)], undefined);
    const copia = JSON.parse(JSON.stringify({ pantry: aprendido.pantry, packInfo: aprendido.packInfo })) as { pantry: PantryItem[]; packInfo: Record<string, never> };
    const r = syncPackUnits(copia.pantry, copia.packInfo);
    expect(r.pantry[0].unitsPerPack).toBe(22);
    expect(Object.keys(r.packInfo ?? {})).toHaveLength(1);
  });

  it('sin cambios devuelve las mismas referencias', () => {
    const list = [{ id: 'l', name: 'Leche', qty: 2 }];
    const r = syncPackUnits(list, undefined);
    expect(r.pantry).toBe(list);
    expect(r.packInfo).toBeUndefined();
  });

  it('quitar el conteo por unidades limpia los campos', () => {
    const p = configureUnits(configureUnits(base(), 'rebanadas', 16), '', 0);
    expect(p.unitsPerPack).toBeUndefined();
    expect(p.units).toBeUndefined();
  });
});
