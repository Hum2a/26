#!/usr/bin/env bash
# Cut a release: set the version everywhere, tag it, publish it, deploy it,
# and check the live sites report it.
#
#   ./release.sh                 next patch (0.0.1 -> 0.0.2), deploy to staging
#   ./release.sh patch           the same
#   ./release.sh 0.0.1           an exact version
#   ./release.sh current         print the current version and stop
#
# Options:
#   --deploy=both|staging|production|none   where to deploy (default: staging)
#   --confirm-production                    required for production or both
#   --override-freeze                       deploy production during the party freeze
#   --dry-run                               show what would happen, change nothing
#   --skip-checks                           skip the pre-release checks
#   --full-checks                           also run the full API suite (slow)
#   --no-github                             no GitHub release (tag is still pushed)
#   --v1                                    allow 1.0.0 and above (the final product)
#
# The version lives in the root package.json (and its lockfile entry),
# packages/shared/src/version.ts (shown in the admin sidebar and returned by
# /api/health), a v-prefixed git tag, and a GitHub release. Workspace packages
# stay at 0.0.0: they are internal and depend on each other by that version.
set -euo pipefail

cd "$(dirname "$0")"

bump="patch"
deploy="staging"
confirm_production=false
override_freeze=false
full_checks=false
dry_run=false
skip_checks=false
github=true
allow_v1=false

for arg in "$@"; do
  case "$arg" in
    --deploy=*) deploy="${arg#--deploy=}" ;;
    --dry-run) dry_run=true ;;
    --skip-checks) skip_checks=true ;;
    --full-checks) full_checks=true ;;
    --confirm-production) confirm_production=true ;;
    --override-freeze) override_freeze=true ;;
    --no-github) github=false ;;
    --v1) allow_v1=true ;;
    -h|--help) sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) bump="$arg" ;;
  esac
done

case "$deploy" in
  both|staging|production|none) ;;
  *) echo "--deploy must be both, staging, production or none." >&2; exit 2 ;;
esac

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# Production is never deployed by accident: it needs an explicit flag, and
# the party weekend is frozen because a deploy drops every phone's connection.
if [[ "$dry_run" != true && ( "$deploy" == both || "$deploy" == production ) ]]; then
  [[ "$confirm_production" == true ]] || fail "Deploying to production needs --confirm-production. Deploy to staging and check it first."
  if [[ "$override_freeze" != true ]] && node --experimental-strip-types -e "import('./scripts/release-support.ts').then((m) => process.exit(m.inDeployFreeze(Date.now()) ? 0 : 1))"; then
    fail "Production is frozen for the party weekend (20 Nov to midday 22 Nov). Pass --override-freeze only for an emergency fix."
  fi
fi

current="$(node -p "require('./package.json').version || '0.0.0'")"

if [[ "$bump" == "current" ]]; then
  echo "v$current"
  exit 0
fi

if [[ "$bump" == "patch" ]]; then
  next="$(node -p "const [a,b,c]='$current'.split('.').map(Number); [a,b,c+1].join('.')")"
