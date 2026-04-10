'use client';

// ——— Activity definitions ———

interface Activity {
  icon: string;
  name: string;
  detail: string;
  minDown: number;   // Mbps
  minUp: number;     // Mbps
  maxLat: number;    // ms
  yes: string;
  maybe: string;
  no: string;
}

const ACTIVITIES: Activity[] = [
  { icon: '\u{1F4AC}', name: 'WhatsApp \u2014 texto y audio', detail: 'Mensajes, notas de voz, stickers', minDown: 0.05, minUp: 0.05, maxLat: 600, yes: 'Funciona bien', maybe: 'Va lento', no: 'Muy dificil' },
  { icon: '\u{1F4F8}', name: 'Enviar y recibir fotos', detail: 'Imagenes por WhatsApp o Telegram', minDown: 0.2, minUp: 0.2, maxLat: 500, yes: 'Sin problema', maybe: 'Demora', no: 'Muy lento' },
  { icon: '\u{1F310}', name: 'Navegar paginas web', detail: 'Cargar sitios, leer noticias', minDown: 0.5, minUp: 0.1, maxLat: 400, yes: 'Fluido', maybe: 'Lento', no: 'Casi imposible' },
  { icon: '\u{1F4F1}', name: 'Redes sociales (fotos)', detail: 'Facebook, Instagram sin video', minDown: 1, minUp: 0.3, maxLat: 350, yes: 'Bien', maybe: 'Con paciencia', no: 'No carga' },
  { icon: '\u{1F4DE}', name: 'Llamada de voz (WhatsApp)', detail: 'Audio en tiempo real', minDown: 0.1, minUp: 0.1, maxLat: 200, yes: 'Funciona', maybe: 'Entrecortado', no: 'No vale' },
  { icon: '\u{1F4F9}', name: 'Videollamada basica', detail: 'WhatsApp video, Telegram', minDown: 0.5, minUp: 0.5, maxLat: 160, yes: 'Funciona', maybe: 'Se traba', no: 'Imposible' },
  { icon: '\u{1F4F9}', name: 'Videollamada HD', detail: 'Zoom, Meet con buena imagen', minDown: 2.5, minUp: 2.5, maxLat: 100, yes: 'Sin problema', maybe: 'Imagen baja', no: 'Imposible' },
  { icon: '\u25B6', name: 'YouTube 240p / 360p', detail: 'Video de baja calidad', minDown: 0.5, minUp: 0, maxLat: 600, yes: 'Fluido', maybe: 'Pausa a veces', no: 'No carga' },
  { icon: '\u25B6', name: 'YouTube 720p HD', detail: 'Video en alta definicion', minDown: 4, minUp: 0, maxLat: 500, yes: 'Fluido', maybe: 'Pausa a veces', no: 'No carga' },
  { icon: '\u{1F4BC}', name: 'Trabajo remoto', detail: 'Docs, correo, videollamadas', minDown: 5, minUp: 2, maxLat: 130, yes: 'Productivo', maybe: 'Funciona justo', no: 'Muy dificil' },
  { icon: '\u{1F3AE}', name: 'Juegos en linea', detail: 'La latencia importa mas que la velocidad', minDown: 3, minUp: 1, maxLat: 80, yes: 'Jugable', maybe: 'Lag notable', no: 'Injugable' },
];

const FILES = [
  { icon: '\u{1F3B5}', name: 'Cancion MP3', sizeMB: 5 },
  { icon: '\u{1F5BC}', name: 'Foto alta res', sizeMB: 8 },
  { icon: '\u{1F4F1}', name: 'App movil (50 MB)', sizeMB: 50 },
  { icon: '\u{1F3AC}', name: 'Pelicula 480p', sizeMB: 700 },
  { icon: '\u{1F3AC}', name: 'Pelicula HD', sizeMB: 3500 },
];

// ——— Helpers ———

function evalActivity(a: Activity, dl: number, ul: number, lat: number): 'yes' | 'maybe' | 'no' {
  if (dl >= a.minDown && ul >= a.minUp && lat <= a.maxLat) return 'yes';
  if (dl >= a.minDown * 0.5 && ul >= a.minUp * 0.5 && lat <= a.maxLat * 2) return 'maybe';
  return 'no';
}

