# Monitor de Internet Cuba

Plataforma de monitoreo en tiempo real del estado de internet en Cuba. Recopila datos de múltiples fuentes públicas (RIPE, IODA, OONI, Cloudflare Radar) para ofrecer un dashboard interactivo con métricas de conectividad, velocidad, censura y apagones.

**Sitio en producción:** [internet.cubapk.com](https://internet.cubapk.com)

Un proyecto colaborativo entre [CubaPK](https://cubapk.com) y [elToque](https://eltoque.com).

## Funcionalidades

- **Dashboard en tiempo real** — Visibilidad BGP, detección de apagones (IODA), tráfico (Cloudflare), censura (OONI) y velocidad (M-Lab)
- **Test de velocidad** — Herramienta de speedtest que mide latencia, descarga y subida desde el navegador, con resultados por provincia
- **Índice de Apertura** — Indicador compuesto (0-100) que combina todas las métricas para resumir el estado de internet en Cuba vs el mundo
- **Mapa provincial** — Visualización de velocidad por provincia
- **Notas con IA** — Resúmenes semanales y alertas de apagones generados automáticamente con OpenAI
- **Alertas en Slack** — Notificaciones automáticas al equipo
- **API REST** — Endpoints públicos para consumir los datos

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                  Docker Compose                  │
│                                                  │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  MongoDB 7 │  │    ETL    │  │   Web API   │  │
│  │ (timeseries│  │ (node-cron│  │  (Next.js)  │  │
│  │  colecciones│  │ collectors│  │  port 3000  │  │
│  │  port 27017)│  │ port 4000)│  │             │  │
│  └─────┬──────┘  └─────┬─────┘  └──────┬──────┘  │
│        │               │               │         │
│        └───────────────┼───────────────┘         │
│                        │                          │
└────────────────────────┼──────────────────────────┘
                         │
            Fuentes externas de datos:
            RIPE Stat · IODA · OONI
            Cloudflare Radar · M-Lab · Ookla
```

### Estructura del proyecto

```
monitor-internet/
├── packages/
│   ├── api/                 # Next.js 14 — dashboard web + API REST
│   │   ├── app/
│   │   │   ├── dashboard/   # Página principal del dashboard
│   │   │   ├── speedtest/   # Herramienta de test de velocidad
│   │   │   ├── indice/      # Página del Índice de Apertura
│   │   │   └── api/         # Rutas de la API REST
│   │   └── lib/             # Conexión a MongoDB, utilidades
│   │
│   ├── etl/                 # Servicio de recolección de datos
│   │   ├── index.js         # Scheduler con node-cron
│   │   └── collectors/      # Colectores por fuente de datos
│   │
│   └── shared/              # Tipos TypeScript compartidos
│
├── mongo/
│   └── init.js              # Inicialización de MongoDB (colecciones, índices)
├── docker-compose.yml
└── .env.example
```

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, Next.js 14, TypeScript, Recharts |
| Backend | Next.js API Routes (Node.js 20) |
| Base de datos | MongoDB 7 (colecciones time-series) |
| Recolección de datos | Node.js + node-cron |
| IA | OpenAI API (resúmenes y alertas) |
| Despliegue | Docker Compose, Traefik |

## Instalación

### Prerrequisitos

- [Docker](https://docs.docker.com/get-docker/) y Docker Compose
- [Node.js 20+](https://nodejs.org/) (solo para desarrollo local sin Docker)
- Token de API de Cloudflare Radar (obligatorio)

### 1. Clonar el repositorio

```bash
git clone https://github.com/Datalis/monitor-internet-cuba.git
cd monitor-internet-cuba
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Si | Token de Cloudflare Radar ([crear aquí](https://dash.cloudflare.com/profile/api-tokens), permiso "Cloudflare Radar: Read") |
| `MONGO_URI` | Si | URI de MongoDB (en Docker: `mongodb://mongo:27017/monitor`) |
| `OPENAI_API_KEY` | No | Para generar resúmenes automáticos con IA |
| `OPENAI_MODEL` | No | Modelo de OpenAI (default: `gpt-5-mini`) |
| `SLACK_BOT_TOKEN` | No | Token del bot de Slack para alertas |
| `SLACK_CHANNEL_ID` | No | Canal de Slack donde enviar alertas |

### 3. Levantar con Docker Compose

```bash
docker compose up -d
```

Esto levanta tres servicios:
- **mongo** — Base de datos MongoDB 7
- **etl** — Servicio que recolecta datos automáticamente
- **web-api** — Dashboard web en `http://localhost:3000`

### Desarrollo local (sin Docker)

Si prefieres desarrollar sin Docker, necesitas una instancia de MongoDB corriendo localmente.

```bash
# Instalar dependencias
cd packages/api && npm install
cd ../etl && npm install

# Iniciar el API (en una terminal)
cd packages/api
npm run dev

# Iniciar el ETL (en otra terminal)
cd packages/etl
node index.js
```

## API REST

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/metrics` | GET | Métricas (filtrable por `source`, `province`, `hours`, `limit`) |
| `/api/blocking` | GET | Datos de censura OONI (parámetro `days`) |
| `/api/outages` | GET | Apagones activos y resueltos |
| `/api/provinces` | GET | Lista de provincias |
| `/api/speedtest/stats` | GET | Estadísticas de velocidad crowdsourced |
| `/api/notes` | GET | Notas generadas por IA |
| `/api/alerts` | GET | Alertas del sistema |

### Ejemplo

```bash
# Obtener métricas de OONI de las últimas 24 horas
curl "http://localhost:3000/api/metrics?source=ooni&hours=24"

# Obtener apagones activos
curl "http://localhost:3000/api/outages"
```

## Fuentes de datos

| Fuente | Datos | Frecuencia |
|--------|-------|-----------|
| [RIPE Stat](https://stat.ripe.net/) (AS27725) | Prefijos BGP, visibilidad | Cada 5 min |
| [IODA](https://ioda.inetintel.cc.gatech.edu/) | Detección de apagones | Cada 15 min |
| [Cloudflare Radar](https://radar.cloudflare.com/) | Tráfico, anomalías | Cada 15 min |
| [OONI](https://ooni.org/) | Censura, bloqueos confirmados | Cada 30 min |
| Crowdsourced | Tests de velocidad de usuarios | Tiempo real |

## Contribuir

Las contribuciones son bienvenidas. Sigue estos pasos:

### 1. Fork y branch

```bash
# Fork el repositorio en GitHub, luego:
git clone https://github.com/TU-USUARIO/monitor-internet-cuba.git
cd monitor-internet-cuba
git checkout -b feature/mi-mejora
```

### 2. Desarrolla tu cambio

- Sigue la estructura existente del proyecto
- Mantén los commits descriptivos
- Si agregas un nuevo colector de datos, colócalo en `packages/etl/collectors/`
- Si agregas una nueva página, colócala en `packages/api/app/`

### 3. Prueba localmente

```bash
docker compose up -d
# Verifica que el dashboard funcione en http://localhost:3000
# Verifica que el ETL recolecte datos revisando los logs:
docker compose logs -f etl
```

### 4. Envía un Pull Request

```bash
git push origin feature/mi-mejora
```

Abre un PR contra la rama `main` describiendo:
- Qué cambio hiciste y por qué
- Cómo probarlo
- Capturas de pantalla si aplica

### Ideas para contribuir

- Agregar nuevas fuentes de datos de monitoreo
- Mejorar visualizaciones del dashboard
- Agregar tests automatizados
- Traducciones (inglés, etc.)
- Documentación de la API
- Optimización de rendimiento

## Licencia

Este proyecto es open source. Consulta el archivo [LICENSE](LICENSE) para más detalles.
