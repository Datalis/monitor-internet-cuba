// Canonical catalogue of Cuban provinces, in official west-to-east order.
export const PROVINCES = [
  { id: 'PRI', name: 'Pinar del Río' },
  { id: 'ART', name: 'Artemisa' },
  { id: 'HAB', name: 'La Habana' },
  { id: 'MAY', name: 'Mayabeque' },
  { id: 'MAT', name: 'Matanzas' },
  { id: 'CFG', name: 'Cienfuegos' },
  { id: 'VCL', name: 'Villa Clara' },
  { id: 'SSP', name: 'Sancti Spíritus' },
  { id: 'CAV', name: 'Ciego de Ávila' },
  { id: 'CMG', name: 'Camagüey' },
  { id: 'LTU', name: 'Las Tunas' },
  { id: 'HOL', name: 'Holguín' },
  { id: 'GRA', name: 'Granma' },
  { id: 'SCU', name: 'Santiago de Cuba' },
  { id: 'GTM', name: 'Guantánamo' },
  { id: 'IJV', name: 'Isla de la Juventud' },
] as const;

export const PROVINCE_IDS = new Set(PROVINCES.map(p => p.id as string));

export const PROVINCE_NAMES: Record<string, string> =
  Object.fromEntries(PROVINCES.map(p => [p.id, p.name]));

export const PROVINCE_ORDER: Record<string, number> =
  Object.fromEntries(PROVINCES.map((p, i) => [p.id, i]));
