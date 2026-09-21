#!/usr/bin/env bash
#
# Minecraft Server Manager installer, for any Linux host with Docker (or a host
# where we may install it). One code path: a provider-specific deployment should
# call this rather than re-implementing it.
#
#   curl -fsSL https://raw.githubusercontent.com/anefzaoui/minecraft-server-manager/main/deploy/install.sh | sudo bash
#
# It is safe to run twice. A second run upgrades the panel to the newest image
# and leaves your data, .env, and any edits to docker-compose.yml alone (the
# previous compose file is kept as docker-compose.yml.bak when it changes).
#
# Every function below is pure or clearly marked as touching the system, so
# test/deploy-install.test.js can source this file and exercise the logic
# without a Docker daemon.

set -euo pipefail

INSTALL_SH_VERSION='1.0.0'

# ---------------------------------------------------------------------------
# Defaults. Every one of them can be overridden with a flag; see usage().

DIR="${MSM_DIR:-/opt/msm}"
PORT="${MSM_PORT:-25564}"
BIND="${MSM_BIND:-0.0.0.0}"
TAG="${MSM_TAG:-latest}"
IMAGE="${MSM_IMAGE:-ghcr.io/anefzaoui/minecraft-server-manager}"
CONTAINER_NAME='minecraft-server-manager'
SKIP_DOCKER=0
NO_START=0
ASSUME_YES=0
ACTION='install'
PURGE=0
HEALTH_TIMEOUT="${MSM_HEALTH_TIMEOUT:-180}"

# ---------------------------------------------------------------------------
# Output. Colour only when a human is watching.

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
  C_OFF=$'\033[0m'
else
  C_BOLD='' C_DIM='' C_GREEN='' C_YELLOW='' C_RED='' C_OFF=''
fi

step() { printf '%s==>%s %s\n' "$C_GREEN$C_BOLD" "$C_OFF" "$*"; }
info() { printf '    %s\n' "$*"; }
dim() { printf '%s    %s%s\n' "$C_DIM" "$*" "$C_OFF"; }
warn() { printf '%swarning:%s %s\n' "$C_YELLOW$C_BOLD" "$C_OFF" "$*" >&2; }
die() {
  printf '%serror:%s %s\n' "$C_RED$C_BOLD" "$C_OFF" "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
Minecraft Server Manager installer ${INSTALL_SH_VERSION}

Usage: install.sh [options]

Options:
  --dir PATH          where the panel lives (default: ${DIR})
  --port PORT         host port for the web UI (default: ${PORT})
  --bind ADDRESS      host address to publish on (default: ${BIND};
                      use 127.0.0.1 when a reverse proxy fronts the panel)
  --tag TAG           image tag, e.g. v0.14.0 (default: ${TAG})
  --image NAME        image without the tag (default: ${IMAGE})
  --skip-docker       never install Docker, fail if it is missing
  --no-start          write the files but do not start the panel
  --health-timeout N  seconds to wait for the panel to answer (default: ${HEALTH_TIMEOUT})
  --uninstall         stop and remove the panel (add --purge to delete its data)
  --purge             with --uninstall, also delete ${DIR}/data
  -y, --yes           do not ask anything
  -h, --help          this text

Environment equivalents: MSM_DIR, MSM_PORT, MSM_BIND, MSM_TAG, MSM_IMAGE,
MSM_HEALTH_TIMEOUT.
EOF
}

# ---------------------------------------------------------------------------
# Pure helpers. No side effects, so the test suite can call them directly.

# Maps `uname -m` onto the architectures the image is built for.
normalize_arch() {
  case "$1" in
    x86_64 | amd64) printf 'amd64' ;;
    aarch64 | arm64) printf 'arm64' ;;
    *) return 1 ;;
  esac
}

