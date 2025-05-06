#!/bin/sh

# Simple installer script for the Flamedeck CLI
# Usage: curl -sSL https://raw.githubusercontent.com/flamedeck-org/flamedeck/main/scripts/install.sh | sh
# Or: curl -sSL https://raw.githubusercontent.com/flamedeck-org/flamedeck/main/scripts/install.sh | sudo sh (to install to /usr/local/bin without prompt)

set -e # Exit on first error

# --- Configuration ---
GITHUB_ORG="flamedeck-org"
GITHUB_REPO="flamedeck"
TOOL_NAME="flamedeck"
INSTALL_DIR="/usr/local/bin"
# ---------------------

# --- Helper Functions ---
echo_err() {
  echo "Error: $1" >&2
  exit 1
}

check_dep() {
  command -v "$1" >/dev/null 2>&1 || echo_err "$1 is required but not installed. Please install it (e.g., using apt, brew, etc.)."
}
# ---------------------

# --- Check Dependencies ---
check_dep curl
check_dep jq
# ---------------------

# --- Detect Platform ---
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
ASSET_SUFFIX=""

case "$OS" in
  linux)
    case "$ARCH" in
      x86_64) ASSET_SUFFIX="linux-x64" ;;
      *) echo_err "Unsupported Linux architecture: $ARCH" ;;
    esac
    ;;
  darwin)
    case "$ARCH" in
      x86_64) ASSET_SUFFIX="macos-x64" ;;
      arm64 | aarch64) ASSET_SUFFIX="macos-arm64" ;;
      *) echo_err "Unsupported macOS architecture: $ARCH" ;;
    esac
    ;;
  *) echo_err "Unsupported operating system: $OS" ;;
esac

ASSET_NAME="${TOOL_NAME}-upload-${ASSET_SUFFIX}"
echo "Detected Platform: $OS/$ARCH -> Required Asset: $ASSET_NAME"
# ---------------------

# --- Get Download URL ---
API_URL="https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_REPO}/releases/latest"
echo "Fetching latest release information from GitHub API..."

RELEASE_INFO=$(curl --silent --location "$API_URL")
DOWNLOAD_URL=$(echo "$RELEASE_INFO" | jq --raw-output ".assets[] | select(.name == \"$ASSET_NAME\") | .browser_download_url")
LATEST_TAG=$(echo "$RELEASE_INFO" | jq --raw-output ".tag_name")

if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "null" ]; then
  echo_err "Could not find download URL for asset '$ASSET_NAME' in the latest release ($LATEST_TAG). Check https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/releases/latest"
fi
# ---------------------

# --- Download Binary ---
TMP_DIR=$(mktemp -d)
BINARY_PATH="${TMP_DIR}/${TOOL_NAME}"

echo "Downloading $ASSET_NAME (Release: $LATEST_TAG) from $DOWNLOAD_URL..."
curl --progress-bar --location "$DOWNLOAD_URL" --output "$BINARY_PATH"

if [ ! -f "$BINARY_PATH" ]; then
    echo_err "Download failed."
fi

chmod +x "$BINARY_PATH"
echo "Download complete: $BINARY_PATH"
# ---------------------

# --- Install Binary ---
TARGET_PATH="${INSTALL_DIR}/${TOOL_NAME}"
echo "Attempting to install to $TARGET_PATH..."

if mv "$BINARY_PATH" "$TARGET_PATH" >/dev/null 2>&1; then
  echo "Successfully installed $TOOL_NAME to $TARGET_PATH"
elif [ "$(id -u)" -ne 0 ]; then # Check if running as root
  echo "Could not write to $INSTALL_DIR. Re-running move with sudo..."
  sudo mv "$BINARY_PATH" "$TARGET_PATH"
  echo "Successfully installed $TOOL_NAME to $TARGET_PATH (using sudo)"
else
  echo_err "Failed to move binary to $TARGET_PATH even with root privileges."
fi
# ---------------------

# --- Cleanup ---
rm -rf "$TMP_DIR"
# -------------

echo "Installation complete. Try running '$TOOL_NAME --help'" 