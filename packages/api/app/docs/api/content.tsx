import type { ReactNode } from 'react';
import { PROVINCES } from '@/lib/provinces';

export const BASE = 'https://internet.cubapk.com';

export type Lang = 'en' | 'es';

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

function K({ children }: { children: ReactNode }) {
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

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} style={{ marginTop: 48, scrollMarginTop: 24 }}>
      <h2 style={{ fontSize: 22, margin: '0 0 14px', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head?: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '14px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 520 }}>
        {head && (
          <thead>
            <tr>
              {head.map(h => (
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
          </thead>
        )}
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

function Endpoint({ path }: { path: string }) {
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
        GET
      </span>
      <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 14 }}>{path}</span>
    </div>
  );
}

function Note({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
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

const MAP_SNIPPET = `const res = await fetch("${BASE}/api/v1/speedtests/provinces", {
  headers: { "X-API-Key": YOUR_KEY },
});
const { data } = await res.json();

const color = (mbps) =>
  mbps == null ? "#1e293b" :   // no data
  mbps >= 5    ? "#22c55e" :
  mbps >= 2    ? "#3b82f6" :
  mbps >= 1    ? "#f59e0b" :
                 "#ef4444";

for (const p of data) {
  document.getElementById(p.province_id)
    ?.setAttribute("fill", color(p.download_mbps.median));
}`;

type SectionDef = { id: string; title: string; body: ReactNode };

type Dict = {
  htmlTitle: string;
  description: string;
  back: string;
  h1: string;
  lead: ReactNode;
  badges: [string, string][];
  baseUrlLabel: string;
  tocLabel: string;
  sections: SectionDef[];
  footer: ReactNode;
};

/* ------------------------------------------------------------------ English */

const EN_PARAMS: ReactNode[][] = [
  [
    <K key="k">from</K>,
    'date or ISO 8601',
    <>
      Start of the range, inclusive. Either a calendar date (<K>YYYY-MM-DD</K>, read as the start of that day in{' '}
      <K>tz</K>) or a full ISO 8601 timestamp. Defaults to 7 days before <K>to</K>.
    </>,
  ],
  [
    <K key="k">to</K>,
    'date or ISO 8601',
    <>
      End of the range. A calendar date <K>YYYY-MM-DD</K> is <strong>inclusive</strong> (it covers that whole day);
      an ISO 8601 timestamp is used as an exclusive upper bound. Defaults to now.
    </>,
  ],
  [
    <K key="k">days</K>,
    'integer 1–366',
    <>
      Shortcut for &ldquo;the last N days until now&rdquo;. Cannot be combined with <K>from</K>/<K>to</K>.
    </>,
  ],
  [
    <K key="k">province</K>,
    'list',
    <>
      Comma-separated province codes, e.g. <K>HAB,SCU</K>. Omit for all 16.
    </>,
  ],
  [
    <K key="k">tz</K>,
    'IANA zone',
    <>
      Timezone used to resolve calendar dates and to bucket days. Defaults to <K>America/Havana</K>.
    </>,
  ],
  [
    <K key="k">include_timed_out</K>,
    'boolean',
    <>
      Include tests that timed out. Defaults to <K>false</K>. See{' '}
      <a href="#timeouts" style={{ color: C.accent }}>Tests that time out</a>.
    </>,
  ],
  [
    <K key="k">format</K>,
    'json | csv',
    <>
      Response format. Defaults to <K>json</K>.
    </>,
  ],
];

const EN: Dict = {
  htmlTitle: 'Internet speed API by province — Cuba Internet Monitor',
  description:
    'Documentation for the Cuba Internet Monitor REST API: internet speeds measured by users in each province of Cuba, with date ranges and API key authentication.',
  back: '← Cuba Internet Monitor',
  h1: 'Internet speed API by province',
  lead: (
    <>
      Programmatic access to the speed tests people run from Cuba at{' '}
      <a href={`${BASE}/speedtest`} style={{ color: C.accent }}>internet.cubapk.com</a>, aggregated by province and
      by day.
    </>
  ),
  badges: [
    ['Version', 'v1'],
    ['Auth', 'API key'],
    ['Formats', 'JSON · CSV'],
    ['License', 'CC BY 4.0'],
  ],
  baseUrlLabel: 'Base URL',
  tocLabel: 'Contents',
  footer: (
    <>
      A project by <a href="https://cubapk.com" style={{ color: C.accent }}>CubaPK</a> and{' '}
      <a href="https://eltoque.com" style={{ color: C.accent }}>elToque</a>. API v1 · documentation updated
      September 2026.
    </>
  ),
  sections: [
    {
      id: 'map',
      title: 'Start here: the province map',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            The most common use case — a table or a choropleth map with each province&apos;s speed over the past
            week — is the default call, with no parameters at all:
          </p>
          <Code>{`curl -H "X-API-Key: YOUR_KEY" \\
  "${BASE}/api/v1/speedtests/provinces"`}</Code>
          <p style={{ margin: '0 0 10px' }}>
            It <strong>always returns all 16 provinces</strong>, in geographic order, even when one has no tests in
            the range. Every row carries <K>province_id</K> (a three-letter code) and <K>province</K> (the name),
            so you can key your SVG or GeoJSON off them directly. Provinces without data come back with{' '}
            <K>tests: 0</K> and <K>null</K> statistics — render those as &ldquo;no data&rdquo;, not as 0 Mbps.
          </p>
          <Code>{MAP_SNIPPET}</Code>
          <Note>
            <strong>To reproduce the map on internet.cubapk.com exactly</strong> — it colors by average and
            includes timed-out tests — add <K>include_timed_out=true</K> and use <K>download_mbps.avg</K> with the
            scale above:
            <div style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13, marginTop: 8 }}>
              /api/v1/speedtests/provinces?days=7&amp;include_timed_out=true
            </div>
            <div style={{ marginTop: 8 }}>
              With those two parameters the figures match the public dashboard to the decimal. For a map of your
              own we suggest the median (the default call): it describes what a typical person experiences better,
              though it runs lower than the average, so you will want to lower the color thresholds.
            </div>
          </Note>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: C.muted }}>
            For a different window see <a href="#dates" style={{ color: C.accent }}>Date ranges</a>; for evolution
            over time, <a href="#daily" style={{ color: C.accent }}>the daily series</a>.
          </p>
        </>
      ),
    },
    {
      id: 'dataset',
      title: 'What the dataset contains',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            Each record is a speed test run in the browser by someone who visited{' '}
            <K>internet.cubapk.com/speedtest</K> from a Cuban network. The test measures download, upload, latency
            and jitter against our own endpoints, and the province is chosen by the person running it.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            The API never exposes individual tests: it always returns aggregates (by province, or by province and
            day). No IP address is stored — only a salted hash, used to rate-limit how often a test can be run.
          </p>
          <Note tone="warn">
            <strong>How to read this data.</strong> It is a <em>self-selected</em> sample: it measures people who
            chose to run a test, and they tend to run one precisely when their connection feels bad. It is well
            suited to comparing provinces and tracking trends over time, not to claiming &ldquo;the average speed
            in province X is Y&rdquo;. Because of sample size, Havana accounts for roughly 40% of all tests.
          </Note>
          <Table
            rows={[
              ['Metrics', 'download (Mbps), upload (Mbps), latency (ms), jitter (ms)'],
              ['Granularity', 'Province · day · province+day'],
              ['Coverage', 'All 16 provinces (including the special municipality Isla de la Juventud)'],
              [
                'Retention',
                'Unlimited. Raw measurements are kept indefinitely. The series starts on 2026-06-20; an earlier range returns empty buckets.',
              ],
              ['Updates', 'Real time: a test appears in the API as soon as it is stored'],
              ['Volume', 'On the order of tens of tests per day nationwide'],
            ]}
          />
          <p style={{ margin: '14px 0 6px', color: C.muted, fontSize: 14 }}>Province codes:</p>
          <ProvinceChips />
        </>
      ),
    },
    {
      id: 'auth',
      title: 'Authentication',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            Every endpoint requires an API key. Send it in the <K>X-API-Key</K> header:
          </p>
          <Code>{`curl -H "X-API-Key: YOUR_KEY" \\
  "${BASE}/api/v1/speedtests/provinces"`}</Code>
          <p style={{ margin: '0 0 10px' }}>
            Two alternatives are accepted, for tools that cannot set custom headers:
          </p>
          <Table
            head={['Method', 'Example']}
            rows={[
              ['Header (recommended)', <K key="a">X-API-Key: YOUR_KEY</K>],
              ['Bearer token', <K key="b">Authorization: Bearer YOUR_KEY</K>],
              ['Query parameter', <K key="c">?api_key=YOUR_KEY</K>],
            ]}
          />
          <Note tone="warn">
            The key identifies your organization and should not be published. Avoid <K>?api_key=</K> on public web
            pages or in repositories: it ends up in browser history and server logs. If you believe it leaked,
            write to us and we will rotate it.
          </Note>
        </>
      ),
    },
    {
      id: 'dates',
      title: 'Date ranges',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            With no parameters, every endpoint returns <strong>the last 7 days</strong>. For any other window there
            are two ways, and the parameters are the same across all data endpoints:
          </p>
          <Code>{`# Last 7 days (the default)
GET /api/v1/speedtests/provinces

# An explicit range: 1 to 15 September, both included
GET /api/v1/speedtests/provinces?from=2026-09-01&to=2026-09-15

# The last 30 days
GET /api/v1/speedtests/provinces?days=30

# A full calendar month
GET /api/v1/speedtests/provinces?from=2026-08-01&to=2026-08-31`}</Code>
          <Table head={['Parameter', 'Type', 'Description']} rows={EN_PARAMS} />
          <Note>
            Dates are resolved in Cuban local time (<K>America/Havana</K>), so <K>to=2026-09-15</K> covers all of
            15 September in Cuba. The response always reports the effective range in UTC under <K>meta.from</K> and{' '}
            <K>meta.to</K> (the latter is exclusive). The maximum range per query is 366 days.
          </Note>
        </>
      ),
    },
    {
      id: 'provinces',
      title: 'Statistics per province',
      body: (
        <>
          <Endpoint path="/api/v1/speedtests/provinces" />
          <p style={{ margin: '0 0 10px' }}>
            One row per province for the requested range. It always returns the 16 provinces in geographic order
            (west → east); those with no tests in the range come back with <K>tests: 0</K> and <K>null</K>{' '}
            statistics, so you can build tables or maps without gaps.
          </p>
          <p style={{ color: C.muted, fontSize: 14, margin: '0 0 4px' }}>
            Parameters: the common ones from <a href="#dates" style={{ color: C.accent }}>Date ranges</a>.
          </p>
          <Code>{`curl -H "X-API-Key: YOUR_KEY" \\
  "${BASE}/api/v1/speedtests/provinces?from=2026-09-01&to=2026-09-15"`}</Code>
          <Code>{`{
  "meta": {
    "source": "crowdsourced",
    "from": "2026-09-01T04:00:00.000Z",
    "to": "2026-09-16T04:00:00.000Z",
    "timezone": "America/Havana",
    "include_timed_out": false,
    "retention_days": null,
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
    // … 15 more provinces
  ]
}`}</Code>
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
            <K>summary</K> aggregates every test matching the filter; if you pass <K>province</K>, the summary
            covers only those provinces.
          </p>
        </>
      ),
    },
    {
      id: 'daily',
      title: 'Daily series',
      body: (
        <>
          <Endpoint path="/api/v1/speedtests/daily" />
          <p style={{ margin: '0 0 10px' }}>
            One row per day, with the same statistics. Useful for trend charts. Days are bucketed in Cuban local
            time unless you change <K>tz</K>. Unlike the previous endpoint, <strong>days with no tests are
            omitted</strong>.
          </p>
          <Table
            head={['Parameter', 'Type', 'Description']}
            rows={[
              [
                <K key="k">group_by</K>,
                'province | country',
                <>
                  <K>province</K> (the default) returns one row per day and province; <K>country</K> returns a
                  single nationwide row per day.
                </>,
              ],
              ...EN_PARAMS,
            ]}
          />
          <Code>{`# Nationwide trend over the last month
curl -H "X-API-Key: YOUR_KEY" \\
  "${BASE}/api/v1/speedtests/daily?days=30&group_by=country"

# Daily series for Havana and Santiago de Cuba
curl -H "X-API-Key: YOUR_KEY" \\
  "${BASE}/api/v1/speedtests/daily?days=30&province=HAB,SCU"`}</Code>
          <Code>{`{
  "meta": { "…": "same as above", "group_by": "country", "rows": 30 },
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
        </>
      ),
    },
    {
      id: 'meta',
      title: 'Catalogue and coverage',
      body: (
        <>
          <Endpoint path="/api/v1/meta" />
          <p style={{ margin: '0 0 10px' }}>
            Codes and names of the 16 provinces, the defaults applied, and what the dataset covers right now (total
            tests, first and last test). It takes no parameters, and it is the cheapest call for checking that your
            key works.
          </p>
          <Code>{`curl -H "X-API-Key: YOUR_KEY" "${BASE}/api/v1/meta"`}</Code>
        </>
      ),
    },
    {
      id: 'fields',
      title: 'Response fields',
      body: (
        <>
          <Table
            head={['Field', 'Description']}
            rows={[
              [<K key="k">total_tests</K>, 'Tests recorded in the bucket, timed-out ones included.'],
              [
                <K key="k">tests</K>,
                'Tests actually used to compute the statistics (the denominator of the averages).',
              ],
              [
                <K key="k">timed_out_tests</K>,
                <>
                  How many of <K>total_tests</K> timed out. That share is itself an indicator of poor
                  connectivity.
                </>,
              ],
              [
                <K key="k">download_mbps</K>,
                <>
                  Download in megabits per second: <K>avg</K>, <K>median</K>, <K>p90</K>, <K>min</K>, <K>max</K>.
                </>,
              ],
              [<K key="k">upload_mbps</K>, 'Upload in megabits per second, same statistics.'],
              [
                <K key="k">latency_ms</K>,
                <>
                  Latency in milliseconds: <K>avg</K>, <K>median</K>, <K>p90</K>.
                </>,
              ],
              [
                <K key="k">jitter_ms</K>,
                <>
                  Latency variation in milliseconds: <K>avg</K>.
                </>,
              ],
              [
                <>
                  <K>first_test</K> / <K>last_test</K>
                </>,
                'Timestamp of the first and last test for that province within the range (only in /provinces).',
              ],
            ]}
          />
          <Note>
            <strong>Use the median, not the average.</strong> The distribution of speeds in Cuba has a long tail: a
            few fast connections pull the average up a lot. The median (<K>median</K>) describes &ldquo;what a
            typical person gets&rdquo; better, and <K>p90</K> shows the realistic ceiling. Every statistic is{' '}
            <K>null</K> when the bucket has no usable tests. Percentiles use MongoDB&apos;s approximate method,
            with negligible error at these volumes.
          </Note>
        </>
      ),
    },
    {
      id: 'timeouts',
      title: 'Tests that time out',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            When a connection is so slow that the test cannot finish within the expected time, it is stored flagged
            as timed out and with a speed close to 0. These are around a quarter of all tests, and averaging them
            together with the rest sinks the means without describing either population well.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            So the API <strong>excludes them from the statistics by default</strong>, but always tells you how many
            there were in <K>timed_out_tests</K>. If your analysis needs them — to measure what share of connection
            attempts are unusable, for instance — pass <K>include_timed_out=true</K> and they will be folded into
            the averages.
          </p>
          <Note>
            The figures on the public dashboard at <K>internet.cubapk.com</K> do include timed-out tests, so they
            will not match this API&apos;s default response exactly. To reproduce them, use{' '}
            <K>include_timed_out=true</K>.
          </Note>
        </>
      ),
    },
    {
      id: 'csv',
      title: 'CSV',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            Add <K>format=csv</K> to any data endpoint to get a flat table, with one column per statistic (
            <K>download_median_mbps</K>, <K>latency_p90_ms</K>, …). Opens directly in Excel, Numbers, R or pandas.
          </p>
          <Code>{`curl -H "X-API-Key: YOUR_KEY" \\
  "${BASE}/api/v1/speedtests/provinces?days=30&format=csv" \\
  -o province-speeds.csv`}</Code>
        </>
      ),
    },
    {
      id: 'errors',
      title: 'Errors and limits',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>Errors use the matching HTTP status and a uniform body:</p>
          <Code>{`{ "error": { "code": "invalid_range", "message": "from must be earlier than to." } }`}</Code>
          <Table
            head={['HTTP', 'code', 'What happened']}
            rows={[
              [<span key="a" style={{ color: C.amber }}>400</span>, <K key="b">invalid_from</K>, 'Malformed date.'],
              [
                '400',
                <K key="c">invalid_range</K>,
                <>
                  <K>from</K> is not earlier than <K>to</K>.
                </>,
              ],
              ['400', <K key="d">range_too_large</K>, 'The range exceeds 366 days.'],
              ['400', <K key="e">unknown_province</K>, 'Province code does not exist.'],
              [
                '400',
                <K key="f">conflicting_params</K>,
                <>
                  <K>days</K> was passed alongside <K>from</K>/<K>to</K>.
                </>,
              ],
              [<span key="g" style={{ color: C.red }}>401</span>, <K key="h">missing_api_key</K>, 'No key sent.'],
              ['401', <K key="i">invalid_api_key</K>, 'The key is not valid.'],
              [<span key="j" style={{ color: C.red }}>429</span>, <K key="k">rate_limited</K>, 'Rate limit exceeded.'],
              [<span key="l" style={{ color: C.red }}>500</span>, <K key="m">internal_error</K>, 'Server error; retry.'],
            ]}
          />
          <p style={{ margin: '10px 0 0' }}>
            The limit is <strong>120 requests per minute</strong> per key. Every response carries{' '}
            <K>X-RateLimit-Limit</K>, <K>X-RateLimit-Remaining</K> and <K>X-RateLimit-Reset</K> (epoch seconds); a{' '}
            <K>429</K> adds <K>Retry-After</K>. Responses may be cached for 5 minutes.
          </p>
        </>
      ),
    },
    {
      id: 'examples',
      title: 'Code examples',
      body: (
        <>
          <h3 style={{ fontSize: 16, margin: '18px 0 0' }}>Python + pandas</h3>
          <Code>{`import pandas as pd
import requests

KEY = "YOUR_KEY"
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

# Or the CSV directly:
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
            In a cell, to pull the last 30 days as CSV (the one case where <K>api_key</K> in the URL is
            reasonable — do not share the sheet publicly):
          </p>
          <Code>{`=IMPORTDATA("${BASE}/api/v1/speedtests/provinces?days=30&format=csv&api_key=YOUR_KEY")`}</Code>
        </>
      ),
    },
    {
      id: 'openapi',
      title: 'OpenAPI / Postman',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            The OpenAPI 3.0 specification is published and freely accessible (no key needed). Import it into
            Postman, Insomnia or Bruno, or generate a client from it:
          </p>
          <Code>{`${BASE}/api/v1/openapi.json`}</Code>
        </>
      ),
    },
    {
      id: 'usage',
      title: 'Usage and attribution',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            The data is offered under{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" style={{ color: C.accent }}>CC BY 4.0</a>: you
            may publish it, redistribute it and build on it, citing the source. Suggested attribution:
          </p>
          <Code>{`Source: Cuba Internet Monitor (CubaPK / elToque) — internet.cubapk.com`}</Code>
          <p style={{ margin: '10px 0 0' }}>
            If you publish analysis based on this data, we would appreciate — and recommend — making clear that
            these are tests run voluntarily by users and not a representative sample. For questions, key rotation,
            higher limits or access to other monitor metrics (outages, BGP, censorship, traffic), get in touch.
          </p>
        </>
      ),
    },
  ],
};

