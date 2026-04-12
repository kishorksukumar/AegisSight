#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
#  AegisSight — Update Script
#  Usage: ./update.sh [--version v0.3.0] [--skip-backup]
# ─────────────────────────────────────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

SKIP_BACKUP=false
TARGET_VERSION=""

# Parse args
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --skip-backup) SKIP_BACKUP=true ;;
    --version) TARGET_VERSION="$2"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

echo ""
echo -e "${CYAN}${BOLD}  AegisSight — Updater${NC}"
echo ""

# ── Verify we're in the right directory ──────────────────────────────────────
if [ ! -f "docker-compose.yml" ]; then
  echo -e "${RED}✗ docker-compose.yml not found. Run this script from the AegisSight root directory.${NC}"
  exit 1
fi

CURRENT_VERSION=$(grep '"version"' master-app/backend/package.json | head -1 | sed 's/.*"\(.*\)".*/\1/')
echo -e "  Current version: ${YELLOW}v${CURRENT_VERSION}${NC}"

# ── Step 1: Backup database ───────────────────────────────────────────────────
if [ "$SKIP_BACKUP" = false ]; then
  echo ""
  echo -e "${YELLOW}Step 1: Backing up database...${NC}"
  BACKUP_FILE="aegissight-backup-$(date +%Y%m%d-%H%M%S).sqlite"
  
  # Try to copy from running container first, fall back to local file
  if docker compose ps | grep -q "aegissight-backend"; then
    docker compose exec -T backend sh -c "cat /app/data/aegissight.sqlite" > "$BACKUP_FILE" 2>/dev/null || true
  fi
  
  # Also backup from local path if exists
  if [ -f "master-app/backend/aegissight.sqlite" ]; then
    cp "master-app/backend/aegissight.sqlite" "$BACKUP_FILE"
  fi
  
  if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    echo -e "${GREEN}✓ Database backed up to: ${BACKUP_FILE}${NC}"
  else
    echo -e "${YELLOW}⚠ No database file found to back up (may be first run or volume-based).${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Skipping database backup (--skip-backup).${NC}"
fi

# ── Step 2: Pull latest code ──────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 2: Pulling latest code from GitHub...${NC}"

if [ -n "$TARGET_VERSION" ]; then
  git fetch --tags
  git checkout "tags/${TARGET_VERSION}" -b "release-${TARGET_VERSION}" 2>/dev/null || git checkout "tags/${TARGET_VERSION}"
  echo -e "${GREEN}✓ Checked out version: ${TARGET_VERSION}${NC}"
else
  git pull origin main
  NEW_VERSION=$(grep '"version"' master-app/backend/package.json | head -1 | sed 's/.*"\(.*\)".*/\1/')
  echo -e "${GREEN}✓ Pulled latest: v${NEW_VERSION}${NC}"
fi

# ── Step 3: Check for .env changes ───────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 3: Checking for new environment variables...${NC}"

if [ -f ".env" ] && [ -f ".env.example" ]; then
  NEW_VARS=()
  while IFS= read -r line; do
    # Skip comments and blank lines
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    KEY=$(echo "$line" | cut -d'=' -f1)
    if ! grep -q "^${KEY}=" .env; then
      NEW_VARS+=("$line")
    fi
  done < .env.example
  
  if [ ${#NEW_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}  New variables found in .env.example not in your .env:${NC}"
    for v in "${NEW_VARS[@]}"; do
      echo -e "    ${CYAN}${v}${NC}"
      echo "$v" >> .env
    done
    echo -e "${GREEN}✓ New variables appended to .env${NC}"
  else
    echo -e "${GREEN}✓ .env is up to date${NC}"
  fi
fi

# ── Step 4: Rebuild containers ────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 4: Rebuilding and restarting containers...${NC}"
docker compose pull --quiet certbot nginx 2>/dev/null || true
docker compose up -d --build

echo ""
echo -e "${GREEN}${BOLD}✓ AegisSight updated successfully!${NC}"
echo ""

NEW_VERSION=$(grep '"version"' master-app/backend/package.json | head -1 | sed 's/.*"\(.*\)".*/\1/')
echo -e "  Updated to: ${CYAN}v${NEW_VERSION}${NC}"

if [ -f "$BACKUP_FILE" ] 2>/dev/null; then
  echo -e "  Backup file: ${YELLOW}${BACKUP_FILE}${NC}"
fi

echo ""
echo -e "  View logs: ${YELLOW}docker compose logs -f${NC}"
echo ""
