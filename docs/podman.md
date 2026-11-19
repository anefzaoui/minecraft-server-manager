# Podman deployment (rootless)

This fork adds a rootless Podman deployment path for the panel. The panel is
unchanged as an appliance: it still drives a container daemon and creates each
Minecraft server as a sibling container. Under Podman that daemon is the
user's own Docker-compatible socket (`$XDG_RUNTIME_DIR/podman/podman.sock`),
not `/var/run/docker.sock`. This is the only backend difference the panel
needs; everything else (modpacks, backups, console, whitelist, etc.) behaves
identically.

Verified on Podman **6.1.3** on Fedora/Aurora (SELinux enforcing, rootless).
The full dockerode surface the panel uses is exercised and confirmed: create /
start / stop / remove, inspect with health + port bindings, `exec` with exit
code, `logs --follow`, events, stats, label-filtered listing, and resource caps
(`NanoCpus`, `Memory`, `MemorySwap`).

## How it works

- The panel runs as a rootless **Podman container** (quadlet, below).
- The user's Docker-compatible socket is mounted at `/var/run/docker.sock`
  inside the panel, so the panel talks to Podman through the same code path as
  Docker.
- Container data (worlds, backups, the DB, `.secret-key`) lives in a host
  directory under your home, bind-mounted to `/data`.

## SELinux (required on enforcing hosts)

On Fedora/Aurora (SELinux enforcing), the panel container needs
`label=disable` to reach the mounted socket and its data volume. This scopes to
the panel container only; the sibling Minecraft servers it creates get their
own policy. Without it you'll see `EACCES` connecting to the daemon.

## Install (quadlet)

```bash
# 1. data dir
mkdir -p ~/msm/data

# 2. build the image from this fork
podman build -t localhost/minecraft-server-manager:latest .

# 3. install the unit (edit deploy/msm.container to taste first)
cp deploy/msm.container ~/.config/containers/systemd/msm.container
systemctl --user daemon-reload
systemctl --user enable --now msm.service
```

> If `systemctl --user enable` fails with `Unit ... is transient or generated`
> (a newer systemd refusing to symlink generated quadlet units), skip the
> quadlet and use an explicit user service instead — it runs the exact same
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
  -v /home/jason/msm/data:/data:Z \
  -v /run/user/%U/podman/podman.sock:/var/run/docker.sock \
  -e DATA_DIR_HOST=/home/jason/msm/data \
  -p 127.0.0.1:25564:25564 \
  localhost/minecraft-server-manager:latest
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

```bash
echo "DATA_DIR_HOST=/home/jason/msm/data" > .env
podman-compose -f deploy/podman-compose.yml up -d
```

## Notes and known behavior

- **Sibling data ownership.** Minecraft server containers run as their own UID
  inside the mapping; host files under the data dir may be owned by a subuid,
  not your login UID. The panel already handles chown/cleanup through throwaway
  root containers; if you ever touch those files by hand, prefer the panel's
  file manager to plain `rm`.
- **SELinux bind labeling.** Under Podman + SELinux enforcing, the panel
  auto-appends `:Z` to the data-dir bind mounts it creates for sibling server
  containers (and its cleanup containers). Without this the server process fails
  the first write to `/data` (`Permission denied` writing `eula.txt`).
- **Force removal is slower than Docker.** `podman rm -f` of a *running*
  container took ~15s here (Docker is near-instant). Deletes and rebuilds still
  complete; they're just not snappy on a live server.
- **Port reachability.** The panel creates servers with host-published ports.
  Rootless Podman publishes on the LAN as your user; a world reachable by your
  daughter's friends still needs a router NAT rule (TCP 25565 → this machine)
  or a Tailscale subnet route / funnel.
- **Upgrading.** Rebuild the image and restart the unit: `podman build
  -t localhost/minecraft-server-manager:latest . && systemctl --user restart
  msm.service`. Your data dir is untouched.