function mbpsToReadable(mbps: number): string {
  const kb = mbps * 125;
  if (kb >= 1000) return `${(kb / 1024).toFixed(2)} MB/s`;
  return `${Math.round(kb)} KB/s`;
}

function formatTime(seconds: number): string {
  if (seconds < 1) return '<1 seg';
  if (seconds < 60) return `${Math.round(seconds)} seg`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m} min ${s} seg` : `${m} min`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h} h ${m} min`;
}

function getVerdict(dl: number): {
  icon: string; title: string; text: string;
  bg: string; border: string; color: string;
} {
  if (dl >= 10) return {
    icon: '\u2705', title: 'Conexion buena',
    text: 'Puedes hacer practicamente todo: videollamadas, video HD, trabajo remoto. Disfrutala mientras dure.',
    bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', color: '#22c55e',
  };
  if (dl >= 4) return {
    icon: '\u{1F7E1}', title: 'Conexion decente',
    text: 'Navegar, redes sociales, videollamadas en baja calidad y video basico. Para trabajo remoto intensivo puede quedarse corto.',
    bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', color: '#f59e0b',
  };
  if (dl >= 1) return {
    icon: '\u{1F7E0}', title: 'Conexion basica funcional',
    text: 'WhatsApp, navegacion lenta, video muy basico. La realidad de muchos en Cuba. Elige bien que hacer con cada megabyte.',
    bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', color: '#f97316',
  };
  if (dl >= 0.1) return {
    icon: '\u{1F534}', title: 'Conexion muy limitada',
    text: 'Solo texto. WhatsApp de mensajes funciona a duras penas. Guarda las descargas para cuando mejore la senal.',
    bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: '#ef4444',
  };
  return {
    icon: '\u26AB', title: 'Apenas hay senal',
    text: 'Con menos de 0.1 Mbps es dificil hacer casi cualquier cosa. Puede ser la hora, la antena apagada, o tu ubicacion.',
    bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)', color: '#64748b',
  };
}

// ——— Styles ———

const styles = {
  section: {
    marginTop: 20,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700 as const,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
    marginBottom: 12,
  } as React.CSSProperties,
  card: {
    background: '#1e293b',
    borderRadius: 12,
    padding: 16,
  } as React.CSSProperties,
  // Conversion chips
  chipsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  } as React.CSSProperties,
  chip: {
    background: '#0f172a',
    borderRadius: 10,
    padding: '12px 10px',
    textAlign: 'center' as const,
    border: '1px solid #334155',
  } as React.CSSProperties,
  chipValue: {
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.1,
  } as React.CSSProperties,
  chipUnit: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
    marginTop: 4,
  } as React.CSSProperties,
  chipSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    fontFamily: 'monospace',
  } as React.CSSProperties,
  // Verdict
  verdict: {
    borderRadius: 10,
    padding: '14px 16px',
    marginTop: 12,
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    border: '1px solid',
  } as React.CSSProperties,
  verdictIcon: {
    fontSize: 22,
    flexShrink: 0,
    lineHeight: 1,
    marginTop: 2,
  } as React.CSSProperties,
  verdictTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  } as React.CSSProperties,
  verdictText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#94a3b8',
  } as React.CSSProperties,
  // Activity list
  actItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    marginBottom: 6,
    border: '1px solid #334155',
  } as React.CSSProperties,
  actIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  actInfo: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  actName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#e2e8f0',
  } as React.CSSProperties,
  actDetail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  } as React.CSSProperties,
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 100,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  // Download times
  dlGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: 8,
  } as React.CSSProperties,
  dlItem: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: 12,
    textAlign: 'center' as const,
  } as React.CSSProperties,
  dlIcon: {
    fontSize: 18,
    marginBottom: 4,
  } as React.CSSProperties,
  dlName: {
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    marginBottom: 6,
  } as React.CSSProperties,
  dlTime: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 700,
    color: '#e2e8f0',
  } as React.CSSProperties,
};

// ——— Component ———

interface SpeedAnalysisProps {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
}

