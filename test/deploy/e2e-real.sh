#!/usr/bin/env bash
# The heavy one: runs deploy/install.sh against a real Docker daemon inside a
# throwaway Linux container, pulls the published image, and waits for the panel
# to report healthy. Nothing is mocked, and nothing touches this machine outside
# the container.
#
#   bash test/deploy/e2e-real.sh [image-tag]
#
# Needs Docker on the host and the ability to run a privileged container (the
# inner daemon requires it). Takes a few minutes: it installs Docker inside the
# container the same way the installer does, then pulls the panel image.
#
# The check snippets are single quoted on purpose: they run inside the
# container, so expanding them on this machine is exactly what must not happen.
# shellcheck disable=SC2016

set -euo pipefail

TAG="${1:-latest}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAME="msm-install-e2e-$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

printf '==> Starting a privileged Ubuntu container with the repo mounted.\n'
docker run -d --privileged --name "$NAME" -v "$REPO_DIR:/repo:ro" ubuntu:24.04 sleep 3600 >/dev/null

run() { docker exec "$NAME" bash -c "$1"; }

printf '==> Installing prerequisites and Docker inside it.\n'
run 'apt-get update -qq && apt-get install -y -qq curl ca-certificates iptables >/dev/null 2>&1'
run 'curl -fsSL https://get.docker.com | sh >/dev/null 2>&1'

printf '==> Starting the inner Docker daemon.\n'
run 'nohup dockerd --storage-driver=vfs >/var/log/dockerd.log 2>&1 & sleep 1' || true
for _ in $(seq 1 30); do
  if run 'docker info >/dev/null 2>&1'; then break; fi
  sleep 2
done
run 'docker info >/dev/null 2>&1' || {
  printf 'the inner daemon never came up:\n'
  run 'tail -30 /var/log/dockerd.log' || true
  exit 1
}
printf '    inner Docker: %s\n' "$(run "docker version --format '{{.Server.Version}}'" | tr -d '\r')"

printf '==> Running the installer for real (tag: %s).\n' "$TAG"
run "cp /repo/deploy/install.sh /tmp/install.sh && chmod +x /tmp/install.sh && NO_COLOR=1 /tmp/install.sh --skip-docker --tag '$TAG' --health-timeout 240"

printf '\n==> Checking what actually happened.\n'
fail=0
check() {
  if run "$2" >/dev/null 2>&1; then
    printf '  ok   %s\n' "$1"
  else
    printf '  FAIL %s\n' "$1"
    fail=1
  fi
}

check 'the panel container is running' 'docker ps --filter name=minecraft-server-manager --filter status=running --format "{{.Names}}" | grep -q minecraft-server-manager'
check 'Docker reports it healthy' '[ "$(docker inspect --format "{{.State.Health.Status}}" minecraft-server-manager)" = healthy ]'
check '/healthz answers 200' 'curl -fsS -o /dev/null -w "%{http_code}" http://127.0.0.1:25564/healthz | grep -q 200'
check 'the login page renders' 'curl -fsS http://127.0.0.1:25564/login | grep -qi "sign in\|setup"'
check 'the data directory is on the host side of the mount' '[ -d /opt/msm/data ]'
check 'the panel wrote into it' '[ -n "$(ls -A /opt/msm/data 2>/dev/null)" ]'
check 'DATA_DIR_HOST reached the container' 'docker inspect --format "{{range .Config.Env}}{{println .}}{{end}}" minecraft-server-manager | grep -q "^DATA_DIR_HOST=/opt/msm/data$"'
check 'the docker socket is mounted' 'docker inspect --format "{{range .Mounts}}{{println .Source}}{{end}}" minecraft-server-manager | grep -q "^/var/run/docker.sock$"'

printf '\n==> Re-running the installer (upgrade path).\n'
run 'NO_COLOR=1 /tmp/install.sh --skip-docker --health-timeout 240' >/dev/null
check 'still healthy after a second run' '[ "$(docker inspect --format "{{.State.Health.Status}}" minecraft-server-manager)" = healthy ]'
check 'no stray backup file, because nothing changed' '[ ! -f /opt/msm/docker-compose.yml.bak ]'

printf '\n==> Claiming the admin account through the first-run gate.\n'
# The panel is on an exposed bind here, so it demands the one-time PIN it wrote
# to its own log. Posting without one must be refused, and the installer is
# expected to have surfaced the PIN in its output.
check 'setup without the PIN is refused' 'test "$(curl -s -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"e2e-Passw0rd-123\"}" http://127.0.0.1:25564/setup)" = 403'
PIN="$(run 'docker logs minecraft-server-manager 2>&1 | grep -o "\"pin\":\"[0-9]\{6\}\"" | tail -1 | grep -o "[0-9]\{6\}"' | tr -d '\r')"
if [ -n "$PIN" ]; then
  printf '  ok   the panel published a setup PIN (%s)\n' "$PIN"
else
  printf '  FAIL no setup PIN in the panel log\n'
  fail=1
fi
if run "curl -fsS -c /tmp/j -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"e2e-Passw0rd-123\",\"pin\":\"$PIN\"}' http://127.0.0.1:25564/setup >/dev/null"; then
  printf '  ok   setup with the PIN created the admin account\n'
  check 'the API answers as that admin' 'curl -fsS -b /tmp/j http://127.0.0.1:25564/api/servers/live | grep -q "\"ok\":true"'
  check 'the panel DB landed in the data directory' '[ -f /opt/msm/data/panel.db ]'
else
  printf '  FAIL setup with the PIN\n'
  fail=1
fi

printf '\n==> Uninstalling.\n'
run 'NO_COLOR=1 /tmp/install.sh --uninstall --yes' >/dev/null
check 'the panel container is gone' '! docker ps -a --format "{{.Names}}" | grep -q minecraft-server-manager'
check 'the data directory survived' '[ -d /opt/msm/data ]'
run 'NO_COLOR=1 /tmp/install.sh --uninstall --purge --yes' >/dev/null 2>&1 || true
check '--purge removed the data' '[ ! -d /opt/msm/data ]'

printf '\n'
if [ "$fail" -eq 0 ]; then
  printf 'end to end: everything passed\n'
else
  printf 'end to end: FAILURES above\n'
  exit 1
fi