# A port has to be a number in range, or the compose file it lands in is broken.
valid_port() {
  case "$1" in
    '' | *[!0-9]*) return 1 ;;
  esac
  [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

# Paths are written into a compose file and used with rm -rf on --purge, so the
# obviously dangerous ones are refused rather than handled.
valid_dir() {
  case "$1" in
    /) return 1 ;;
    /*) ;;
    *) return 1 ;;
  esac
  case "$1" in
    *[[:space:]]* | *'$'* | *'"'* | *"'"* | *'`'*) return 1 ;;
  esac
  return 0
}

render_env() {
  local dir="$1"
  cat <<EOF
# Written by the MSM installer. The panel reads DATA_DIR_HOST to translate the
# paths it hands to Docker onto the host filesystem, so it must stay an
# absolute host path and must match the bind mount in docker-compose.yml.
DATA_DIR_HOST=${dir}/data
EOF
}

render_compose() {
  local image="$1" tag="$2" bind="$3" port="$4"
  cat <<EOF
# Written by the MSM installer ${INSTALL_SH_VERSION}. Edits survive an upgrade:
# a later run keeps this file and saves its own version as docker-compose.yml.bak
# only when the generated content would change.
services:
  panel:
    image: ${image}:${tag}
    container_name: ${CONTAINER_NAME}
    restart: unless-stopped
    ports:
      - '${bind}:${port}:25564'
    extra_hosts:
      # Lets the panel reach a sibling container's host-published port (the live
      # map) through the host rather than its own loopback.
      - 'host.docker.internal:host-gateway'
    environment:
      DATA_DIR_HOST: \${DATA_DIR_HOST:?Set DATA_DIR_HOST in .env to the absolute host path for panel data}
      # Behind a TLS-terminating reverse proxy, uncomment both of these:
      # TRUST_PROXY: '1'
      # COOKIE_SECURE: auto
    volumes:
      - \${DATA_DIR_HOST}:/data
      # The panel manages servers through the host daemon.
      - /var/run/docker.sock:/var/run/docker.sock
EOF
}

# ---------------------------------------------------------------------------
# System checks. These read the machine but change nothing.

require_linux() {
  local kernel
  kernel="$(uname -s)"
  [ "$kernel" = 'Linux' ] || die "this installer is for Linux hosts; on ${kernel}, run MSM from source instead (see the README)."
}

detect_arch() {
  local raw arch
  raw="$(uname -m)"
  if ! arch="$(normalize_arch "$raw")"; then
    die "unsupported architecture ${raw}; the image is built for amd64 and arm64."
  fi
  printf '%s' "$arch"
}

os_pretty_name() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    printf '%s' "${PRETTY_NAME:-${NAME:-Linux}}"
  else
    printf 'Linux'
  fi
}

have_cmd() { command -v "$1" >/dev/null 2>&1; }

# Root, directly or through sudo. Sets SUDO to the prefix every privileged
# command uses, so a run as root uses no sudo at all.
SUDO=''
require_root() {
  if [ "$(id -u)" -eq 0 ]; then
    SUDO=''
    return 0
  fi
  if have_cmd sudo; then
    SUDO='sudo'
    step 'Asking for sudo, because the panel installs under a system directory.'
    sudo -v || die 'sudo refused; re-run as root.'
    return 0
  fi
  die 'run this as root, or install sudo first.'
}

docker_ok() { have_cmd docker && $SUDO docker info >/dev/null 2>&1; }

compose_ok() { $SUDO docker compose version >/dev/null 2>&1; }

install_docker() {
  step 'Installing Docker from get.docker.com.'
  if ! have_cmd curl && ! have_cmd wget; then
    die 'neither curl nor wget is available to fetch the Docker installer; install Docker yourself, then re-run with --skip-docker.'
  fi
  local script
  script="$(mktemp)"
  if have_cmd curl; then
    curl -fsSL https://get.docker.com -o "$script" || die 'could not download the Docker installer.'
  else
    wget -qO "$script" https://get.docker.com || die 'could not download the Docker installer.'
  fi
  $SUDO sh "$script" || die 'the Docker installer failed; install Docker yourself, then re-run with --skip-docker.'
  rm -f "$script"
  if have_cmd systemctl; then
    $SUDO systemctl enable --now docker >/dev/null 2>&1 || warn 'could not enable the docker service; start it yourself if the next step fails.'
  fi
}

ensure_docker() {
  if docker_ok; then
    dim "Docker $($SUDO docker version --format '{{.Server.Version}}' 2>/dev/null || printf '?') is running."
  elif [ "$SKIP_DOCKER" -eq 1 ]; then
    die 'Docker is not available and --skip-docker was given.'
  else
    install_docker
    # shellcheck disable=SC2016  # the backticks are literal text in the message
    docker_ok || die 'Docker still is not responding; check `systemctl status docker`.'
  fi
  compose_ok || die 'the Docker Compose plugin is missing; install docker-compose-plugin (or a newer Docker) and re-run.'
}

# ---------------------------------------------------------------------------
# Writing files. write_file keeps the previous content as .bak when it differs,
# so a hand-edited compose file is never silently replaced.

write_file() {
  local path="$1" content="$2" label="$3"
  if [ -f "$path" ]; then
    if [ "$(cat "$path")" = "$content" ]; then
      dim "${label} is already what this installer would write."
      return 0
    fi
    $SUDO cp -p "$path" "${path}.bak"
    info "kept your ${label} as $(basename "$path").bak"
  fi
  printf '%s' "$content" | $SUDO tee "$path" >/dev/null
  info "wrote ${label}"
}

# .env is only created, never rewritten: it may hold secrets the operator added.
ensure_env() {
  local path="$DIR/.env"
  if [ -f "$path" ]; then
    if grep -q '^DATA_DIR_HOST=' "$path"; then
      dim '.env already sets DATA_DIR_HOST.'
      return 0
    fi
    printf 'DATA_DIR_HOST=%s/data\n' "$DIR" | $SUDO tee -a "$path" >/dev/null
    info 'added DATA_DIR_HOST to your existing .env'
    return 0
  fi
  render_env "$DIR" | $SUDO tee "$path" >/dev/null
  $SUDO chmod 600 "$path"
  info 'wrote .env'
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) state
  step 'Waiting for the panel to answer.'
  while [ "$SECONDS" -lt "$deadline" ]; do
    state="$($SUDO docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER_NAME" 2>/dev/null || printf 'missing')"
    case "$state" in
      healthy | running)
        dim "container is ${state}."
        return 0
        ;;
      exited | dead)
        $SUDO docker logs --tail 40 "$CONTAINER_NAME" 2>&1 | sed 's/^/    /' >&2 || true
        die 'the panel container stopped right after starting; the last lines of its log are above.'
        ;;
    esac
    sleep 2
  done
  warn "the panel did not report healthy within ${HEALTH_TIMEOUT}s; check \`docker logs ${CONTAINER_NAME}\`."
  return 1
}

primary_address() {
  local ip=''
  if have_cmd hostname; then ip="$(hostname -I 2>/dev/null | awk '{print $1}')"; fi
  if [ -z "$ip" ] && have_cmd ip; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
  fi
  [ -n "$ip" ] || ip='your-server-ip'
  printf '%s' "$ip"
}

print_next_steps() {
  local address
  address="$(primary_address)"
  printf '\n%sMSM is up.%s\n\n' "$C_GREEN$C_BOLD" "$C_OFF"
  if [ "$BIND" = '127.0.0.1' ]; then
    info "The panel listens on 127.0.0.1:${PORT}. Point your reverse proxy at it."
  else
    info "Open http://${address}:${PORT} and create the first admin account."
  fi
  # On an exposed bind the panel demands a one-time PIN before it will hand out
  # the admin account, and that PIN exists only in its log. Without this line
  # the first thing a new operator meets is a refusal they cannot explain.
  if [ "$BIND" != '127.0.0.1' ]; then
    local pin
    pin="$($SUDO docker logs "$CONTAINER_NAME" 2>&1 | grep -o '"pin":"[0-9]\{6\}"' | tail -1 | grep -o '[0-9]\{6\}' || true)"
    printf '\n'
    if [ -n "$pin" ]; then
      info "Setup PIN: ${C_BOLD}${pin}${C_OFF}   (the page asks for it, because this panel is reachable from outside)"
    else
      info 'The setup page will ask for a PIN. Find it with:'
      dim "docker logs ${CONTAINER_NAME} | grep -i pin"
    fi
  fi
  printf '\n'
  info "Data:      ${DIR}/data   (back up this whole directory)"
  info "Compose:   ${DIR}/docker-compose.yml"
  info "Logs:      docker logs -f ${CONTAINER_NAME}"
  info "Upgrade:   re-run this installer, or docker compose -f ${DIR}/docker-compose.yml pull && up -d"
  printf '\n'
  warn 'The panel holds the Docker socket, which makes its admin login root-equivalent on this host.'
  info 'Before you expose it beyond your own network: put it behind TLS, publish it on 127.0.0.1'
  info 'with --bind 127.0.0.1, and set TRUST_PROXY and COOKIE_SECURE in the compose file.'
  printf '\n'
}

# ---------------------------------------------------------------------------

do_install() {
  local arch
  require_linux
  arch="$(detect_arch)"
  valid_port "$PORT" || die "--port must be a number between 1 and 65535, got '${PORT}'."
  valid_dir "$DIR" || die "--dir must be an absolute path without spaces or shell characters, got '${DIR}'."
  require_root

  step "Installing MSM on $(os_pretty_name) (${arch}) into ${DIR}."
  ensure_docker

  step 'Writing the deployment.'
  $SUDO mkdir -p "$DIR/data"
  write_file "$DIR/docker-compose.yml" "$(render_compose "$IMAGE" "$TAG" "$BIND" "$PORT")" 'docker-compose.yml'
  ensure_env

  if [ "$NO_START" -eq 1 ]; then
    step 'Not starting, because --no-start was given.'
    info "Start it later with: docker compose -f ${DIR}/docker-compose.yml up -d"
    return 0
  fi

  step "Pulling ${IMAGE}:${TAG}."
  $SUDO docker compose -f "$DIR/docker-compose.yml" --project-directory "$DIR" pull ||
    die "could not pull the image; check the tag and this host's network access."

  step 'Starting the panel.'
  $SUDO docker compose -f "$DIR/docker-compose.yml" --project-directory "$DIR" up -d ||
    die 'docker compose up failed; the output above says why.'

  wait_healthy || true
  print_next_steps
}

do_uninstall() {
  require_linux
  require_root
  [ -f "$DIR/docker-compose.yml" ] || die "no deployment found at ${DIR}."

  if [ "$ASSUME_YES" -ne 1 ]; then
    if [ "$PURGE" -eq 1 ]; then
      printf 'This removes the panel AND deletes %s/data, including every world and backup.\n' "$DIR"
    else
      printf 'This stops and removes the panel container. %s/data is kept.\n' "$DIR"
    fi
    printf 'Type yes to continue: '
    local answer
    read -r answer || answer=''
    [ "$answer" = 'yes' ] || die 'nothing was changed.'
  fi

  step 'Stopping the panel.'
  $SUDO docker compose -f "$DIR/docker-compose.yml" --project-directory "$DIR" down || warn 'compose down reported a problem; continuing.'

  # The Minecraft servers are sibling containers, so compose knows nothing about
  # them. Say so rather than leaving them running silently.
  local servers
  servers="$($SUDO docker ps -a --filter 'name=^msm-' --format '{{.Names}}' 2>/dev/null || true)"
  if [ -n "$servers" ]; then
    warn 'These Minecraft server containers were created by the panel and are still here:'
    printf '%s\n' "$servers" | sed 's/^/    /'
    info 'Remove them with: docker rm -f <name>'
  fi

  if [ "$PURGE" -eq 1 ]; then
    step "Deleting ${DIR}/data."
    $SUDO rm -rf "${DIR:?}/data"
  else
    info "Your data is still at ${DIR}/data."
  fi
  step 'Done.'
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --dir)
        DIR="${2:-}"
        shift 2
        ;;
      --port)
        PORT="${2:-}"
        shift 2
        ;;
      --bind)
        BIND="${2:-}"
        shift 2
        ;;
      --tag)
        TAG="${2:-}"
        shift 2
        ;;
      --image)
        IMAGE="${2:-}"
        shift 2
        ;;
      --health-timeout)
        HEALTH_TIMEOUT="${2:-}"
        shift 2
        ;;
      --skip-docker)
        SKIP_DOCKER=1
        shift
        ;;
      --no-start)
        NO_START=1
        shift
        ;;
      --uninstall)
        ACTION='uninstall'
        shift
        ;;
      --purge)
        PURGE=1
        shift
        ;;
      -y | --yes)
        ASSUME_YES=1
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *) die "unknown option '$1'; --help lists them." ;;
    esac
  done
  DIR="${DIR%/}"
}

main() {
  parse_args "$@"
  case "$ACTION" in
    install) do_install ;;
    uninstall) do_uninstall ;;
  esac
}

# Sourced by the test suite, executed by everyone else.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
