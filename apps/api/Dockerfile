FROM node:22-alpine AS build

WORKDIR /workspace
ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/work_archive?schema=public"

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY apps/api/prisma apps/api/prisma

RUN npm ci --ignore-scripts

COPY apps/api apps/api
COPY packages/shared-types packages/shared-types
COPY packages/tsconfig packages/tsconfig

RUN npm run prisma:generate --workspace @work-archive/api
RUN npm run build --workspace @work-archive/shared-types
RUN npm run build --workspace @work-archive/api

FROM build AS release

WORKDIR /workspace
ENV NODE_ENV=production

USER node

CMD ["npm", "run", "prisma:migrate:deploy", "--workspace", "@work-archive/api"]

FROM build AS prod-deps

RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=prod-deps --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/packages/shared-types ./packages/shared-types
COPY --from=build --chown=node:node /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /workspace/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

RUN sed -i 's/\r$//' /workspace/apps/api/docker-entrypoint.sh \
  && chmod +x /workspace/apps/api/docker-entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["/workspace/apps/api/docker-entrypoint.sh"]
