import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

const isHtml = key => extname(key).toLowerCase() === '.html';

export function contentTypeFor(key) {
  return CONTENT_TYPES[extname(key).toLowerCase()] || 'application/octet-stream';
}

// Pages, their Markdown versions and the crawler files are checked on every visit. Other files have
// no fingerprint in their name, so one day is the safe limit.
export function cacheControlFor(key) {
  const fresh = isHtml(key) || extname(key).toLowerCase() === '.md' || ['robots.txt', 'sitemap.xml', 'llms.txt'].includes(basename(key));
  return fresh ? 'no-cache' : 'public, max-age=86400';
}

export function toKey(relativePath) {
  return relativePath.replaceAll('\\', '/');
}

// The pages go last, so that a visitor never gets a new page before the files it uses.
export function planUpload(localKeys, remoteKeys) {
  const local = new Set(localKeys);
  return {
    uploads: localKeys.toSorted((a, b) => isHtml(a) - isHtml(b)).map(key => ({ key, contentType: contentTypeFor(key), cacheControl: cacheControlFor(key) })),
    deletes: remoteKeys.filter(key => !local.has(key)),
  };
}

export function requireProfile(env) {
  if (!env.AWS_PROFILE) throw new Error('AWS_PROFILE is not set. In PowerShell: $env:AWS_PROFILE = "<profile>"');
}

export function readOutputs(json) {
  const outputs = JSON.parse(json || '{}');
  const [siteUrl, bucket, distributionId] = ['site_url', 'bucket_name', 'distribution_id'].map(name => outputs[name]?.value);
  if (!siteUrl || !bucket || !distributionId) throw new Error('Terraform outputs are missing: run "terraform apply" in infra/site first');
  return { siteUrl, bucket, distributionId };
}

function listFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .filter(p => statSync(join(dir, p)).isFile())
    .map(toKey)
    .sort();
}

// Runs a command without a shell. An empty AWS_PAGER stops the AWS CLI from waiting in a pager.
function run(command, args, { capture = false } = {}) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: 'utf8', env: { ...process.env, AWS_PAGER: '' }, stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit' });
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`${command} was not found. Install it and check PATH.`);
    throw new Error(`${command} ${args.join(' ')} failed (exit code ${err.status})`);
  }
}

async function deploy() {
  requireProfile(process.env);
  const { siteUrl, bucket, distributionId } = readOutputs(run('terraform', ['-chdir=infra/site', 'output', '-json'], { capture: true }));
  await build('dist', undefined, siteUrl);
  const localKeys = listFiles(join(root, 'dist'));
  const listed = run('aws', ['s3api', 'list-objects-v2', '--bucket', bucket, '--query', 'Contents[].Key', '--output', 'json'], { capture: true });
  const { uploads, deletes } = planUpload(localKeys, JSON.parse(listed) ?? []);
  for (const { key, contentType, cacheControl } of uploads) {
    run('aws', ['s3', 'cp', join(root, 'dist', key), `s3://${bucket}/${key}`, '--content-type', contentType, '--cache-control', cacheControl, '--only-show-errors']);
  }
  for (const key of deletes) run('aws', ['s3', 'rm', `s3://${bucket}/${key}`, '--only-show-errors']);
  run('aws', ['cloudfront', 'create-invalidation', '--distribution-id', distributionId, '--paths', '/*', '--query', 'Invalidation.Id', '--output', 'text']);
  console.log(`Uploaded ${uploads.length} files, deleted ${deletes.length}. Deployed: ${siteUrl}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await deploy();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
