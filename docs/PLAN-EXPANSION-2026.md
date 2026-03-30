# Monitor Internet Cuba - Plan de Expansion 2026

## Ficha de Costo y Planificacion de Tareas

**Proyecto:** Monitor Internet Cuba - Expansion de Servicios
**Cliente:** [Por definir]
**Fecha:** Marzo 2026
**Periodo de soporte:** 12 meses post-lanzamiento
**Equipo:** 1 Technical Lead + 2 Developers

---

## 1. Resumen Ejecutivo

La plataforma actual monitoriza el internet de Cuba usando fuentes publicas (RIPE Stat, IODA, OONI, Cloudflare Radar, M-Lab, Ookla) y pruebas de velocidad crowdsourced. Esta expansion agrega **tres nuevos servicios** que requieren datos internos recopilados por colaboradores en Cuba:

| Servicio Nuevo | Descripcion |
|---|---|
| **VPN Tracker** | Monitoreo diario del funcionamiento y velocidad de VPNs/protocolos dentro de Cuba |
| **Starlink Tracker** | Seguimiento de conexiones Starlink activas y sus velocidades en Cuba |
| **Desglose por Red** | Metricas separadas por tipo de red (Nauta Hogar, Datos Moviles, Educacion, Empresas) |
| **Monitor de Bloqueos Expandido** | Seguimiento de medios independientes bloqueados en todas las redes cubanas |

---

## 2. Arquitectura de los Nuevos Servicios

### 2.1 VPN Tracker Service

**Objetivo:** Mantener un registro actualizado de todas las VPNs que funcionan en Cuba, con datos de velocidad y disponibilidad, para generar recomendaciones.

**Componentes:**

```
Colaboradores en Cuba (5-10 inicialmente)
        |
        v
[Script/App Movil] -- datos diarios --> [API Endpoint /api/vpn/report]
        |                                         |
        v                                         v
  Verificacion automatica:              MongoDB (vpn_reports collection)
  - VPN activa? (si/no)                          |
  - Protocolo (WireGuard, OpenVPN, etc.)         v
  - Velocidad descarga/subida              [Dashboard VPN]
  - Latencia                               - Ranking de VPNs
  - Proveedor                              - % disponibilidad
                                           - Velocidad promedio
                                           - Recomendaciones
```

**Entregables:**
1. App movil (React Native / Expo) o script CLI para colaboradores
2. API endpoints para recepcion y consulta de datos
3. Panel en dashboard con ranking y recomendaciones de VPNs
4. Sistema de gestion de colaboradores (registro, tokens de autenticacion)
5. Logica de crowdsourcing posterior (formulario publico)

### 2.2 Starlink Tracker Service

**Objetivo:** Monitorear la disponibilidad y rendimiento de conexiones Starlink dentro de Cuba.

**Componentes:**

```
Colaboradores con Starlink en Cuba (3-5 inicialmente)
        |
        v
[Script/App Movil] -- datos diarios --> [API Endpoint /api/starlink/report]
        |                                         |
        v                                         v
  Verificacion automatica:              MongoDB (starlink_reports collection)
  - Conexion activa? (si/no)                     |
  - Velocidad descarga/subida                    v
  - Latencia                             [Dashboard Starlink]
  - Ubicacion (provincia)                - Mapa de cobertura
  - Interrupciones detectadas            - Velocidad promedio
                                         - % uptime
                                         - Tendencias
```

**Entregables:**
1. Modulo de reporte en la app movil (compartido con VPN Tracker)
2. API endpoints especificos para Starlink
3. Panel en dashboard con mapa y estadisticas
4. Alertas de interrupciones Starlink

### 2.3 Desglose por Tipo de Red

**Objetivo:** Segmentar todas las metricas existentes y nuevas por tipo de red cubana.

**Redes a monitorear:**
- **Nauta Hogar** (WiFi residencial de ETECSA)
- **Datos Moviles** (3G/LTE de ETECSA)
- **Redes Educativas** (universidades y centros de educacion)
- **Redes Empresariales** (conexiones corporativas/estatales)

