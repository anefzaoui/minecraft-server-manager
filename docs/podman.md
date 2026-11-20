# Podman deployment (rootless)

MSM supports a rootless Podman deployment path for the panel. The panel is
unchanged as an appliance: it still drives a container daemon and creates each
Minecraft server as a sibling container. Under Podman that daemon is the
user's own Docker-compatible socket (`$XDG_RUNTIME_DIR/podman/podman.sock`),
not `/var/run/docker.sock`. This is the only backend difference the panel
needs; everything else (modpacks, backups, console, whitelist, etc.) behaves
identically.

Verified on Podman **6.1.3** on Fedora/Aurora (SELinux enforcing, rootless).
The quadlet deploy needs Podman 4.0 or newer (quadlet's first release); the
full dockerode surface the panel uses is exercised and confirmed: create /
start / stop / remove, inspect with health + port bindings, `exec` with exit
code, `logs --follow`, events, stats, label-filtered listing, and resource caps
(`NanoCpus`, `Memory`, `MemorySwap`).

## How it works

- The panel runs as a rootless **Podman container** (quadlet, below).
- The user's Docker-compatible socket is mounted at `/var/run/docker.sock`
  inside the panel, so the panel talks to Podman through the same code path as
  Docker.
- Socket auto-detection probes `/var/run/docker.sock` first, then the rootless
  Docker and Podman per-user sockets (`$XDG_RUNTIME_DIR/podman/podman.sock`).
  Only real sockets are accepted: a stray file or folder at a candidate path
  is skipped. Set `PODMAN_HOST` (a `unix://` URL or a bare socket path) to
  point the panel at a specific Podman socket explicitly; it wins over the
  default probes, and `DOCKER_HOST` still takes precedence over both.
- At startup the panel logs one line naming the socket and the daemon it
  found (Docker or Podman), so support questions can start from the log.
- Container data (worlds, backups, the DB, `.secret-key`) lives in a host
  directory under your home, bind-mounted to `/data`.

## SELinux (required on enforcing hosts)

On Fedora/Aurora (SELinux enforcing), the panel container needs
`label=disable` to reach the mounted socket and its data volume. This scopes to
the panel container only; the sibling Minecraft servers it creates get their
own policy. Without it you'll see `EACCES` connecting to the daemon.

The panel labels the binds it creates for sibling servers itself:

- Each server's `/data` bind carries the **shared `:z` label**. Without a
  label the server process fails its first write to `/data` (`Permission
denied` writing `eula.txt`).
- The label is shared (`:z`), never private (`:Z`). A private label relabels
  the directory for one container only and locks the others out, which would
  cut running servers off from their own worlds when a cleanup container
  touches the shared `servers/` tree.
- The throwaway cleanup container binds the `servers/` parent with `:z`; the
  chown container binds only the one server's directory, so a chown relabels
  a single world rather than the whole tree.
- **Extra binds are never relabeled.** They are host paths you chose and may
  be used by other services. If SELinux denies access to one, label it
  yourself (for example `chcon -R -t container_file_t <path>`) after
  considering what else uses that path.

## Install (quadlet)

```bash
# 1. Enable the Podman socket and linger for your user.
systemctl --user enable --now podman.socket
loginctl enable-linger $USER

# 2. Data dir.
mkdir -p ~/msm/data

# 3. Pull the published image (the same one Docker users get).
podman pull ghcr.io/anefzaoui/minecraft-server-manager:latest

# 4. Install the unit (edit deploy/msm.container to taste first).
cp deploy/msm.container ~/.config/containers/systemd/msm.container
systemctl --user daemon-reload
systemctl --user enable --now msm.service
```

Step 1 matters: `podman.socket` creates the Docker-compatible socket the panel
mounts, and linger keeps your user services running after you log out. Without
linger, closing your SSH session stops the panel and every Minecraft server.

Prefer to build the image yourself? From a clone of this repository:
`podman build -t localhost/minecraft-server-manager:latest .`, then set
`Image=localhost/minecraft-server-manager:latest` in the unit.

> If `systemctl --user enable` fails with `Unit ... is transient or generated`
> (a newer systemd refusing to symlink generated quadlet units), skip the
> quadlet and use an explicit user service instead. It runs the exact same
> `podman run` flags and enables cleanly:

```ini
# ~/.config/systemd/user/msm.service
[Unit]
Description=Minecraft Server Manager panel (Podman rootless)
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/podman run --name msm --rm \
  --security-opt label=disable \
  -v %h/msm/data:/data:z \
  -v /run/user/%U/podman/podman.sock:/var/run/docker.sock \
  -e DATA_DIR_HOST=%h/msm/data \
  -p 127.0.0.1:25564:25564 \
  ghcr.io/anefzaoui/minecraft-server-manager:latest
ExecStop=/usr/bin/podman stop -t 30 msm
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload && systemctl --user enable --now msm.service
```

The default unit publishes the UI on `127.0.0.1:25564`. Put a TLS-terminating
reverse proxy in front of it and set `TRUST_PROXY=1` / `COOKIE_SECURE=auto` if
you serve it over HTTPS (see the README env table).

## Alternative: podman-compose

Run these from the repository root:

```bash
echo "DATA_DIR_HOST=$HOME/msm/data" > .env
podman-compose -f deploy/podman-compose.yml up -d
```

podman-compose reads `.env` from the directory you run it in (recent versions
also check the compose file's folder), so running from the repository root
finds the `.env` you just wrote. The socket mount uses `$XDG_RUNTIME_DIR`,
which a normal login session exports. Enable `podman.socket` and linger first,
exactly as in the quadlet install above.

## Notes and known behavior

- **Sibling data ownership.** Minecraft server containers run as their own UID
  inside the mapping; host files under the data dir may be owned by a subuid,
  not your login UID. The panel already handles chown/cleanup through throwaway
  root containers; if you ever touch those files by hand, prefer the panel's
  file manager to plain `rm`.
- **Force removal is slower than Docker.** `podman rm -f` of a _running_
  container took ~15s here (Docker is near-instant). Deletes and rebuilds still
  complete; they're just not snappy on a live server.
- **Port reachability.** The panel creates servers with host-published ports.
  Rootless Podman publishes on the LAN as your user; a world reachable by
  players still needs a router NAT rule (TCP 25565 → this machine)
  or a Tailscale subnet route / funnel.
- **Upgrading.** Pull the new image and restart the unit:

  ```bash
  podman pull ghcr.io/anefzaoui/minecraft-server-manager:latest
  systemctl --user restart msm.service
  ```

  Your data dir is untouched. If you built the image yourself, rebuild it
  instead of pulling.
