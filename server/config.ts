import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export function defaultDataDir(platform = process.platform, env = process.env, home = homedir()) {
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'website-audit-hub');
  if (platform === 'win32') return join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'website-audit-hub');
  return join(env.XDG_DATA_HOME || join(home, '.local', 'share'), 'website-audit-hub');
}
export function getConfig() {
  const port = Number(process.env.PORT || 4310);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535.');
  return { port, host: '127.0.0.1', dataDir: resolve(process.env.HUB_DATA_DIR || defaultDataDir()) };
}
