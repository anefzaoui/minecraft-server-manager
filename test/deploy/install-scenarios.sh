#!/usr/bin/env bash
# Functional tests for deploy/install.sh, run inside a Linux container with a
# mocked docker CLI (see mock-docker.sh). No daemon, no network, no /opt.
#
#   docker run --rm -v "$PWD:/repo" -w /repo ubuntu:24.04 \
#     bash test/deploy/install-scenarios.sh
#
# Exits non-zero on the first failing assertion in a scenario, and prints a
# summary. `pnpm run test:deploy` wraps the docker invocation.

set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALLER="$REPO_DIR/deploy/install.sh"
MOCK_DIR="$(mktemp -d)"
PASS=0
FAIL=0
CURRENT=''

cp "$REPO_DIR/test/deploy/mock-docker.sh" "$MOCK_DIR/docker"
chmod +x "$MOCK_DIR/docker"
export PATH="$MOCK_DIR:$PATH"
export NO_COLOR=1

scenario() {
  CURRENT="$1"
  printf '\n--- %s\n' "$CURRENT"
}

ok() {
  PASS=$((PASS + 1))
  printf '  ok   %s\n' "$1"
}

bad() {
  FAIL=$((FAIL + 1))
  printf '  FAIL %s\n' "$1"
  if [ -n "${2:-}" ]; then printf '       %s\n' "$2"; fi
}

assert_contains() {
  case "$2" in
    *"$1"*) ok "$3" ;;
    *) bad "$3" "expected to find: $1" ;;
  esac
}

assert_not_contains() {
  case "$2" in
    *"$1"*) bad "$3" "did not expect: $1" ;;
    *) ok "$3" ;;
  esac
}

assert_file() {
  if [ -f "$1" ]; then ok "$2"; else bad "$2" "missing file: $1"; fi
}

assert_no_file() {
  if [ -f "$1" ]; then bad "$2" "unexpected file: $1"; else ok "$2"; fi
}

assert_status() {
  if [ "$1" -eq "$2" ]; then ok "$3"; else bad "$3" "exit $1, expected $2"; fi
}

# Runs the installer in its own throwaway root and captures output + status.
# Never touches `set -e`: a scenario that expects a failure is the norm here,
# and flipping the shell option mid-run silently ended the suite at the first
# non-zero command.
run_installer() {
  local out='' status=0
  out="$(MOCK_DOCKER_LOG="$MOCK_DIR/calls.log" "$INSTALLER" "$@" 2>&1)" || status=$?
  LAST_OUT="$out"
  LAST_STATUS="$status"
}

fresh_root() {
  ROOT="$(mktemp -d)/msm"
  : >"$MOCK_DIR/calls.log"
}

# ---------------------------------------------------------------------------

scenario 'a fresh install writes the deployment and starts it'
fresh_root
run_installer --dir "$ROOT" --health-timeout 5
assert_status "$LAST_STATUS" 0 'exits cleanly'
assert_file "$ROOT/docker-compose.yml" 'wrote docker-compose.yml'
assert_file "$ROOT/.env" 'wrote .env'
if [ -d "$ROOT/data" ]; then ok 'created the data directory'; else bad 'created the data directory'; fi
assert_contains "DATA_DIR_HOST=$ROOT/data" "$(cat "$ROOT/.env")" '.env points at the data directory'
assert_contains "ghcr.io/anefzaoui/minecraft-server-manager:latest" "$(cat "$ROOT/docker-compose.yml")" 'compose uses the published image'
assert_contains "'0.0.0.0:25564:25564'" "$(cat "$ROOT/docker-compose.yml")" 'publishes the default port'
assert_contains 'pull' "$(cat "$MOCK_DIR/calls.log")" 'pulled the image'
assert_contains 'up -d' "$(cat "$MOCK_DIR/calls.log")" 'started the stack'
assert_contains 'MSM is up' "$LAST_OUT" 'reports success'
assert_contains 'root-equivalent' "$LAST_OUT" 'warns about the Docker socket'
if [ "$(stat -c '%a' "$ROOT/.env" 2>/dev/null || printf '')" = '600' ]; then
  ok '.env is not world readable'
else
  bad '.env is not world readable' "mode $(stat -c '%a' "$ROOT/.env" 2>/dev/null || printf '?')"
fi

scenario 'running it again changes nothing it should not'
cp "$ROOT/docker-compose.yml" "$MOCK_DIR/compose-before"
printf 'CUSTOM=keepme\n' >>"$ROOT/.env"
run_installer --dir "$ROOT" --health-timeout 5
assert_status "$LAST_STATUS" 0 'second run exits cleanly'
assert_no_file "$ROOT/docker-compose.yml.bak" 'no backup, because nothing changed'
assert_contains 'CUSTOM=keepme' "$(cat "$ROOT/.env")" 'left the operator additions in .env alone'
assert_contains 'already what this installer would write' "$LAST_OUT" 'says the compose file is unchanged'
if diff -q "$MOCK_DIR/compose-before" "$ROOT/docker-compose.yml" >/dev/null; then
  ok 'compose file is byte identical'
else
  bad 'compose file is byte identical'
fi

scenario 'a hand-edited compose file is kept as .bak, never silently replaced'
printf '\n# operator added this\n' >>"$ROOT/docker-compose.yml"
run_installer --dir "$ROOT" --health-timeout 5
assert_file "$ROOT/docker-compose.yml.bak" 'kept the previous file'
assert_contains 'operator added this' "$(cat "$ROOT/docker-compose.yml.bak")" 'the backup has the edits'
assert_not_contains 'operator added this' "$(cat "$ROOT/docker-compose.yml")" 'the new file is the generated one'

