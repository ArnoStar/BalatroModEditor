# syntax=docker/dockerfile:1
# The mod editor in a container: nginx serves it at /editor/. The site's front
# door (BalatroPortal's nginx) passes /editor/ here; BalatroFrontEnd's
# docker-compose.yml runs it with the rest.
#
#   docker build --network host -t balatro-editor .
#   docker run -p 8089:80 balatro-editor      # http://localhost:8089/editor/ (without the services)

FROM node:24-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# other origins for the API, the identity service, the portal or the game (by default all on this one)
ARG VITE_API_URL=""
ARG VITE_IDENTITY_URL=""
ARG VITE_PORTAL_URL=""
ARG VITE_GAME_URL=""
RUN npm run build

FROM nginx:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/editor
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/editor/"]
