import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

export function contentTypeFor(key) {
  return CONTENT_TYPES[extname(key).toLowerCase()] || 'application/octet-stream';
}

// Pages and the two crawler files are checked on every visit. Other files have no fingerprint
// in their name, so one day is the safe limit.
export function cacheControlFor(key) {
  const name = basename(key);
  if (extname(name).toLowerCase() === '.html' || name === 'robots.txt' || name === 'sitemap.xml') return 'no-cache';
  return 'public, max-age=86400';
}

export function toKey(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

export function planUpload(localKeys, remoteKeys) {
  const local = new Set(localKeys);
  return {
    uploads: localKeys.map(key => ({ key, contentType: contentTypeFor(key), cacheControl: cacheControlFor(key) })),
    deletes: remoteKeys.filter(key => !local.has(key)),
  };
}

export function readOutputs(json) {
  const hint = 'run "terraform apply" in infra/site first';
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error(`No Terraform outputs found: ${hint}`);
  }
  const value = name => data?.[name]?.value;
  const siteUrl = value('site_url');
  const bucket = value('bucket_name');
  const distributionId = value('distribution_id');
  if (!siteUrl || !bucket || !distributionId) throw new Error(`A Terraform output is missing: ${hint}`);
  return { siteUrl, bucket, distributionId };
}

function listFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .filter(p => statSync(join(dir, p)).isFile())
    .map(toKey)
    .sort();
}

// Runs a command without a shell. A failure names the command that failed.
function run(command, args, { capture = false } = {}) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit' });
  } catch (err) {
    throw new Error(`Command failed: ${command} ${args.join(' ')} (${err.message})`);
  }
}

async function deploy() {
  const { siteUrl, bucket, distributionId } = readOutputs(run('terraform', ['-chdir=infra/site', 'output', '-json'], { capture: true }));
  await build('dist', undefined, siteUrl);
  const localKeys = listFiles(join(root, 'dist'));
  const listed = run('aws', ['s3api', 'list-objects-v2', '--bucket', bucket, '--query', 'Contents[].Key', '--output', 'json'], { capture: true });
  const remoteKeys = JSON.parse(listed || 'null') || [];
  const { uploads, deletes } = planUpload(localKeys, remoteKeys);
  for (const { key, contentType, cacheControl } of uploads) {
    run('aws', ['s3', 'cp', join(root, 'dist', key), `s3://${bucket}/${key}`, '--content-type', contentType, '--cache-control', cacheControl]);
  }
  for (const key of deletes) run('aws', ['s3', 'rm', `s3://${bucket}/${key}`]);
  run('aws', ['cloudfront', 'create-invalidation', '--distribution-id', distributionId, '--paths', '/*']);
  console.log(`Deployed: ${siteUrl}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await deploy();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
