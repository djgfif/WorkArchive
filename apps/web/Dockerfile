FROM node:22-alpine AS build

WORKDIR /workspace

ARG VITE_API_BASE_URL="/api"
ENV VITE_API_BASE_URL="${VITE_API_BASE_URL}"

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json

RUN npm ci --ignore-scripts

COPY apps/web apps/web
COPY packages/shared-types packages/shared-types
COPY packages/tsconfig packages/tsconfig
COPY scripts/qa/validate-web-bundle-budget.mjs scripts/qa/validate-web-bundle-budget.mjs

RUN npm run build --workspace @work-archive/shared-types
RUN npm run build --workspace @work-archive/web

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --chown=nginx:nginx apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx --chmod=755 apps/web/docker-entrypoint.d/40-work-archive-config.sh /docker-entrypoint.d/40-work-archive-config.sh
COPY --from=build --chown=nginx:nginx /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