export default function SpeedAnalysis({ downloadMbps, uploadMbps, latencyMs }: SpeedAnalysisProps) {
  const dl = downloadMbps;
  const ul = uploadMbps;
  const lat = latencyMs;

  const verdict = getVerdict(dl);

  const latColor = lat <= 50 ? '#22c55e' : lat <= 150 ? '#f59e0b' : '#ef4444';
  const latLabel = lat <= 50 ? 'Excelente' : lat <= 150 ? 'Aceptable' : 'Alta';

  const speedMBs = dl / 8; // MB/s for download time calc

  return (
    <div>
      {/* Conversion chips */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Tu velocidad convertida</div>
        <div style={{ ...styles.card, padding: 12 }}>
          <div style={styles.chipsGrid}>
            <div style={styles.chip}>
              <div style={{ ...styles.chipValue, color: '#3b82f6' }}>{dl.toFixed(1)}</div>
              <div style={styles.chipUnit}>Mbps bajada</div>
              <div style={styles.chipSub}>{mbpsToReadable(dl)}</div>
            </div>
            <div style={styles.chip}>
              <div style={{ ...styles.chipValue, color: '#8b5cf6' }}>{ul.toFixed(1)}</div>
              <div style={styles.chipUnit}>Mbps subida</div>
              <div style={styles.chipSub}>{mbpsToReadable(ul)}</div>
            </div>
            <div style={styles.chip}>
              <div style={{ ...styles.chipValue, color: latColor }}>{Math.round(lat)}</div>
              <div style={styles.chipUnit}>ms latencia</div>
              <div style={styles.chipSub}>{latLabel}</div>
            </div>
          </div>

          {/* Verdict */}
          <div style={{ ...styles.verdict, background: verdict.bg, borderColor: verdict.border }}>
            <div style={styles.verdictIcon}>{verdict.icon}</div>
            <div>
              <div style={{ ...styles.verdictTitle, color: verdict.color }}>{verdict.title}</div>
              <div style={styles.verdictText}>{verdict.text}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activities */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Que puedes hacer ahora mismo</div>
        <div style={styles.card}>
          {ACTIVITIES.map((a, i) => {
            const status = evalActivity(a, dl, ul, lat);
            const badgeStyles: Record<string, { bg: string; color: string; border: string }> = {
              yes: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'rgba(34,197,94,0.3)' },
              maybe: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
              no: { bg: 'rgba(100,116,139,0.1)', color: '#64748b', border: 'rgba(100,116,139,0.2)' },
            };
            const bs = badgeStyles[status];
            const label = status === 'yes' ? a.yes : status === 'maybe' ? a.maybe : a.no;

            return (
              <div
                key={i}
                style={{
                  ...styles.actItem,
                  background: status === 'yes' ? 'rgba(34,197,94,0.05)' :
                              status === 'maybe' ? 'rgba(245,158,11,0.05)' : '#0f172a',
                  borderColor: status === 'yes' ? 'rgba(34,197,94,0.15)' :
                               status === 'maybe' ? 'rgba(245,158,11,0.15)' : '#1e293b',
                  opacity: status === 'no' ? 0.5 : 1,
                }}
              >
                <div style={styles.actIcon}>{a.icon}</div>
                <div style={styles.actInfo}>
                  <div style={styles.actName}>{a.name}</div>
                  <div style={styles.actDetail}>{a.detail}</div>
                </div>
                <span style={{
                  ...styles.badge,
                  background: bs.bg,
                  color: bs.color,
                  border: `1px solid ${bs.border}`,
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Download times */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Cuanto tarda en descargar</div>
        <div style={{ ...styles.card, padding: 12 }}>
          <div style={styles.dlGrid}>
            {FILES.map((f, i) => {
              const seconds = f.sizeMB / speedMBs;
              return (
                <div key={i} style={styles.dlItem}>
                  <div style={styles.dlIcon}>{f.icon}</div>
                  <div style={styles.dlName}>{f.name}</div>
                  <div style={styles.dlTime}>{formatTime(seconds)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginTop: 10 }}>
            Tiempos estimados en condiciones ideales. Varian por congestion, hora del dia y antenas.
          </div>
        </div>
      </div>
    </div>
  );
}
