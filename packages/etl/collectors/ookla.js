import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { insertMetrics } from '../db.js';

const DATA_DIR = '/app/data/ookla';

export async function collectOokla() {
  console.log('[Ookla] Checking for new quarterly data');

  // Determine latest quarter
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  // Data is usually available 1 quarter behind
  const dataQ = quarter === 1 ? 4 : quarter - 1;
  const dataYear = quarter === 1 ? year - 1 : year;
  const datePrefix = `${dataYear}-${String((dataQ - 1) * 3 + 1).padStart(2, '0')}-01`;

  const localFile = `${DATA_DIR}/${datePrefix}_performance_mobile_tiles.parquet`;

  if (existsSync(localFile)) {
    console.log('[Ookla] Data already downloaded for', datePrefix);
    return [];
  }

  mkdirSync(DATA_DIR, { recursive: true });

  const s3Path = `s3://ookla-open-data/parquet/performance/type=mobile/year=${dataYear}/quarter=${dataQ}/`;

  try {
    execSync(`aws s3 cp ${s3Path}${datePrefix}_performance_mobile_tiles.parquet ${localFile} --no-sign-request`, {
      timeout: 300000,
      stdio: 'pipe',
    });
    console.log('[Ookla] Downloaded', localFile);
  } catch (err) {
    console.warn('[Ookla] Download failed (aws cli may not be available):', err.message);
    return [];
  }

  // Note: Parquet processing requires additional dependencies (parquetjs/arrow)
  // For the initial version, we log the download. Full processing can be added with pyarrow or duckdb.
  console.log('[Ookla] Parquet file ready for processing. Cuba bounding box filter needed.');
  return [];
}
