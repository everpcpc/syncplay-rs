.PHONY: bump-major bump-minor bump-patch format run test lint install build

# Get current version from tauri.conf.json
CURRENT_VERSION := $(shell jq -r '.version' src-tauri/tauri.conf.json)

# Parse version components
MAJOR := $(shell echo $(CURRENT_VERSION) | cut -d. -f1)
MINOR := $(shell echo $(CURRENT_VERSION) | cut -d. -f2)
PATCH := $(shell echo $(CURRENT_VERSION) | cut -d. -f3)

run:
	@echo "Starting Syncplay Tauri in development mode..."
	@pnpm tauri dev 2>&1 | tee debug.log

install:
	@echo "Installing frontend dependencies..."
	@pnpm install

build:
	@echo "Building Syncplay Tauri for production..."
	@pnpm tauri build

format:
	@echo "Formatting Rust code..."
	@cd src-tauri && cargo fmt
	@echo "Formatting frontend code..."
	@pnpm run format
	@echo "All code formatted successfully"

test:
	@echo "Running Rust tests..."
	@cd src-tauri && cargo test
	@echo "All tests completed"

lint:
	@echo "Linting Rust code..."
	@cd src-tauri && cargo clippy --all-targets
	@echo "Type-checking frontend..."
	@pnpm exec tsc --noEmit
	@echo "Lint checks completed"

bump-major:
	@echo "Bumping major version from $(CURRENT_VERSION)"
	$(eval NEW_VERSION := $(shell echo $$(($(MAJOR) + 1)).0.0))
	@$(MAKE) update-version NEW_VERSION=$(NEW_VERSION)

bump-minor:
	@echo "Bumping minor version from $(CURRENT_VERSION)"
	$(eval NEW_VERSION := $(MAJOR).$(shell echo $$(($(MINOR) + 1))).0)
	@$(MAKE) update-version NEW_VERSION=$(NEW_VERSION)

bump-patch:
	@echo "Bumping patch version from $(CURRENT_VERSION)"
	$(eval NEW_VERSION := $(MAJOR).$(MINOR).$(shell echo $$(($(PATCH) + 1))))
	@$(MAKE) update-version NEW_VERSION=$(NEW_VERSION)

update-version:
	@echo "Updating version to $(NEW_VERSION)"
	@jq '.version = "$(NEW_VERSION)"' src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json
	@git add src-tauri/tauri.conf.json
	@git commit -m "chore: bump version to $(NEW_VERSION)"
	@echo "Version bumped to $(NEW_VERSION) and committed"
	@echo "Run 'git push origin main' to trigger the release workflow"
