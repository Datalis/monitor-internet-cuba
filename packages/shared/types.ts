export interface Province {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export const CUBA_PROVINCES: Province[] = [
  { id: 'PRI', name: 'Pinar del Río', lat: 22.416, lng: -83.694 },
  { id: 'ART', name: 'Artemisa', lat: 22.813, lng: -82.763 },
  { id: 'HAB', name: 'La Habana', lat: 23.136, lng: -82.359 },
  { id: 'MAY', name: 'Mayabeque', lat: 22.896, lng: -81.988 },
  { id: 'MAT', name: 'Matanzas', lat: 23.041, lng: -81.577 },
  { id: 'CFG', name: 'Cienfuegos', lat: 22.149, lng: -80.440 },
  { id: 'VCL', name: 'Villa Clara', lat: 22.406, lng: -79.965 },
  { id: 'SSP', name: 'Sancti Spíritus', lat: 21.929, lng: -79.443 },
  { id: 'CAV', name: 'Ciego de Ávila', lat: 21.849, lng: -78.764 },
  { id: 'CMG', name: 'Camagüey', lat: 21.381, lng: -77.916 },
  { id: 'LTU', name: 'Las Tunas', lat: 20.963, lng: -76.951 },
  { id: 'HOL', name: 'Holguín', lat: 20.888, lng: -76.261 },
  { id: 'GRA', name: 'Granma', lat: 20.389, lng: -76.640 },
  { id: 'SCU', name: 'Santiago de Cuba', lat: 20.024, lng: -75.823 },
  { id: 'GTM', name: 'Guantánamo', lat: 20.141, lng: -74.908 },
  { id: 'IJV', name: 'Isla de la Juventud', lat: 21.711, lng: -82.831 },
];

export type DataSource = 'ooni' | 'cloudflare' | 'ripe-stat' | 'ioda' | 'ookla' | 'mlab' | 'crowdsourced';

export interface NormalizedMetric {
  timestamp: Date;
  metadata: {
    source: DataSource;
    province_id: string | null;
    country: 'CU';
  };
  blocking_rate?: number;
  download_mbps?: number;
  upload_mbps?: number;
  latency_ms?: number;
  bgp_prefix_count?: number;
  bgp_visibility_pct?: number;
  traffic_score?: number;
  outage_score?: number;
  outage_detected?: boolean;
  tests_count?: number;
  ok_count?: number;
  confirmed_count?: number;
  anomaly_count?: number;
  failure_count?: number;
  blocked_sites?: string[];
}

export interface AlertRule {
  id: string;
  field: string;
  condition: 'drops_below' | 'increases_by';
  threshold?: number;
  threshold_pct?: number;
  sustained_minutes?: number;
  message: string;
}

export interface Alert {
  _id?: string;
  rule_id: string;
  triggered_at: Date;
  message: string;
  current_value: number;
  threshold: number;
  sent_via: 'none';
}

export const ALERT_CONDITIONS: AlertRule[] = [
  {
    id: 'bgp_withdrawal',
    field: 'ripe-stat.bgp_prefix_count',
    condition: 'drops_below',
    threshold_pct: 70,
    message: '⚠️ Cuba: posible corte masivo. ETECSA retiró prefijos BGP.',
  },
  {
    id: 'ioda_outage',
    field: 'ioda.outage_score',
    condition: 'drops_below',
    threshold: 0.5,
    message: '🔴 Cuba: outage detectado por IODA (BGP + Darknet signals).',
  },
  {
    id: 'ooni_block_spike',
    field: 'ooni.blocking_rate',
    condition: 'increases_by',
    threshold_pct: 30,
    message: '🚫 Cuba: aumento de censura. Bloqueos subieron >30% esta semana.',
  },
  {
    id: 'speed_drop',
    field: 'ooni.download_mbps',
    condition: 'drops_below',
    threshold: 2.0,
    message: '🐢 Cuba: velocidad media cayó por debajo de 2 Mbps.',
  },
  {
    id: 'cloudflare_traffic_drop',
    field: 'cloudflare.traffic_score',
    condition: 'drops_below',
    threshold: 25,
    sustained_minutes: 15,
    message: '📉 Cuba: caída de tráfico HTTP detectada por Cloudflare Radar.',
  },
];

export const ETECSA_ASN = 'AS27725';
export const CUBA_BOUNDING_BOX = {
  minLat: 19.8,
  maxLat: 23.2,
  minLng: -85.0,
  maxLng: -74.1,
};
