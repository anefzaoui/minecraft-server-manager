// Installer commands shared by the install tutorial, the installer options on
// /install/ and the HowTo structured data, so they are written once. Commands
// are never translated.
import pkg from '../../../package.json';
const RAW = 'https://raw.githubusercontent.com/anefzaoui/minecraft-server-manager/main';
const PIPE = `curl -fsSL ${RAW}/deploy/install.sh | sudo bash`;

export const INSTALLER = PIPE;
export const RAW_COMPOSE = `${RAW}/docker-compose.yml`;

/** One example per option of deploy/install.sh (its usage() text), keyed like install.options.items. */
export const INSTALLER_OPTIONS = [
  { key: 'port', flags: `--port 8080`, cmd: `${PIPE} -s -- --port 8080` },
  { key: 'proxy', flags: `--bind 127.0.0.1`, cmd: `${PIPE} -s -- --bind 127.0.0.1` },
  { key: 'tag', flags: `--tag v${pkg.version}`, cmd: `${PIPE} -s -- --tag v${pkg.version}` },
  { key: 'dir', flags: `--dir /srv/msm`, cmd: `${PIPE} -s -- --dir /srv/msm` },
  { key: 'uninstall', flags: `--uninstall --yes`, cmd: `${PIPE} -s -- --uninstall --yes` },
  { key: 'help', flags: `--help`, cmd: `${PIPE} -s -- --help` },
];