/* ------------------------------------------------------------------ Spanish */

const ES_PARAMS: ReactNode[][] = [
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
      Atajo para &laquo;los últimos N días hasta ahora&raquo;. No se puede combinar con <K>from</K>/<K>to</K>.
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
      Zona horaria con la que se resuelven las fechas y se agrupan los días. Por omisión <K>America/Havana</K>.
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

const ES: Dict = {
  htmlTitle: 'API de velocidad por provincia — Cuba Internet Monitor',
  description:
    'Documentación de la API REST de Cuba Internet Monitor: velocidades de internet medidas por usuarios en cada provincia de Cuba, con rangos de fecha y autenticación por API key.',
  back: '← Cuba Internet Monitor',
  h1: 'API de velocidad de internet por provincia',
  lead: (
    <>
      Acceso programático a los tests de velocidad que realizan las personas desde Cuba en{' '}
      <a href={`${BASE}/speedtest`} style={{ color: C.accent }}>internet.cubapk.com</a>, agregados por provincia y
      por día.
    </>
  ),
  badges: [
    ['Versión', 'v1'],
    ['Autenticación', 'API key'],
    ['Formatos', 'JSON · CSV'],
    ['Licencia', 'CC BY 4.0'],
  ],
  baseUrlLabel: 'URL base',
  tocLabel: 'Contenido',
  footer: (
    <>
      Un proyecto de <a href="https://cubapk.com" style={{ color: C.accent }}>CubaPK</a> y{' '}
      <a href="https://eltoque.com" style={{ color: C.accent }}>elToque</a>. API v1 · documentación actualizada en
      septiembre de 2026.
    </>
  ),
  sections: [
    {
      id: 'map',
      title: 'Empezar: el mapa por provincia',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            El caso más común —una tabla o un mapa coroplético con la velocidad de cada provincia en la última
            semana— es la llamada por omisión, sin ningún parámetro:
          </p>
          <Code>{`curl -H "X-API-Key: TU_CLAVE" \\
  "${BASE}/api/v1/speedtests/provinces"`}</Code>
          <p style={{ margin: '0 0 10px' }}>
            Devuelve <strong>siempre las 16 provincias</strong>, en orden geográfico y aunque alguna no tenga tests
            en el rango. Cada fila trae <K>province_id</K> (código de tres letras) y <K>province</K> (nombre), así
            que puedes usarlos directamente como clave contra tu SVG o tu GeoJSON. Las provincias sin datos vienen
            con <K>tests: 0</K> y estadísticas <K>null</K>: píntalas como &laquo;sin datos&raquo;, no como 0 Mbps.
          </p>
          <Code>{MAP_SNIPPET}</Code>
          <Note>
            <strong>Para reproducir exactamente el mapa de internet.cubapk.com</strong>, que colorea por promedio e
            incluye los tests expirados, añade <K>include_timed_out=true</K> y usa <K>download_mbps.avg</K> con la
            escala de arriba:
            <div style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13, marginTop: 8 }}>
              /api/v1/speedtests/provinces?days=7&amp;include_timed_out=true
            </div>
            <div style={{ marginTop: 8 }}>
              Con esos dos parámetros las cifras coinciden al decimal con las del panel público. Para un mapa propio
              recomendamos la mediana (la llamada por omisión): describe mejor lo que percibe una persona típica,
              aunque al correr más baja que el promedio conviene bajar los umbrales de color.
            </div>
          </Note>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: C.muted }}>
            Para otro rango de fechas, ver <a href="#dates" style={{ color: C.accent }}>Rangos de fecha</a>; para la
            evolución en el tiempo, <a href="#daily" style={{ color: C.accent }}>la serie diaria</a>.
          </p>
        </>
      ),
    },
    {
      id: 'dataset',
      title: 'Qué contiene el dataset',
      body: (
        <>
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
            para afirmar &laquo;la velocidad media de la provincia X es Y&raquo;. Por el tamaño de muestra, La
            Habana concentra cerca de un 40 % de los tests.
          </Note>
          <Table
            rows={[
              ['Métricas', 'descarga (Mbps), subida (Mbps), latencia (ms), jitter (ms)'],
              ['Granularidad', 'Provincia · día · provincia+día'],
              ['Cobertura', 'Las 16 provincias (incluye el municipio especial Isla de la Juventud)'],
              [
                'Retención',
                'Ilimitada. Las mediciones crudas se conservan indefinidamente. La serie comienza el 2026-06-20; un rango anterior devuelve buckets vacíos.',
              ],
              ['Actualización', 'En tiempo real: un test aparece en la API en cuanto se guarda'],
              ['Volumen', 'Del orden de decenas de tests por día a escala nacional'],
            ]}
          />
          <p style={{ margin: '14px 0 6px', color: C.muted, fontSize: 14 }}>Códigos de provincia:</p>
          <ProvinceChips />
        </>
      ),
    },
    {
      id: 'auth',
      title: 'Autenticación',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            Todos los endpoints requieren una API key. Pásala en la cabecera <K>X-API-Key</K>:
          </p>
          <Code>{`curl -H "X-API-Key: TU_CLAVE" \\
  "${BASE}/api/v1/speedtests/provinces"`}</Code>
          <p style={{ margin: '0 0 10px' }}>
            También se aceptan dos variantes, por comodidad con herramientas que no permiten cabeceras
            personalizadas:
          </p>
          <Table
            head={['Forma', 'Ejemplo']}
            rows={[
              ['Cabecera (recomendado)', <K key="a">X-API-Key: TU_CLAVE</K>],
              ['Bearer token', <K key="b">Authorization: Bearer TU_CLAVE</K>],
              ['Parámetro de consulta', <K key="c">?api_key=TU_CLAVE</K>],
            ]}
          />
          <Note tone="warn">
            La clave identifica a tu organización y no debe publicarse. Evita <K>?api_key=</K> en páginas web o
            repositorios públicos: queda registrada en historiales y logs. Si crees que se filtró, escríbenos y la
            rotamos.
          </Note>
        </>
      ),
    },
    {
      id: 'dates',
      title: 'Rangos de fecha',
      body: (
        <>
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
          <Table head={['Parámetro', 'Tipo', 'Descripción']} rows={ES_PARAMS} />
          <Note>
            Las fechas se resuelven en hora de Cuba (<K>America/Havana</K>), de modo que <K>to=2026-09-15</K>{' '}
            incluye todo el 15 de septiembre en Cuba. La respuesta siempre reporta el rango efectivo en UTC dentro
            de <K>meta.from</K> y <K>meta.to</K> (este último es exclusivo). El rango máximo por consulta es de 366
            días.
          </Note>
        </>
      ),
    },
    {
      id: 'provinces',
      title: 'Estadísticas por provincia',
      body: (
        <>
          <Endpoint path="/api/v1/speedtests/provinces" />
          <p style={{ margin: '0 0 10px' }}>
            Una fila por provincia para el rango pedido. Devuelve siempre las 16 provincias en orden geográfico
            (occidente → oriente); las que no tienen tests en el rango vienen con <K>tests: 0</K> y estadísticas{' '}
            <K>null</K>, para que puedas construir tablas o mapas sin huecos.
          </p>
          <p style={{ color: C.muted, fontSize: 14, margin: '0 0 4px' }}>
            Parámetros: los comunes de <a href="#dates" style={{ color: C.accent }}>Rangos de fecha</a>.
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
    "retention_days": null,
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
        </>
      ),
    },
    {
      id: 'daily',
      title: 'Serie diaria',
      body: (
        <>
          <Endpoint path="/api/v1/speedtests/daily" />
          <p style={{ margin: '0 0 10px' }}>
            Una fila por día, con las mismas estadísticas. Útil para gráficos de evolución. Los días agrupan por
            hora de Cuba salvo que cambies <K>tz</K>. A diferencia del endpoint anterior, <strong>los días sin
            tests se omiten</strong>.
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
              ...ES_PARAMS,
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
        </>
      ),
    },
    {
      id: 'meta',
      title: 'Catálogo y cobertura',
      body: (
        <>
          <Endpoint path="/api/v1/meta" />
          <p style={{ margin: '0 0 10px' }}>
            Códigos y nombres de las 16 provincias, valores por omisión, y qué cubre el dataset ahora mismo (total
            de tests, fecha del primero y del último). No recibe parámetros. Es también la llamada más barata para
            comprobar que tu clave funciona.
          </p>
          <Code>{`curl -H "X-API-Key: TU_CLAVE" "${BASE}/api/v1/meta"`}</Code>
        </>
      ),
    },
    {
      id: 'fields',
      title: 'Campos de la respuesta',
      body: (
        <>
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
              [
                <K key="k">download_mbps</K>,
                <>
                  Descarga en megabits por segundo: <K>avg</K>, <K>median</K>, <K>p90</K>, <K>min</K>, <K>max</K>.
                </>,
              ],
              [<K key="k">upload_mbps</K>, 'Subida en megabits por segundo, mismos estadísticos.'],
              [
                <K key="k">latency_ms</K>,
                <>
                  Latencia en milisegundos: <K>avg</K>, <K>median</K>, <K>p90</K>.
                </>,
              ],
              [
                <K key="k">jitter_ms</K>,
                <>
                  Variación de la latencia en milisegundos: <K>avg</K>.
                </>,
              ],
              [
                <>
                  <K>first_test</K> / <K>last_test</K>
                </>,
                'Marca de tiempo del primer y del último test de la provincia dentro del rango (solo en /provinces).',
              ],
            ]}
          />
          <Note>
            <strong>Usa la mediana, no el promedio.</strong> La distribución de velocidades en Cuba tiene una cola
            larga: unas pocas conexiones rápidas elevan mucho el promedio. La mediana (<K>median</K>) describe mejor
            &laquo;lo que le toca a una persona típica&raquo;, y <K>p90</K> muestra el techo real. Todas las
            estadísticas vienen <K>null</K> cuando el bucket no tiene tests utilizables. Los percentiles se calculan
            por el método aproximado de MongoDB, con un error despreciable a estos volúmenes.
          </Note>
        </>
      ),
    },
    {
      id: 'timeouts',
      title: 'Tests que expiran',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            Cuando una conexión es tan lenta que el test no logra completarse en el tiempo previsto, se guarda
            marcado como expirado y con una velocidad cercana a 0. Son alrededor de una cuarta parte de los tests, y
            promediarlos con el resto hunde las medias sin describir bien ninguna de las dos poblaciones.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            Por eso la API <strong>los excluye del cálculo por omisión</strong>, pero te dice siempre cuántos hubo
            en <K>timed_out_tests</K>. Si tu análisis los necesita —por ejemplo para medir qué porcentaje de
            intentos de conexión son inutilizables— pide <K>include_timed_out=true</K> y entrarán en los promedios.
          </p>
          <Note>
            Las cifras del panel público de <K>internet.cubapk.com</K> sí incluyen los tests expirados, así que no
            coincidirán exactamente con la respuesta por omisión de esta API. Para reproducirlas, usa{' '}
            <K>include_timed_out=true</K>.
          </Note>
        </>
      ),
    },
    {
      id: 'csv',
      title: 'CSV',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            Añade <K>format=csv</K> a cualquier endpoint de datos para recibir una tabla plana, con una columna por
            estadístico (<K>download_median_mbps</K>, <K>latency_p90_ms</K>, …). Abre directamente en Excel, Numbers
            o pandas.
          </p>
          <Code>{`curl -H "X-API-Key: TU_CLAVE" \\
  "${BASE}/api/v1/speedtests/provinces?days=30&format=csv" \\
  -o velocidades-provincias.csv`}</Code>
        </>
      ),
    },
    {
      id: 'errors',
      title: 'Errores y límites',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            Los errores usan el código HTTP correspondiente y un cuerpo uniforme:
          </p>
          <Code>{`{ "error": { "code": "invalid_range", "message": "from must be earlier than to." } }`}</Code>
          <Table
            head={['HTTP', 'code', 'Qué pasó']}
            rows={[
              [<span key="a" style={{ color: C.amber }}>400</span>, <K key="b">invalid_from</K>, 'Fecha mal formada.'],
              [
                '400',
                <K key="c">invalid_range</K>,
                <>
                  <K>from</K> no es anterior a <K>to</K>.
                </>,
              ],
              ['400', <K key="d">range_too_large</K>, 'El rango supera 366 días.'],
              ['400', <K key="e">unknown_province</K>, 'Código de provincia inexistente.'],
              [
                '400',
                <K key="f">conflicting_params</K>,
                <>
                  Se pasó <K>days</K> junto a <K>from</K>/<K>to</K>.
                </>,
              ],
              [<span key="g" style={{ color: C.red }}>401</span>, <K key="h">missing_api_key</K>, 'No se envió clave.'],
              ['401', <K key="i">invalid_api_key</K>, 'La clave no es válida.'],
              [
                <span key="j" style={{ color: C.red }}>429</span>,
                <K key="k">rate_limited</K>,
                'Se superó el límite de peticiones.',
              ],
              [
                <span key="l" style={{ color: C.red }}>500</span>,
                <K key="m">internal_error</K>,
                'Fallo del servidor; reintenta.',
              ],
            ]}
          />
          <p style={{ margin: '10px 0 0' }}>
            El límite es de <strong>120 peticiones por minuto</strong> por clave. Cada respuesta incluye{' '}
            <K>X-RateLimit-Limit</K>, <K>X-RateLimit-Remaining</K> y <K>X-RateLimit-Reset</K> (epoch en segundos);
            un <K>429</K> añade <K>Retry-After</K>. Las respuestas se pueden cachear 5 minutos.
          </p>
        </>
      ),
    },
    {
      id: 'examples',
      title: 'Ejemplos de código',
      body: (
        <>
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
        </>
      ),
    },
    {
      id: 'openapi',
      title: 'OpenAPI / Postman',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            La especificación OpenAPI 3.0 está publicada y es de acceso libre (no requiere clave). Puedes
            importarla en Postman, Insomnia, Bruno o generar un cliente con ella:
          </p>
          <Code>{`${BASE}/api/v1/openapi.json`}</Code>
        </>
      ),
    },
    {
      id: 'usage',
      title: 'Uso y atribución',
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            Los datos se ofrecen bajo{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/deed.es" style={{ color: C.accent }}>CC BY 4.0</a>:
            puedes publicarlos, redistribuirlos y construir sobre ellos, citando la fuente. Atribución sugerida:
          </p>
          <Code>{`Fuente: Cuba Internet Monitor (CubaPK / elToque) — internet.cubapk.com`}</Code>
          <p style={{ margin: '10px 0 0' }}>
            Si vas a publicar análisis con estos datos, te agradecemos —y te lo recomendamos— explicar que se trata
            de tests hechos voluntariamente por usuarios y no de una muestra representativa. Para dudas, rotación de
            claves, límites más altos o acceso a otras métricas del monitor (apagones, BGP, censura, tráfico),
            escríbenos.
          </p>
        </>
      ),
    },
  ],
};

