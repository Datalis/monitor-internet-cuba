# Retención de datos

**No hay TTL en esta base de datos. No lo reintroduzcas sin leer esto.**

## Por qué

La colección `metrics` mezcla dos tipos de dato:

- **Datos de ETL** (`ripe-stat`, `cloudflare*`, `ioda`, `ooni`, `mlab`): se pueden
  re-descargar de la fuente original.
- **Tests crowdsourced** (`metadata.source: 'crowdsourced'`): los corre gente en Cuba
  desde su navegador contra `/api/speedtest/*`. **No existen en ninguna otra parte.**
  Si se borran, se pierden para siempre.

Un TTL sobre `metrics` borra ambos por igual, en silencio, sin log ni alerta.

## Incidente 2026-09-19

`mongo/init.js` creó `metrics` con `expireAfterSeconds: 7776000` (90 días) desde el
commit inicial (`aa13112`, 2026-03-13). Estuvo activo en producción los 189 días de
vida del proyecto.

- Producción arrancó el **2026-03-14** (creación del volumen `mongo_data`).
- Al detectarlo, el dato más antiguo era del **2026-06-20**.
- **97 días de historia (51%) ya se habían borrado**, incluidos unos ~7.500 tests
  crowdsourced irrecuperables.
- No había ningún respaldo: sin cron de backup, sin snapshots, volumen `etl_data` vacío.

Corregido desactivando el TTL en caliente sobre la base viva y quitándolo de este
script para despliegues nuevos.

## Verificar que sigue desactivado

```bash
docker compose exec -T mongo mongosh cuba_monitor --quiet --eval '
  const i = db.getCollectionInfos({name:"metrics"})[0];
  print("TTL metrics: " + i.options.expireAfterSeconds);   // debe ser undefined
  db.getCollectionNames().forEach(n => {
    if (n.startsWith("system.")) return;
    db.getCollection(n).getIndexes().forEach(x => {
      if (x.expireAfterSeconds !== undefined) print("TTL EN INDICE: " + n + "." + x.name);
    });
  });
  printjson(db.metrics.find().sort({timestamp:1}).limit(1).toArray()[0].timestamp);
'
```

El timestamp más antiguo debe ir alejándose en el tiempo, nunca quedarse fijo a
N días del presente. Si se queda fijo, hay un TTL activo otra vez.

## Ojo

`mongo/init.js` **solo corre cuando el volumen está vacío** (`docker-entrypoint-initdb.d`).
Cambiar este archivo no afecta a una base ya existente: para eso hace falta `collMod`.

```js
// desactivar TTL en una coleccion time-series ya creada
db.runCommand({ collMod: "metrics", expireAfterSeconds: "off" })
```
