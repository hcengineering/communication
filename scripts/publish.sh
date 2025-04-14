#!/bin/bash

# Packages to publish
PUBLISH_PACKAGES=("types" "sdk-types" "shared" "yaml" "rest-client" "query" "client-query" "cockroach" "server")

package_paths=()
package_versions=()

save_versions() {
  for pkg in packages/*; do
    if [ -d "$pkg" ]; then
      local package_json="$pkg/package.json"
      if [ -f "$package_json" ]; then
        local ver
        ver=$(jq -r '.version' "$package_json")
        package_paths+=("$pkg")
        package_versions+=("$ver")
      fi
    fi
  done
}

restore_versions() {
  local length=${#package_paths[@]}
  for ((i = 0; i < length; i++)); do
    local pkg="${package_paths[$i]}"
    local old_version="${package_versions[$i]}"
    local package_json="$pkg/package.json"
    jq --arg old_version "$old_version" '.version = $old_version' "$package_json" > "$package_json.tmp" && mv "$package_json.tmp" "$package_json"
  done
}

bump_global_version() {
  local version_file="./.version"

  if [ -f "$version_file" ]; then
    current_version=$(cat "$version_file" | tr -d '"')
    IFS='.' read -r major minor patch <<< "$current_version"
    new_version="$major.$minor.$((patch + 1))"
    echo "$new_version" > "$version_file"
    echo "Version updated to $new_version"
  else
    echo "❌ Version file $version_file not found"
    exit 1
  fi
}

update_package_json() {
  local pkg_path=$1
  local package_json="$pkg_path/package.json"

  if [ -f "$package_json" ]; then
    jq --arg new_version "$new_version" '.version = $new_version' "$package_json" > "$package_json.tmp" && mv "$package_json.tmp" "$package_json"
    echo "Updated version for $pkg_path to $new_version"
  else
    echo "❌ package.json not found in $pkg_path"
  fi
}

save_versions
bump_global_version

for pkg in packages/*; do
  if [ -d "$pkg" ]; then
    update_package_json "$pkg"
    rm -rf "$pkg/types" "$pkg/dist"
  fi
done

bun update
bun install
bun run build

for pkg in "${PUBLISH_PACKAGES[@]}"; do
  echo "📦 Publishing $pkg..."
  (cd "packages/$pkg" && bun publish) || echo "❌ Failed to publish $pkg"
done

restore_versions

echo "✅ Done!"