**Entregables:**
1. Campo `network_type` en todos los reportes (speed tests, VPN, Starlink)
2. Selector de red en el dashboard para filtrar todas las metricas
3. Comparativas de rendimiento entre redes
4. Collectors ajustados para diferenciar por red donde sea posible

### 2.4 Monitor de Bloqueos Expandido

**Objetivo:** Ampliar el monitoreo de OONI para cubrir todos los medios independientes bloqueados, desglosado por cada tipo de red.

**Entregables:**
1. Lista curada y mantenida de medios independientes cubanos (URLs)
2. Pruebas OONI programadas por tipo de red
3. Dashboard de bloqueos con filtro por red y por medio
4. Alertas cuando un medio nuevo es bloqueado o desbloqueado
5. Reportes historicos de censura por medio y red

---

## 3. Fases del Proyecto

### Fase 1: Infraestructura Base (Semanas 1-4)

| Tarea | Responsable | Duracion |
|---|---|---|
| Diseno de schema MongoDB para nuevas colecciones | Dev 1 | 3 dias |
| API de autenticacion de colaboradores (tokens JWT) | Dev 1 | 5 dias |
| Estructura base de la app movil (Expo/React Native) | Dev 2 | 8 dias |
| Endpoints base para VPN y Starlink reports | Dev 1 | 5 dias |
| Campo `network_type` en speed test existente y migracion | Dev 2 | 3 dias |
| Code review y QA | Tech Lead | Continuo |

### Fase 2: VPN Tracker (Semanas 5-8)

| Tarea | Responsable | Duracion |
|---|---|---|
| Logica de verificacion de VPN en app movil | Dev 2 | 8 dias |
| Motor de pruebas automaticas (protocolos VPN) | Dev 1 | 6 dias |
| Dashboard VPN: graficas de disponibilidad y velocidad | Dev 1 | 5 dias |
| Sistema de ranking y recomendaciones | Dev 2 | 4 dias |
| Integracion con sistema de alertas existente | Dev 1 | 2 dias |
| Testing con colaboradores piloto | Equipo | 3 dias |

### Fase 3: Starlink Tracker (Semanas 9-11)

| Tarea | Responsable | Duracion |
|---|---|---|
| Modulo Starlink en app movil | Dev 2 | 5 dias |
| API endpoints Starlink y logica de agregacion | Dev 1 | 4 dias |
| Dashboard Starlink con mapa de cobertura | Dev 1 | 5 dias |
| Alertas de interrupciones Starlink | Dev 2 | 2 dias |
| Testing con colaboradores piloto | Equipo | 3 dias |

### Fase 4: Desglose por Red y Bloqueos (Semanas 12-16)

| Tarea | Responsable | Duracion |
|---|---|---|
| Selector de red en dashboard global | Dev 1 | 4 dias |
| Refactor de collectors ETL para segmentar por red | Dev 1 | 6 dias |
| Lista curada de medios independientes cubanos | Tech Lead | 3 dias |
| Expansion del collector OONI por red y medios | Dev 2 | 6 dias |
| Dashboard de bloqueos expandido | Dev 2 | 5 dias |
| Comparativas entre redes | Dev 1 | 4 dias |
| Integracion con Indice de Apertura | Dev 2 | 3 dias |

### Fase 5: Crowdsourcing y Polish (Semanas 17-20)

| Tarea | Responsable | Duracion |
|---|---|---|
| Formulario publico para reportes VPN crowdsourced | Dev 1 | 4 dias |
| Formulario publico para reportes Starlink | Dev 1 | 3 dias |
| Validacion y anti-spam para datos crowdsourced | Dev 2 | 4 dias |
| Notas AI semanales con nuevos datos integrados | Dev 2 | 3 dias |
| QA general, performance testing | Equipo | 5 dias |
| Documentacion tecnica y de usuario | Tech Lead + Devs | 3 dias |
| Deploy a produccion | Tech Lead | 2 dias |