function ProvinceChips() {
  return (
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
          <strong style={{ color: C.accent, fontFamily: 'ui-monospace, Menlo, monospace' }}>{p.id}</strong> {p.name}
        </span>
      ))}
    </div>
  );
}

export const DICTS: Record<Lang, Dict> = { en: EN, es: ES };

export const PATHS: Record<Lang, string> = { en: '/docs/api', es: '/docs/api/es' };

function LangSwitch({ lang }: { lang: Lang }) {
  const items: [Lang, string][] = [['en', 'English'], ['es', 'Español']];
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
      {items.map(([code, label], i) => (
        <span key={code} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {i > 0 && <span style={{ color: C.border }}>·</span>}
          {code === lang ? (
            <span style={{ color: C.text, fontWeight: 600 }}>{label}</span>
          ) : (
            <a href={PATHS[code]} hrefLang={code} style={{ color: C.accent, textDecoration: 'none' }}>
              {label}
            </a>
          )}
        </span>
      ))}
    </div>
  );
}

export function ApiDocs({ lang }: { lang: Lang }) {
  const t = DICTS[lang];

  return (
    <main
      lang={lang}
      style={{
        maxWidth: 940,
        margin: '0 auto',
        padding: '32px 20px 96px',
        fontSize: 15,
        lineHeight: 1.7,
        color: C.text,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <a href="/dashboard" style={{ color: C.muted, fontSize: 14, textDecoration: 'none' }}>
          {t.back}
        </a>
        <LangSwitch lang={lang} />
      </div>

      <h1 style={{ fontSize: 34, margin: '18px 0 10px', lineHeight: 1.2 }}>{t.h1}</h1>
      <p style={{ color: C.muted, fontSize: 17, margin: 0 }}>{t.lead}</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0 8px' }}>
        {t.badges.map(([label, value]) => (
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
        <div style={{ color: C.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {t.baseUrlLabel}
        </div>
        <div style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 16, marginTop: 4 }}>
          {BASE}/api/v1
        </div>
      </div>

      <nav style={{ marginTop: 28 }}>
        <div style={{ color: C.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          {t.tocLabel}
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, columns: 2, columnGap: 28, fontSize: 14 }}>
          {t.sections.map(s => (
            <li key={s.id} style={{ breakInside: 'avoid', marginBottom: 2 }}>
              <a href={`#${s.id}`} style={{ color: C.accent, textDecoration: 'none' }}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {t.sections.map(s => (
        <Section key={s.id} id={s.id} title={s.title}>
          {s.body}
        </Section>
      ))}

      <p style={{ margin: '28px 0 0', color: C.muted, fontSize: 13, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
        {t.footer}
      </p>
    </main>
  );
}