scenario 'an existing .env without DATA_DIR_HOST gets it appended'
fresh_root
mkdir -p "$ROOT"
printf 'SESSION_SECRET=already-here\n' >"$ROOT/.env"
run_installer --dir "$ROOT" --no-start
assert_contains 'SESSION_SECRET=already-here' "$(cat "$ROOT/.env")" 'kept what was there'
assert_contains "DATA_DIR_HOST=$ROOT/data" "$(cat "$ROOT/.env")" 'added the missing variable'

scenario '--no-start writes the files and stops'
fresh_root
run_installer --dir "$ROOT" --no-start
assert_status "$LAST_STATUS" 0 'exits cleanly'
assert_file "$ROOT/docker-compose.yml" 'still wrote the compose file'
assert_not_contains 'up -d' "$(cat "$MOCK_DIR/calls.log")" 'did not start anything'
assert_contains 'Start it later' "$LAST_OUT" 'says how to start it'

scenario '--bind 127.0.0.1 publishes on loopback and says so'
fresh_root
run_installer --dir "$ROOT" --bind 127.0.0.1 --port 8080 --health-timeout 5
assert_contains "'127.0.0.1:8080:25564'" "$(cat "$ROOT/docker-compose.yml")" 'port mapping follows the flags'
assert_contains 'reverse proxy at it' "$LAST_OUT" 'tells you to point a proxy at it'

scenario '--tag pins the image'
fresh_root
run_installer --dir "$ROOT" --tag v0.14.0 --no-start
assert_contains 'minecraft-server-manager:v0.14.0' "$(cat "$ROOT/docker-compose.yml")" 'uses the pinned tag'

scenario 'bad input is refused before anything is written'
fresh_root
run_installer --dir "$ROOT" --port 99999 --no-start
assert_status "$LAST_STATUS" 1 'rejects an out-of-range port'
assert_contains 'between 1 and 65535' "$LAST_OUT" 'explains the port rule'
assert_no_file "$ROOT/docker-compose.yml" 'wrote nothing'
run_installer --dir 'relative/path' --no-start
assert_status "$LAST_STATUS" 1 'rejects a relative directory'
run_installer --dir '/' --no-start
assert_status "$LAST_STATUS" 1 'rejects the filesystem root'
run_installer --dir "$ROOT" --nonsense
assert_status "$LAST_STATUS" 1 'rejects an unknown flag'
assert_contains '--help lists them' "$LAST_OUT" 'points at --help'

scenario '--help and a missing Docker behave'
run_installer --help
assert_status "$LAST_STATUS" 0 'help exits cleanly'
assert_contains 'Usage: install.sh' "$LAST_OUT" 'prints usage'
fresh_root
MOCK_DOCKER_INFO_FAILS=1 run_installer --dir "$ROOT" --skip-docker --no-start
assert_status "$LAST_STATUS" 1 'fails when Docker is absent and install is skipped'
assert_contains 'not available and --skip-docker' "$LAST_OUT" 'says why'
fresh_root
MOCK_DOCKER_NO_COMPOSE=1 run_installer --dir "$ROOT" --no-start
assert_status "$LAST_STATUS" 1 'fails without the compose plugin'
assert_contains 'Compose plugin is missing' "$LAST_OUT" 'names the missing piece'

scenario 'a container that dies on boot is reported, not waited out'
fresh_root
MOCK_DOCKER_HEALTH=exited run_installer --dir "$ROOT" --health-timeout 30
assert_status "$LAST_STATUS" 1 'stops instead of hanging'
assert_contains 'stopped right after starting' "$LAST_OUT" 'explains what happened'
assert_contains 'mock log line' "$LAST_OUT" 'shows the container log'

scenario 'a pull failure stops before starting'
fresh_root
MOCK_DOCKER_PULL_FAILS=1 run_installer --dir "$ROOT" --health-timeout 5
assert_status "$LAST_STATUS" 1 'exits non-zero'
assert_contains 'could not pull the image' "$LAST_OUT" 'says the pull failed'
assert_not_contains 'up -d' "$(cat "$MOCK_DIR/calls.log")" 'did not try to start it'

scenario 'uninstall keeps data unless --purge, and confirms first'
fresh_root
run_installer --dir "$ROOT" --health-timeout 5
printf 'world data\n' >"$ROOT/data/marker"
printf 'no\n' | MOCK_DOCKER_LOG="$MOCK_DIR/calls.log" "$INSTALLER" --dir "$ROOT" --uninstall >/dev/null 2>&1 || true
assert_file "$ROOT/data/marker" 'a refused confirmation changes nothing'
MOCK_DOCKER_SERVERS='msm-srv_one,msm-srv_two' run_installer --dir "$ROOT" --uninstall --yes
assert_status "$LAST_STATUS" 0 'uninstall exits cleanly'
assert_file "$ROOT/data/marker" 'kept the data directory'
assert_contains 'msm-srv_one' "$LAST_OUT" 'lists the server containers it did not touch'
assert_contains 'down' "$(cat "$MOCK_DIR/calls.log")" 'stopped the stack'
run_installer --dir "$ROOT" --uninstall --purge --yes
assert_no_file "$ROOT/data/marker" '--purge deletes the data'

scenario 'uninstall on a host with no deployment says so'
run_installer --dir '/tmp/definitely-not-installed' --uninstall --yes
assert_status "$LAST_STATUS" 1 'exits non-zero'
assert_contains 'no deployment found' "$LAST_OUT" 'explains why'

# ---------------------------------------------------------------------------

printf '\n%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
