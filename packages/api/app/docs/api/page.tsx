import type { Metadata } from 'next';
import { PROVINCES } from '@/lib/provinces';

const BASE = 'https://internet.cubapk.com';

export const metadata: Metadata = {
  title: 'API de velocidad por provincia — Cuba Internet Monitor',
  description:
    'Documentación de la API REST de Cuba Internet Monitor: velocidades de internet medidas por usuarios en cada provincia de Cuba, con rangos de fecha y autenticación por API key.',
  alternates: { canonical: `${BASE}/docs/api` },
  openGraph: {
    title: 'API de velocidad por provincia — Cuba Internet Monitor',
    description:
      'Velocidades de internet medidas por usuarios en cada provincia de Cuba. API REST con rangos de fecha, JSON y CSV.',
    url: `${BASE}/docs/api`,
    siteName: 'Cuba Internet Monitor',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: 'Cuba Internet Monitor' }],
  },
  twitter: { card: 'summary_large_image' },
};

const C = {
  bg: '#0f172a',
  panel: '#16213a',
  panelAlt: '#111c30',
  border: '#27354f',
  text: '#e2e8f0',
  muted: '#93a3b8',
  accent: '#38bdf8',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
};

function Code({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: C.panelAlt,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '14px 16px',
        overflowX: 'auto',
        fontSize: 13,
        lineHeight: 1.6,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        margin: '12px 0',
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

function K({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        background: '#1e2a44',
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: '1px 5px',
        fontSize: '0.88em',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        color: C.accent,
      }}
    >
      {children}
    </code>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginTop: 48, scrollMarginTop: 24 }}>
      <h2 style={{ fontSize: 22, margin: '0 0 14px', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head?: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '14px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 520 }}>
        {head && <thead>
          <tr>
            {head!.map(h => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderBottom: `1px solid ${C.border}`,
                  color: C.muted,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        margin: '10px 0 16px',
      }}
    >
      <span
        style={{
          background: C.green,
          color: '#06281d',
          fontWeight: 700,
          fontSize: 12,
          padding: '3px 8px',
          borderRadius: 4,
          letterSpacing: 0.5,
        }}
      >
        {method}
      </span>
      <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 14 }}>{path}</span>
    </div>
  );
}

function Note({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: React.ReactNode }) {
  const color = tone === 'warn' ? C.amber : C.accent;
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        background: 'rgba(56,189,248,0.06)',
        borderRadius: '0 6px 6px 0',
        padding: '10px 14px',
        margin: '14px 0',
        fontSize: 14,
        lineHeight: 1.65,
      }}
    >
      {children}
    </div>
  );
}

const COMMON_PARAMS: React.ReactNode[][] = [
  [
    <K key="k">from</K>,
    'fecha o ISO 8601',
    <>
      Inicio del rango, incluido. Acepta <K>YYYY-MM-DD</K> (se interpreta como el comienzo de ese día en la zona{' '}
      <K>tz</K>) o una marca de tiempo ISO 8601 completa. Por omisión: 7 días antes de <K>to</K>.
    </>,
  ],
  [
    <K key="k">to</K>,
    'fecha o ISO 8601',
    <>
      Fin del rango. Si pasas una fecha <K>YYYY-MM-DD</K> el día se incluye completo; si pasas una marca de tiempo
      ISO 8601 se usa como límite superior exclusivo. Por omisión: ahora.
    </>,
  ],
  [
    <K key="k">days</K>,
    'entero 1–366',
    <>
      Atajo para «los últimos N días hasta ahora». No se puede combinar con <K>from</K>/<K>to</K>.
    </>,
  ],
  [
    <K key="k">province</K>,
    'lista',
    <>
      Códigos de provincia separados por coma, p. ej. <K>HAB,SCU</K>. Si se omite, devuelve las 16.
    </>,
  ],
  [
    <K key="k">tz</K>,
    'zona IANA',
    <>
      Zona horaria con la que se resuelven las fechas y se agrupan los días. Por omisión{' '}
      <K>America/Havana</K>.
    </>,
  ],
  [
    <K key="k">include_timed_out</K>,
    'booleano',
    <>
      Incluir los tests que expiraron por lentitud. Por omisión <K>false</K>. Ver{' '}
      <a href="#timeouts" style={{ color: C.accent }}>Tests que expiran</a>.
    </>,
  ],
  [
    <K key="k">format</K>,
    'json | csv',
    <>
      Formato de la respuesta. Por omisión <K>json</K>.
    </>,
  ],
];