---

## 4. Desglose de Costos

> Todos los costos referenciados a precios de mercado en USA (2026).

### 4.1 Equipo de Desarrollo

| Rol | Dedicacion | Tarifa Mensual (USD) | Meses | Total (USD) |
|---|---|---|---|---|
| Technical Lead | Part-time (20h/sem) | $8,000 | 5 | $40,000 |
| Developer 1 (Full-stack Senior) | Full-time (40h/sem) | $10,000 | 5 | $50,000 |
| Developer 2 (Mobile + Frontend) | Full-time (40h/sem) | $9,000 | 5 | $45,000 |
| **Subtotal Desarrollo** | | | | **$135,000** |

### 4.2 Soporte Post-Lanzamiento (12 meses)

| Rol | Dedicacion | Tarifa Mensual (USD) | Meses | Total (USD) |
|---|---|---|---|---|
| Technical Lead | 5h/semana | $2,000 | 12 | $24,000 |
| Developer 1 (mantenimiento) | 10h/semana | $2,500 | 12 | $30,000 |
| Developer 2 (on-call) | 5h/semana | $2,000 | 12 | $24,000 |
| **Subtotal Soporte** | | | | **$78,000** |

### 4.3 Colaboradores en Cuba

| Concepto | Cantidad | Pago Mensual (USD) | Meses | Total (USD) |
|---|---|---|---|---|
| Colaboradores VPN (verificacion diaria) | 8 | $50 | 12 | $4,800 |
| Colaboradores Starlink | 5 | $50 | 12 | $3,000 |
| Coordinador en Cuba | 1 | $150 | 12 | $1,800 |
| **Subtotal Colaboradores** | | | | **$9,600** |

> Nota: Los pagos a colaboradores son estimados iniciales. A medida que se implemente crowdsourcing, la dependencia de colaboradores pagados podria reducirse.

### 4.4 Infraestructura y Servicios

| Servicio | Costo Mensual (USD) | Meses | Total (USD) |
|---|---|---|---|
| Servidor VPS (upgrade para nuevos servicios) | $80 | 17 | $1,360 |
| MongoDB Atlas (si se migra) o almacenamiento extra | $50 | 17 | $850 |
| Cloudflare API (tier superior si necesario) | $25 | 17 | $425 |
| Apple Developer Account (app iOS) | $8.25 | 12 | $99 |
| Google Play Developer (app Android) | -- | -- | $25 |
| Dominio y certificados | $15 | 17 | $255 |
| Servicios de envio de pagos (colaboradores) | $20 | 12 | $240 |
| **Subtotal Infraestructura** | | | **$3,254** |

### 4.5 Herramientas y Licencias

| Herramienta | Costo (USD) |
|---|---|
| Expo EAS Build (app movil, plan Production) | $99/mes x 5 meses = $495 |
| OpenAI API (incremento por analisis expandido) | ~$30/mes x 17 = $510 |
| Sentry / monitoring (error tracking) | $26/mes x 17 = $442 |
| **Subtotal Herramientas** | **$1,447** |

---

### 4.6 Resumen Total de Costos

| Categoria | Total (USD) |
|---|---|
| Desarrollo (5 meses) | $135,000 |
| Soporte post-lanzamiento (12 meses) | $78,000 |
| Colaboradores en Cuba (12 meses) | $9,600 |
| Infraestructura (17 meses) | $3,254 |
| Herramientas y licencias | $1,447 |
| **TOTAL PROYECTO** | **$227,301** |

| | |
|---|---|
| **Contingencia (10%)** | $22,730 |
| **TOTAL CON CONTINGENCIA** | **$250,031** |

---

## 5. Cronograma Visual

