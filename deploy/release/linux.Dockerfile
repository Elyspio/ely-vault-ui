# Builds the Linux packages (AppImage, deb) from Windows: scripts/release/release.ts mounts dist/ and runs this image
FROM node:26-bookworm

ARG PNPM_VERSION=12.5.1
WORKDIR /project

# electronuserland/builder stops at Node 24: install the few system tools electron-builder needs for the deb target
RUN apt-get update \
	&& apt-get install -y --no-install-recommends fakeroot \
	&& rm -rf /var/lib/apt/lists/*

# Node 25+ images ship without corepack
RUN npm install -g pnpm@${PNPM_VERSION}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

CMD ["sh", "-c", "pnpm build && pnpm exec electron-builder --config config/electron-builder.yml --linux AppImage deb --publish never"]