elif [[ "$bump" =~ ^v?([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  next="${BASH_REMATCH[1]}"
else
  fail "Use patch, an exact version like 0.0.1, or current. Got: $bump"
fi

major="${next%%.*}"
if (( major >= 1 )) && [[ "$allow_v1" != true ]]; then
  fail "v$next is a 1.x release. V1 is for the finished product: pass --v1 when it is."
fi

if [[ "$next" == "$current" && "$current" != "0.0.0" ]]; then
  fail "Already at v$current. Use patch or a higher version."
fi

say "Release v$current -> v$next (deploy: $deploy)"

# The tree must be clean and on master, so the release is exactly what is committed.
branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "master" ]] || fail "Releases are cut from master. You are on $branch."
if [[ -n "$(git status --porcelain)" ]]; then
  [[ "$dry_run" == true ]] || fail "Commit or stash your changes first:
$(git status --short)"
  echo "Warning: uncommitted changes. A real release would stop here."
fi

git fetch --quiet origin master --tags
behind="$(git rev-list --count HEAD..origin/master)"
(( behind == 0 )) || fail "master is $behind commit(s) behind origin. Pull first."
if git rev-parse -q --verify "refs/tags/v$next" >/dev/null; then
  fail "Tag v$next already exists."
fi

if [[ "$dry_run" == true ]]; then
  echo "Dry run. Would:"
  echo "  - set version $next in package.json, package-lock.json and packages/shared/src/version.ts"
  [[ "$skip_checks" == true ]] || echo "  - run typecheck, content, unit, lint and script checks$([[ "$full_checks" == true ]] && echo ", and the full API suite")"
  echo "  - commit \"Release v$next\", tag v$next, push master and the tag"
  [[ "$github" == true ]] && echo "  - create GitHub release v$next"
  [[ "$deploy" != none ]] && echo "  - deploy to $deploy and check /api/health reports $next"
  exit 0
fi

say "Setting the version to $next"
node -e "
const fs = require('fs');
const version = '$next';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
// Keep version right after name.
const ordered = {};
for (const [key, value] of Object.entries(pkg)) {
  if (key === 'version') continue;
  ordered[key] = value;
  if (key === 'name') ordered.version = version;
}
if (!('version' in ordered)) ordered.version = version;
fs.writeFileSync('package.json', JSON.stringify(ordered, null, 2) + '\n');
if (fs.existsSync('package-lock.json')) {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  lock.version = version;
  if (lock.packages && lock.packages['']) lock.packages[''].version = version;
  fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
}
fs.writeFileSync(
  'packages/shared/src/version.ts',
  '// Written by release.sh. Do not edit by hand: run \`npm run release\`.\n' +
    'export const appVersion = \"' + version + '\";\n',
);
"

if [[ "$skip_checks" != true ]]; then
  say "Checking"
  checks_ok=true
  npm run typecheck && npm run content:check && npm run test:unit && npx eslint . && npm run test:release || checks_ok=false
  if [[ "$checks_ok" == true && "$full_checks" == true ]]; then
    npm run test -w @26/api || checks_ok=false
  fi
  if [[ "$checks_ok" != true ]]; then
    git checkout -- package.json package-lock.json packages/shared/src/version.ts
    fail "Checks failed. The version change was undone; nothing was committed."
  fi
fi

say "Committing and tagging v$next"
git add package.json package-lock.json packages/shared/src/version.ts
git commit --quiet -m "Release v$next"
git tag -a "v$next" -m "Release v$next"
git push --quiet origin master
git push --quiet origin "v$next"
echo "Pushed master and v$next."

if [[ "$github" == true ]]; then
  if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
    say "Creating GitHub release v$next"
    prerelease=()
    (( major < 1 )) && prerelease=(--prerelease)
    gh release create "v$next" --title "v$next" --generate-notes --verify-tag "${prerelease[@]}"
  else
    echo "GitHub CLI is missing or signed out: skipped the GitHub release (the tag is pushed)."
  fi
fi

check_live() {
  local url="$1"
  for attempt in 1 2 3 4 5 6; do
    local body
    body="$(curl -fsS --max-time 15 "$url" 2>/dev/null || true)"
    if [[ "$body" == *"\"version\":\"$next\""* ]]; then
      echo "  $url reports v$next"
      return 0
    fi
    sleep 5
  done
  echo "  $url does not report v$next yet: ${body:-no response}" >&2
  return 1
}

if [[ "$deploy" != none ]]; then
  say "Deploying v$next to $deploy"
  # Branch/cleanliness were required before the version bump. Checks and the
  # bump may leave generated files, so release.ts git state is skipped here.
  # Confirmation and freeze still go through the common deploy entry point.
  deploy_options=(--skip-checks)
  [[ "$confirm_production" == true ]] && deploy_options+=(--confirm-production)
  [[ "$override_freeze" == true ]] && deploy_options+=(--override-freeze)
  SKIP_GIT_CHECK=true npm run "deploy:$deploy" -- "${deploy_options[@]}"
  say "Checking the live sites"
  ok=true
  if [[ "$deploy" == both || "$deploy" == staging ]]; then
    check_live "https://26-staging.humza.website/api/health" || ok=false
  fi
  if [[ "$deploy" == both || "$deploy" == production ]]; then
    check_live "https://26.humza.website/api/health" || ok=false
  fi
  [[ "$ok" == true ]] || fail "Deployed, but a site is not reporting v$next yet. Check it, then rerun the deploy."
fi

say "Released v$next"
