# CI/CD and Release Pipeline

Status: PLANNED, priority item. Not built yet. Nothing in the repo changes until the owner says go.

Goal: cut the Dokploy redeploy from about 6 to 7 minutes to about 30 to 60 seconds, and stop building on the VPS.

## Why deploys are slow today

- The image is built on the Dokploy server from the `Dockerfile` (`bun install`, `icons:build`, `next build` compete with the running app and Postgres for CPU and RAM).
- `COPY . .` invalidates the build layer on every commit. The `.next/cache` BuildKit cache mount only helps if Dokploy keeps the same builder cache between deploys (not verified).
- The runtime image is about 1.5 GB: the whole monorepo `node_modules` (about 928 MB, devDependencies included) is copied in. `.next` itself is about 20 MB.
- `apps/editor/next.config.ts` has no `output: "standalone"`.
- `.dockerignore` does not exclude `blueprint/`, `docs/`, `scripts/`.
- The GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint, typecheck and tests only. It builds no image.

## Decision: private Docker Hub image, built and pushed from the owner's machine

Decided 2026-11-18. The image is built on the owner's machine (Docker Desktop), pushed to a private Docker Hub repository, and Dokploy only pulls it by tag and runs it.

Why this and not GitHub Actions plus GHCR:

- GitHub Free gives 2000 CI minutes a month and 500 MB of private package storage. With frequent pushes, an image build on every push would use the minutes in about two weeks, and the current image does not fit the storage.
- A local build and push uses no CI minutes, and the VPS does no build work.
- Docker Hub's free plan allows one private repository, which is enough for this image.

The image is private because it contains the compiled builder. It holds no secrets (build-time placeholders are used only inside a `RUN` and are not stored in the image).

## Target flow

1. Build: `docker build -t <hub-user>/nextomic-builder:<version> .`
2. Push: `docker push <hub-user>/nextomic-builder:<version>`
3. In Dokploy, set `APP_TAG=<version>` in the Environment tab and redeploy. Dokploy pulls the image and starts the stack.
4. Rollback: set `APP_TAG` back to the previous version and redeploy.

A `scripts/release` script runs steps 1 and 2 with one command and picks the next version.

## Planned changes (when the owner says go)

1. `docker-compose.yml` (production): `app` and `migrate` use `image: <hub-user>/nextomic-builder:${APP_TAG:?set APP_TAG}`. Remove the `build:` block and `pull_policy: never`. `migrate` keeps sharing the same image as `app`.
2. `docker-compose.dev.yml` keeps `build:` so local Docker testing is unchanged.
3. `dokploy/README.md`: replace "built on the Dokploy server" with the pull flow, add the Dokploy Registry setup (Docker Hub username and a read-only access token) and the `APP_TAG` variable.
4. `scripts/release`: build, tag, push. The push credentials come from `docker login`, never from the repo.
5. `.env.example`: add `APP_TAG`.

## Rules for this flow

- Use version tags (for example `0.1.N`), not `:latest`. A new tag forces a pull and gives rollback. Do not reuse a tag.
- The image is published for both `linux/amd64` and `linux/arm64` under one tag (a multi-arch manifest), so the same `APP_TAG` works on an AMD or an ARM server. Docker pulls the matching one.
  - Simple way: `docker buildx build --platform linux/amd64,linux/arm64 -t <hub-user>/nextomic-builder:<version> --push .` on one machine. The non-native architecture runs under QEMU emulation, which is slow for `next build` (can take many times longer than native).
  - Faster way: build each architecture natively on its own machine, push each with a temporary tag (`<version>-amd64`, `<version>-arm64`), then merge them: `docker buildx imagetools create -t <hub-user>/nextomic-builder:<version> <hub-user>/nextomic-builder:<version>-amd64 <hub-user>/nextomic-builder:<version>-arm64`. Delete the temporary tags afterwards.
  - `scripts/release` supports both ways. Test the image on both architectures before the first real deploy (Bun, `sharp` and any native packages must have arm64 builds).
  - A multi-arch push stores both images, so the private repo and push time roughly double. Another reason to do the image shrink.
- Use a Docker Hub access token, not the account password, for `docker login` and for the Dokploy registry entry. The Dokploy token is read-only.
- Never put credentials or `.env` content into the image or the repo. Real values stay in the Dokploy Environment tab.
- Follow the owner's push rule: no push to Docker Hub or deploy until the owner says so.
- The `migrate` service still runs on every deploy. Take a backup before a deploy that includes a migration that drops or rewrites data (`platform.md` section 8).

## Follow-up: shrink the image (separate step, after the flow works)

- Enable `output: "standalone"` in `apps/editor/next.config.ts` and copy `.next/standalone` and `.next/static` into a slim runtime stage. Verify it under Bun, and if it fails, run Next on Node and record that in the `spec.md` decisions log.
- The `migrate` service shares the image, so `packages/db` and its dependencies must stay in the image.
- Add `blueprint`, `docs`, `scripts` to `.dockerignore`.
- Target: a few hundred MB instead of 1.5 GB, which also makes each push from the owner's machine faster.

## Optional later: GitHub Actions

If building from the owner's machine becomes a bottleneck, add a manual (`workflow_dispatch`) or tag-triggered workflow that builds with the GHA layer cache and pushes to the same Docker Hub repository. Add `concurrency: cancel-in-progress`. Do not build the image on every push. The existing lint, typecheck and test jobs could run on pull requests and manual runs only to save minutes.

## Not chosen

- Rewriting the builder in Rust: rejected, see the 2026-11-18 "Deploy speed and release flow" entry in the `spec.md` decisions log.
