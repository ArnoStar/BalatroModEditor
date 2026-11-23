# BalatroModEditor: `make` lists the commands (they run the npm scripts).
#
# Alone:        make install && make run   (http://localhost:5176/editor/; it passes /api, /identity
#               and /play to the API, the identity service and the game if they run)
# Everything:   make dev in ../BalatroFrontEnd (the whole site, each part from its repository),
#               then http://localhost:5174/editor/ (through the portal: one origin, one session)
.DEFAULT_GOAL := help
.PHONY: help install run check test parity build docker

STACK := ../BalatroFrontEnd/docker-compose.yml

help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-8s %s\n", $$1, $$2}'

install: ## dependencies (npm install)
	npm install

run: ## the dev server on http://localhost:5176/editor/ (npm run dev)
	npm run dev

check: ## typecheck, Steiger and the tests (npm run check)
	npm run check

test: ## the format library's tests (npm test)
	npm test

parity: ## the validator against the engine's, on thousands of packages (needs ../BalatroEngine/.venv)
	npm run parity

build: ## the production build in dist/ (npm run build)
	npm run build

docker: ## the whole site in Docker (the game's compose file): http://localhost:8087/editor/
	docker compose -f $(STACK) up -d --build editor portal