export default function ApiDocsPage() {
  const toc = [
    ['dataset', 'Qué contiene el dataset'],
    ['auth', 'Autenticación'],
    ['fechas', 'Rangos de fecha'],
    ['provincias', 'GET /speedtests/provinces'],
    ['diario', 'GET /speedtests/daily'],
    ['meta', 'GET /meta'],
    ['campos', 'Campos de la respuesta'],
    ['timeouts', 'Tests que expiran'],
    ['csv', 'CSV'],
    ['errores', 'Errores y límites'],
    ['ejemplos', 'Ejemplos de código'],
    ['openapi', 'OpenAPI / Postman'],
    ['uso', 'Uso y atribución'],
  ];

  return (
    <main
      style={{
        maxWidth: 940,
        margin: '0 auto',
        padding: '32px 20px 96px',
        fontSize: 15,
        lineHeight: 1.7,
        color: C.text,
      }}
    >
      <a href="/dashboard" style={{ color: C.muted, fontSize: 14, textDecoration: 'none' }}>
        ← Cuba Internet Monitor
      </a>

      <h1 style={{ fontSize: 34, margin: '18px 0 10px', lineHeight: 1.2 }}>
        API de velocidad de internet por provincia
      </h1>
      <p style={{ color: C.muted, fontSize: 17, margin: 0 }}>
        Acceso programático a los tests de velocidad que realizan las personas desde Cuba en{' '}
        <a href={`${BASE}/speedtest`} style={{ color: C.accent }}>internet.cubapk.com</a>, agregados por
        provincia y por día.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0 8px' }}>
        {[
          ['Versión', 'v1'],
          ['Autenticación', 'API key'],
          ['Formatos', 'JSON · CSV'],
          ['Licencia', 'CC BY 4.0'],
        ].map(([label, value]) => (
          <span
            key={label}
            style={{
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 13,
              color: C.muted,
            }}
          >
            {label}: <strong style={{ color: C.text }}>{value}</strong>
          </span>
        ))}
      </div>

      <div
        style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '16px 20px',
          marginTop: 24,
        }}
      >
        <div style={{ color: C.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 }}>URL base</div>
        <div style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 16, marginTop: 4 }}>
          {BASE}/api/v1
        </div>
      </div>

      <nav style={{ marginTop: 28 }}>
        <div style={{ color: C.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          Contenido
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, columns: 2, columnGap: 28, fontSize: 14 }}>
          {toc.map(([id, label]) => (
            <li key={id} style={{ breakInside: 'avoid', marginBottom: 2 }}>
              <a href={`#${id}`} style={{ color: C.accent, textDecoration: 'none' }}>{label}</a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="dataset" title="Qué contiene el dataset">
        <p style={{ margin: '0 0 10px' }}>
          Cada registro es un test de velocidad ejecutado en el navegador por una persona que visitó{' '}
          <K>internet.cubapk.com/speedtest</K> desde una red cubana. El test mide descarga, subida, latencia y
          jitter contra nuestros propios endpoints, y la provincia la selecciona quien hace el test.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          La API no expone tests individuales: siempre devuelve agregados (por provincia, o por provincia y día).
          No se almacena la dirección IP de quien mide, solo un hash con sal que se usa para limitar la frecuencia
          de tests.
        </p>

        <Note tone="warn">
          <strong>Cómo leer estos datos.</strong> Es una muestra <em>autoseleccionada</em>: mide a quien decidió
          hacer un test, no a una muestra representativa de la población, y quien mide suele hacerlo justamente
          cuando percibe que su conexión va mal. Sirve para comparar provincias y ver tendencias en el tiempo, no
          para afirmar «la velocidad media de la provincia X es Y». Por el tamaño de muestra, La Habana concentra
          cerca de un 40 % de los tests.
        </Note>

        <Table
          rows={[
            ['Métricas', <>descarga (Mbps), subida (Mbps), latencia (ms), jitter (ms)</>],
            ['Granularidad', 'Provincia · día · provincia+día'],
            ['Cobertura', 'Las 16 provincias (incluye el municipio especial Isla de la Juventud)'],
            [
              'Retención',
              <>
                90 días. Las mediciones crudas se eliminan automáticamente pasado ese plazo, así que un rango más
                antiguo devuelve buckets vacíos.
              </>,
            ],
            ['Actualización', 'En tiempo real: un test aparece en la API en cuanto se guarda'],
            ['Volumen', 'Del orden de decenas de tests por día a escala nacional'],
          ]}
        />

        <p style={{ margin: '14px 0 6px', color: C.muted, fontSize: 14 }}>Códigos de provincia:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PROVINCES.map(p => (
            <span
              key={p.id}
              style={{
                background: C.panelAlt,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 13,
              }}
            >
              <strong style={{ color: C.accent, fontFamily: 'ui-monospace, Menlo, monospace' }}>{p.id}</strong>{' '}
              {p.name}
            </span>
          ))}
        </div>
      </Section>

      <Section id="auth" title="Autenticación">
        <p style={{ margin: '0 0 10px' }}>
          Todos los endpoints requieren una API key. Pásala en la cabecera <K>X-API-Key</K>:
        </p>
        <Code>{`curl -H "X-API-Key: TU_CLAVE" \\
  "${BASE}/api/v1/speedtests/provinces"`}</Code>
        <p style={{ margin: '0 0 10px' }}>También se aceptan dos variantes, por comodidad con herramientas que no
          permiten cabeceras personalizadas:</p>
        <Table
          head={['Forma', 'Ejemplo']}
          rows={[
            ['Cabecera (recomendado)', <K>X-API-Key: TU_CLAVE</K>],
            ['Bearer token', <K>Authorization: Bearer TU_CLAVE</K>],
            ['Parámetro de consulta', <K>?api_key=TU_CLAVE</K>],
          ]}
        />
        <Note tone="warn">
          La clave identifica a tu organización y no debe publicarse. Evita <K>?api_key=</K> en páginas web o
          repositorios públicos: queda registrada en historiales y logs. Si crees que se filtró, escríbenos y la
          rotamos.
        </Note>
      </Section>

      <Section id="fechas" title="Rangos de fecha">
        <p style={{ margin: '0 0 10px' }}>
          Sin parámetros, todos los endpoints devuelven <strong>los últimos 7 días</strong>. Para otro rango
          tienes dos formas, y los parámetros son los mismos en todos los endpoints de datos:
        </p>
        <Code>{`# Últimos 7 días (por omisión)
GET /api/v1/speedtests/provinces

# Un rango explícito: del 1 al 15 de septiembre, ambos incluidos
GET /api/v1/speedtests/provinces?from=2026-09-01&to=2026-09-15

# Los últimos 30 días
GET /api/v1/speedtests/provinces?days=30

# Un mes natural completo
GET /api/v1/speedtests/provinces?from=2026-08-01&to=2026-08-31`}</Code>
        <Table head={['Parámetro', 'Tipo', 'Descripción']} rows={COMMON_PARAMS} />
        <Note>
          Las fechas se resuelven en hora de Cuba (<K>America/Havana</K>), de modo que <K>to=2026-09-15</K> incluye
          todo el 15 de septiembre en Cuba. La respuesta siempre reporta el rango efectivo en UTC dentro de{' '}
          <K>meta.from</K> y <K>meta.to</K> (este último es exclusivo). El rango máximo por consulta es de 366 días.
        </Note>
      </Section>

      <Section id="provincias" title="Estadísticas por provincia">
        <Endpoint method="GET" path="/api/v1/speedtests/provinces" />
        <p style={{ margin: '0 0 10px' }}>
          Una fila por provincia para el rango pedido. Devuelve siempre las 16 provincias en orden geográfico
          (occidente → oriente); las que no tienen tests en el rango vienen con <K>tests: 0</K> y estadísticas{' '}
          <K>null</K>, para que puedas construir tablas o mapas sin huecos.
        </p>
        <p style={{ color: C.muted, fontSize: 14, margin: '0 0 4px' }}>
          Parámetros: los comunes de <a href="#fechas" style={{ color: C.accent }}>Rangos de fecha</a>.
        </p>
        <Code>{`curl -H "X-API-Key: TU_CLAVE" \\
  "${BASE}/api/v1/speedtests/provinces?from=2026-09-01&to=2026-09-15"`}</Code>
        <Code>{`{
  "meta": {
    "source": "crowdsourced",
    "from": "2026-09-01T04:00:00.000Z",
    "to": "2026-09-16T04:00:00.000Z",
    "timezone": "America/Havana",
    "include_timed_out": false,
    "retention_days": 90,
    "generated_at": "2026-09-19T14:02:11.401Z",
    "provinces": 16
  },
  "summary": {
    "total_tests": 1242,
    "tests": 918,
    "timed_out_tests": 324,
    "download_mbps": { "avg": 1.68, "median": 0.94, "p90": 4.4, "min": 0.01, "max": 13.15 },
    "upload_mbps":   { "avg": 1.21, "median": 0.62, "p90": 3.1, "min": 0.01, "max": 9.84 },
    "latency_ms":    { "avg": 271, "median": 214, "p90": 588 },
    "jitter_ms":     { "avg": 42 }
  },
  "data": [
    {
      "province_id": "PRI",
      "province": "Pinar del Río",
      "total_tests": 41,
      "tests": 29,
      "timed_out_tests": 12,
      "download_mbps": { "avg": 0.82, "median": 0.54, "p90": 2.1, "min": 0.03, "max": 4.65 },
      "upload_mbps":   { "avg": 0.61, "median": 0.4,  "p90": 1.6, "min": 0.02, "max": 3.2 },
      "latency_ms":    { "avg": 310, "median": 245, "p90": 701 },
      "jitter_ms":     { "avg": 55 },
      "first_test": "2026-09-01T12:41:02.118Z",
      "last_test":  "2026-09-15T23:12:44.900Z"
    }
    // … 15 provincias más
  ]
}`}</Code>
        <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
          <K>summary</K> agrega todos los tests que cumplen el filtro; si pasas <K>province</K>, el resumen se
          refiere solo a esas provincias.
        </p>
      </Section>

      <Section id="diario" title="Serie diaria">
        <Endpoint method="GET" path="/api/v1/speedtests/daily" />
        <p style={{ margin: '0 0 10px' }}>
          Una fila por día, con las mismas estadísticas. Útil para gráficos de evolución. Los días agrupan por hora
          de Cuba salvo que cambies <K>tz</K>. A diferencia del endpoint anterior, <strong>los días sin tests se
          omiten</strong>.
        </p>
        <Table
          head={['Parámetro', 'Tipo', 'Descripción']}
          rows={[
            [
              <K key="k">group_by</K>,
              'province | country',
              <>
                <K>province</K> (por omisión) devuelve una fila por día y provincia; <K>country</K> devuelve una
                única fila nacional por día.
              </>,
            ],
            ...COMMON_PARAMS,
          ]}
        />
        <Code>{`# Evolución nacional del último mes
curl -H "X-API-Key: TU_CLAVE" \\
  "${BASE}/api/v1/speedtests/daily?days=30&group_by=country"

# Evolución diaria de La Habana y Santiago de Cuba
curl -H "X-API-Key: TU_CLAVE" \\
  "${BASE}/api/v1/speedtests/daily?days=30&province=HAB,SCU"`}</Code>
        <Code>{`{
  "meta": { "…": "igual que arriba", "group_by": "country", "rows": 30 },
  "data": [
    {
      "date": "2026-08-21",
      "total_tests": 74,
      "tests": 55,
      "timed_out_tests": 19,
      "download_mbps": { "avg": 1.51, "median": 0.88, "p90": 4.02, "min": 0.02, "max": 11.4 },
      "upload_mbps":   { "avg": 1.1,  "median": 0.58, "p90": 2.9,  "min": 0.01, "max": 8.7 },
      "latency_ms":    { "avg": 288, "median": 221, "p90": 640 },
      "jitter_ms":     { "avg": 47 }
    }
    // …
  ]
}`}</Code>
      </Section>

      <Section id="meta" title="Catálogo y cobertura">
        <Endpoint method="GET" path="/api/v1/meta" />
        <p style={{ margin: '0 0 10px' }}>
          Códigos y nombres de las 16 provincias, valores por omisión, y qué cubre el dataset ahora mismo (total de
          tests, fecha del primero y del último). No recibe parámetros. Es también la llamada más barata para
          comprobar que tu clave funciona.
        </p>
        <Code>{`curl -H "X-API-Key: TU_CLAVE" "${BASE}/api/v1/meta"`}</Code>
      </Section>

      <Section id="campos" title="Campos de la respuesta">
        <Table
          head={['Campo', 'Descripción']}
          rows={[
            [<K key="k">total_tests</K>, 'Tests registrados en el bucket, incluidos los que expiraron.'],
            [
              <K key="k">tests</K>,
              'Tests efectivamente usados para calcular las estadísticas (el denominador de los promedios).',
            ],
            [
              <K key="k">timed_out_tests</K>,
              <>
                Cuántos de <K>total_tests</K> expiraron. Su proporción es en sí misma un indicador de mala
                conectividad.
              </>,
            ],
            [<K key="k">download_mbps</K>, <>Descarga en megabits por segundo: <K>avg</K>, <K>median</K>, <K>p90</K>, <K>min</K>, <K>max</K>.</>],
            [<K key="k">upload_mbps</K>, 'Subida en megabits por segundo, mismos estadísticos.'],
            [<K key="k">latency_ms</K>, <>Latencia en milisegundos: <K>avg</K>, <K>median</K>, <K>p90</K>.</>],
            [<K key="k">jitter_ms</K>, <>Variación de la latencia en milisegundos: <K>avg</K>.</>],
            [
              <K key="k">first_test</K> ,
              'Marca de tiempo del primer y del último test de la provincia dentro del rango (solo en /provinces).',
            ],
          ]}
        />
        <Note>
          <strong>Usa la mediana, no el promedio.</strong> La distribución de velocidades en Cuba tiene una cola
          larga: unas pocas conexiones rápidas elevan mucho el promedio. La mediana (<K>median</K>) describe mejor
          «lo que le toca a una persona típica», y <K>p90</K> muestra el techo real. Todas las estadísticas vienen{' '}
          <K>null</K> cuando el bucket no tiene tests utilizables. Los percentiles se calculan por el método
          aproximado de MongoDB, con un error despreciable a estos volúmenes.
        </Note>
      </Section>

      <Section id="timeouts" title="Tests que expiran">
        <p style={{ margin: '0 0 10px' }}>
          Cuando una conexión es tan lenta que el test no logra completarse en el tiempo previsto, se guarda
          marcado como expirado y con una velocidad cercana a 0. Son alrededor de una cuarta parte de los tests, y
          promediarlos con el resto hunde las medias sin describir bien ninguna de las dos poblaciones.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          Por eso la API <strong>los excluye del cálculo por omisión</strong>, pero te dice siempre cuántos hubo en{' '}
          <K>timed_out_tests</K>. Si tu análisis los necesita —por ejemplo para medir qué porcentaje de intentos de
          conexión son inutilizables— pide <K>include_timed_out=true</K> y entrarán en los promedios.
        </p>
        <Note>
          Las cifras del panel público de <K>internet.cubapk.com</K> sí incluyen los tests expirados, así que no
          coincidirán exactamente con la respuesta por omisión de esta API. Para reproducirlas, usa{' '}
          <K>include_timed_out=true</K>.
        </Note>
      </Section>

      <Section id="csv" title="CSV">
        <p style={{ margin: '0 0 10px' }}>
          Añade <K>format=csv</K> a cualquier endpoint de datos para recibir una tabla plana, con una columna por
          estadístico (<K>download_median_mbps</K>, <K>latency_p90_ms</K>, …). Abre directamente en Excel, Numbers o
          pandas.
        </p>
        <Code>{`curl -H "X-API-Key: TU_CLAVE" \\
  "${BASE}/api/v1/speedtests/provinces?days=30&format=csv" \\
  -o velocidades-provincias.csv`}</Code>
      </Section>

      <Section id="errores" title="Errores y límites">
        <p style={{ margin: '0 0 10px' }}>
          Los errores usan el código HTTP correspondiente y un cuerpo uniforme:
        </p>
        <Code>{`{ "error": { "code": "invalid_range", "message": "from must be earlier than to." } }`}</Code>
        <Table
          head={['HTTP', 'code', 'Qué pasó']}
          rows={[
            [<span key="a" style={{ color: C.amber }}>400</span>, <K>invalid_from</K>, 'Fecha mal formada.'],
            ['400', <K>invalid_range</K>, <><K>from</K> no es anterior a <K>to</K>.</>],
            ['400', <K>range_too_large</K>, 'El rango supera 366 días.'],
            ['400', <K>unknown_province</K>, 'Código de provincia inexistente.'],
            ['400', <K>conflicting_params</K>, <>Se pasó <K>days</K> junto a <K>from</K>/<K>to</K>.</>],
            [<span key="b" style={{ color: C.red }}>401</span>, <K>missing_api_key</K>, 'No se envió clave.'],
            ['401', <K>invalid_api_key</K>, 'La clave no es válida.'],
            [<span key="c" style={{ color: C.red }}>429</span>, <K>rate_limited</K>, 'Se superó el límite de peticiones.'],
            [<span key="d" style={{ color: C.red }}>500</span>, <K>internal_error</K>, 'Fallo del servidor; reintenta.'],
          ]}
        />
        <p style={{ margin: '10px 0 0' }}>
          El límite es de <strong>120 peticiones por minuto</strong> por clave. Cada respuesta incluye{' '}
          <K>X-RateLimit-Limit</K>, <K>X-RateLimit-Remaining</K> y <K>X-RateLimit-Reset</K> (epoch en segundos); un{' '}
          <K>429</K> añade <K>Retry-After</K>. Las respuestas se pueden cachear 5 minutos.
        </p>
      </Section>

      <Section id="ejemplos" title="Ejemplos de código">
        <h3 style={{ fontSize: 16, margin: '18px 0 0' }}>Python + pandas</h3>
        <Code>{`import pandas as pd
import requests

KEY = "TU_CLAVE"
BASE = "${BASE}/api/v1"

r = requests.get(
    f"{BASE}/speedtests/provinces",
    headers={"X-API-Key": KEY},
    params={"from": "2026-09-01", "to": "2026-09-15"},
    timeout=30,
)
r.raise_for_status()
payload = r.json()

df = pd.json_normalize(payload["data"])
print(
    df[["province", "tests", "download_mbps.median", "upload_mbps.median", "latency_ms.median"]]
      .sort_values("download_mbps.median", ascending=False)
)

# O directamente el CSV:
df_csv = pd.read_csv(
    f"{BASE}/speedtests/daily?days=30&format=csv",
    storage_options={"X-API-Key": KEY},
)`}</Code>

        <h3 style={{ fontSize: 16, margin: '22px 0 0' }}>JavaScript / Node</h3>
        <Code>{`const res = await fetch(
  "${BASE}/api/v1/speedtests/daily?days=30&group_by=country",
  { headers: { "X-API-Key": process.env.CUBA_MONITOR_KEY } },
);
if (!res.ok) throw new Error((await res.json()).error.message);
const { data } = await res.json();

for (const day of data) {
  console.log(day.date, day.download_mbps.median, "Mbps", day.tests, "tests");
}`}</Code>

        <h3 style={{ fontSize: 16, margin: '22px 0 0' }}>Google Sheets</h3>
        <p style={{ margin: '8px 0', fontSize: 14, color: C.muted }}>
          En una celda, para traer el CSV de los últimos 30 días (única situación en la que conviene usar{' '}
          <K>api_key</K> en la URL; no compartas la hoja públicamente):
        </p>
        <Code>{`=IMPORTDATA("${BASE}/api/v1/speedtests/provinces?days=30&format=csv&api_key=TU_CLAVE")`}</Code>
      </Section>

      <Section id="openapi" title="OpenAPI / Postman">
        <p style={{ margin: '0 0 10px' }}>
          La especificación OpenAPI 3.0 está publicada y es de acceso libre (no requiere clave). Puedes importarla
          en Postman, Insomnia, Bruno o generar un cliente con ella:
        </p>
        <Code>{`${BASE}/api/v1/openapi.json`}</Code>
      </Section>

      <Section id="uso" title="Uso y atribución">
        <p style={{ margin: '0 0 10px' }}>
          Los datos se ofrecen bajo{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/deed.es" style={{ color: C.accent }}>
            CC BY 4.0
          </a>
          : puedes publicarlos, redistribuirlos y construir sobre ellos, citando la fuente. Atribución sugerida:
        </p>
        <Code>{`Fuente: Cuba Internet Monitor (CubaPK / elToque) — internet.cubapk.com`}</Code>
        <p style={{ margin: '10px 0 0' }}>
          Si vas a publicar análisis con estos datos, te agradecemos —y te lo recomendamos— explicar que se trata de
          tests hechos voluntariamente por usuarios y no de una muestra representativa. Para dudas, rotación de
          claves, límites más altos o acceso a otras métricas del monitor (apagones, BGP, censura, tráfico),
          escríbenos.
        </p>
        <p style={{ margin: '24px 0 0', color: C.muted, fontSize: 13, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          Un proyecto de <a href="https://cubapk.com" style={{ color: C.accent }}>CubaPK</a> y{' '}
          <a href="https://eltoque.com" style={{ color: C.accent }}>elToque</a>. API v1 · documentación actualizada
          en septiembre de 2026.
        </p>
      </Section>
    </main>
  );
}