```
2026
Abril       Mayo        Junio       Julio       Agosto      Sept
|-----------|-----------|-----------|-----------|-----------|
|  FASE 1   |  FASE 2   |   FASE 3  |      FASE 4         |
| Infra     | VPN       |  Starlink |  Redes + Bloqueos   |
| Base      | Tracker   |  Tracker  |                     |
|-----------|-----------|-----------|-----------|-----------|
                                                |  FASE 5   |
                                                | Crowdsrc  |
                                                | + Deploy  |
                                                |-----------|

Sept 2026 - Sept 2027: SOPORTE (12 meses)
```

---

## 6. Entregables por Fase

### Al finalizar Fase 1 (Semana 4):
- [ ] Base de datos con nuevas colecciones configuradas
- [ ] API de autenticacion para colaboradores funcional
- [ ] App movil con estructura base instalable (TestFlight/APK)
- [ ] Speed test existente con campo `network_type`

### Al finalizar Fase 2 (Semana 8):
- [ ] Colaboradores piloto reportando datos VPN diariamente
- [ ] Dashboard VPN con ranking y recomendaciones en vivo
- [ ] Sistema de alertas integrado con VPN data

### Al finalizar Fase 3 (Semana 11):
- [ ] Colaboradores Starlink reportando datos
- [ ] Dashboard Starlink con mapa de cobertura
- [ ] Alertas de interrupciones Starlink

### Al finalizar Fase 4 (Semana 16):
- [ ] Todas las metricas desglosadas por tipo de red
- [ ] Monitor de bloqueos expandido a todos los medios independientes
- [ ] Dashboard comparativo entre redes

### Al finalizar Fase 5 (Semana 20):
- [ ] Formularios crowdsourced publicos para VPN y Starlink
- [ ] Indice de Apertura actualizado con nuevas metricas
- [ ] Documentacion completa
- [ ] Despliegue en produccion

---

## 7. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Dificultad para reclutar colaboradores en Cuba | Alto | Comenzar reclutamiento en Fase 1; red de contactos existente |
| Bloqueo de la app movil en Cuba | Alto | Distribucion via APK directo (no Play Store); version web como fallback |
| Inestabilidad de pagos a Cuba | Medio | Multiples canales de pago; pago trimestral anticipado |
| Cambios en APIs de fuentes publicas | Medio | Abstracciones en collectors; monitoreo de cambios en APIs |
| Datos crowdsourced de baja calidad | Medio | Validacion estadistica; deteccion de outliers; verificacion cruzada |
| Baja adopcion del crowdsourcing | Bajo | Mantener colaboradores pagados como respaldo |

---

## 8. Metricas de Exito

| Metrica | Objetivo (6 meses post-lanzamiento) |
|---|---|
| VPNs monitoreadas | >= 15 proveedores/protocolos |
| Reportes VPN diarios | >= 50 (pagados + crowdsourced) |
| Puntos Starlink monitoreados | >= 5 ubicaciones |
| Redes cubanas cubiertas | 4/4 (Nauta Hogar, Movil, Educacion, Empresas) |
| Medios independientes monitoreados | >= 30 URLs |
| Uptime de la plataforma | >= 99.5% |
| Usuarios unicos mensuales del dashboard | >= 1,000 |

---

## 9. Stack Tecnico (Expansion)

Basado en la arquitectura existente del proyecto:

| Componente | Tecnologia | Justificacion |
|---|---|---|
| App Movil | React Native (Expo) | Comparte ecosistema React con el frontend existente |
| Nuevos API endpoints | Next.js API Routes | Consistente con la arquitectura actual |
| Nuevas colecciones DB | MongoDB time-series | Misma estrategia que datos existentes |
| Nuevos collectors ETL | Node.js + node-cron | Extension del ETL existente |
| Autenticacion colaboradores | JWT + API keys | Ligero, sin dependencias externas |
| Distribucion app | Expo EAS + APK directo | Necesario para acceso en Cuba |

---

*Documento generado el 30 de marzo de 2026.*
*Todos los costos son estimados y estan sujetos a revision.*
