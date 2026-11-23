.DEFAULT_GOAL := help

SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c

APP_NAME := bomTR
VERSION := $(shell node -p "require('./package.json').version")
RELEASE_DIR := release
ARCHIVE := $(RELEASE_DIR)/$(APP_NAME)-v$(VERSION).zip
SHA_FILE := $(RELEASE_DIR)/SHA256SUMS.txt

.PHONY: help install dev typecheck test build check-version verify package clean distclean version release-dry

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*## "; printf "\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install npm dependencies
	npm install

dev: ## Start Vite dev server for sidepanel preview
	npm run dev

typecheck: ## Run TypeScript strict typecheck
	npm run typecheck

test: ## Run unit and contract tests
	npm test

build: ## Build production MV3 extension into dist/
	npm run build

check-version: ## Verify package.json, manifest.json, and release-please manifest match
	@node -e ' \
		const pkg = require("./package.json").version; \
		const man = require("./public/manifest.json").version; \
		const rp = require("./.release-please-manifest.json")["."]; \
		if (pkg !== man || pkg !== rp) { \
			console.error("Version mismatch:", { pkg, man, rp }); \
			process.exit(1); \
		} \
		console.log("Versions aligned: v" + pkg); \
	'

verify: check-version typecheck test build ## Run all checks and build

package: build ## Package dist/ as Chrome Web Store ZIP + SHA256SUMS
	@mkdir -p "$(RELEASE_DIR)"
	@rm -f "$(ARCHIVE)" "$(SHA_FILE)"
	@(cd dist && zip -rq "../$(ARCHIVE)" .)
	@(cd "$(RELEASE_DIR)" && (command -v sha256sum >/dev/null 2>&1 && sha256sum "$(notdir $(ARCHIVE))" || shasum -a 256 "$(notdir $(ARCHIVE))") > "$(notdir $(SHA_FILE))")
	@echo "Packaged $(ARCHIVE)"

release-dry: verify package ## Run full local release verification and archive build

version: ## Print current versions across manifests
	@node -e ' \
		console.log("package.json:                ", require("./package.json").version); \
		console.log("public/manifest.json:        ", require("./public/manifest.json").version); \
		console.log(".release-please-manifest.json:", require("./.release-please-manifest.json")["."]); \
	'

clean: ## Remove dist/ and release/ artifacts
	rm -rf dist "$(RELEASE_DIR)"

distclean: clean ## Remove build artifacts and node_modules/
	rm -rf node_modules
