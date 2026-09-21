#!/usr/bin/env bash
# A stand-in for the docker CLI, so the installer's logic can be exercised
# without a daemon. Every invocation is appended to $MOCK_DOCKER_LOG, and the
# canned answers are driven by these variables:
#
#   MOCK_DOCKER_INFO_FAILS=1   `docker info` fails, i.e. Docker is not running
#   MOCK_DOCKER_NO_COMPOSE=1   `docker compose version` fails
#   MOCK_DOCKER_HEALTH=...     what `docker inspect` reports (default: healthy)
#   MOCK_DOCKER_PULL_FAILS=1   `docker compose pull` fails
#   MOCK_DOCKER_SERVERS=a,b    names `docker ps` reports as panel-made servers

set -u
log_file="${MOCK_DOCKER_LOG:-/dev/null}"
printf '%s\n' "$*" >>"$log_file"

case "${1:-}" in
  info)
    [ "${MOCK_DOCKER_INFO_FAILS:-0}" = '1' ] && exit 1
    printf 'Server Version: 27.0.0\n'
    ;;
  version)
    printf '27.0.0\n'
    ;;
  compose)
    shift
    # Skip over -f <file> and --project-directory <dir>.
    while [ $# -gt 0 ]; do
      case "$1" in
        -f | --project-directory)
          shift 2
          ;;
        *) break ;;
      esac
    done
    case "${1:-}" in
      version)
        [ "${MOCK_DOCKER_NO_COMPOSE:-0}" = '1' ] && exit 1
        printf 'Docker Compose version v2.29.0\n'
        ;;
      pull)
        [ "${MOCK_DOCKER_PULL_FAILS:-0}" = '1' ] && exit 1
        printf 'pulled\n'
        ;;
      up) printf 'started\n' ;;
      down) printf 'stopped\n' ;;
      *) printf 'compose %s\n' "${1:-}" ;;
    esac
    ;;
  inspect)
    printf '%s\n' "${MOCK_DOCKER_HEALTH:-healthy}"
    ;;
  ps)
    if [ -n "${MOCK_DOCKER_SERVERS:-}" ]; then
      printf '%s\n' "${MOCK_DOCKER_SERVERS}" | tr ',' '\n'
    fi
    ;;
  logs) printf 'mock log line\n' ;;
  *) printf 'mock docker: %s\n' "${1:-}" ;;
esac
exit 0
