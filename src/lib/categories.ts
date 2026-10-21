import { norm } from './utils';

export interface Category {
  id: string;
  label: string;
  re: RegExp;
}

/** Categorías de alimentos (se prueban en este orden: gana la primera que encaja, así «tomate frito» es salsa y no verdura). */
export const CATEGORIES: Category[] = [
  { id: 'bebidas', label: 'Bebidas', re: /\bagua\b|zumo|refresco|cerveza|\bvino\b|\bcafe\b|\bte\b|infusion|bebida|\bcola\b|isotonic|gaseosa|tonica|leche (de )?(avena|soja|almendra|arroz|coco)/ },
  { id: 'dulces', label: 'Dulces y snacks', re: /chocolate|galleta|dulce|mermelada|\bmiel\b|azucar|helado|bollo|snack|barrita|cacao|golosina|caramelo|turron|bizcocho|croissant|donut|patatas fritas|palomitas/ },
  { id: 'salsas', label: 'Salsas, aceites y condimentos', re: /aceite|vinagre|salsa|ketchup|mayonesa|mostaza|\bsal\b|especia|pimenton|oregano|caldo|tomate frito|tomate triturado|pure de tomate|condimento|pesto|alino/ },
  { id: 'pescado', label: 'Pescado y marisco', re: /pescado|salmon|atun|sardina|merluza|bacalao|gamba|mejillon|berberecho|caballa|anchoa|calamar|pulpo|lubina|dorada|marisco|surimi|trucha|langostino|lenguado/ },
  { id: 'carne', label: 'Carnes y embutidos', re: /pollo|pavo|ternera|cerdo|jamon|chorizo|salchicha|salchichon|lomo|hamburguesa|\bcarne\b|bacon|beicon|fiambre|embutido|cordero|conejo|pechuga|muslo|fuet|mortadela|filete/ },
  { id: 'lacteos', label: 'Lácteos y huevos', re: /leche|yogur|queso|mantequilla|\bnata\b|kefir|requeson|skyr|huevo|natilla|cuajada|mozzarella|cottage/ },
  { id: 'legumbres', label: 'Legumbres y proteína vegetal', re: /lenteja|garbanzo|alubia|judias? (blanca|pinta)|soja texturizada|\btofu\b|tempeh|seitan|hummus|edamame/ },
  { id: 'fruta', label: 'Fruta', re: /platano|banana|manzana|\bpera\b|naranja|mandarina|limon|kiwi|fresa|\buva|melon|sandia|\bpina\b|arandano|frambuesa|mango|melocoton|cereza|fruta|aguacate|granada|pomelo|ciruela|higo|nectarina/ },
  { id: 'verdura', label: 'Verduras y hortalizas', re: /tomate|cebolla|lechuga|zanahoria|pimiento|espinaca|brocoli|calabacin|pepino|berenjena|coliflor|\bajos?\b|puerro|champin|\bseta|ensalada|verdura|judias verdes|esparrago|acelga|\bcol\b|apio|calabaza|patata|boniato|rucula|canonigo|remolacha|rabano|menestra/ },
  { id: 'cereales', label: 'Cereales, pan y pasta', re: /arroz|pasta|\bpan\b|pan de|avena|harina|cereal|cuscus|quinoa|tortita|fideo|macarron|espagueti|tortilla de trigo|wrap|muesli|tostada|maiz/ },
  { id: 'frutos-secos', label: 'Frutos secos y semillas', re: /almendra|\bnuez|nueces|anacardo|cacahuete|pistacho|avellana|pasas|datil|semilla|\bchia\b|\blino\b|frutos secos|sesamo|girasol/ },
  { id: 'conservas', label: 'Conservas y encurtidos', re: /\blata\b|conserva|\bbote\b|tarro|aceituna|encurtido|pepinillo|alcaparra/ },
  { id: 'suplementos', label: 'Suplementos y proteína en polvo', re: /proteina en polvo|whey|creatina|colageno|suplemento|batido de proteina/ },
];

export const OTHER_CATEGORY: Category = { id: 'otros', label: 'Otros', re: /$^/ };

/** Categoría de un producto: la elegida a mano o la deducida del nombre. */
export const categoryOf = (p: { name: string; category?: string }): Category => {
  if (p.category) return [...CATEGORIES, OTHER_CATEGORY].find((c) => c.id === p.category) ?? OTHER_CATEGORY;
  const n = norm(p.name);
  return CATEGORIES.find((c) => c.re.test(n)) ?? OTHER_CATEGORY;
};

export const ALL_CATEGORIES: Category[] = [...CATEGORIES, OTHER_CATEGORY];
