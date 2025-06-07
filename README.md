<div align="center">

<img src="apps/client/public/android-chrome-512x512.png" alt="FlameDeck Logo" width="80" height="80">

<h1>FlameDeck</h1>

<p><em>AI-Powered Performance Analysis</em></p>

</div>

FlameDeck is a collaborative platform for storing, analyzing, and debugging performance traces. Upload your profile once, explore it anywhere, and share insights with your team—all in one place.

**Key capabilities**

* 🧩 **Universal format support** – Import traces from Node.js, Go, Rust, Python, Chrome, React Native, and many more.
* 📊 **Interactive visualizations** – Timeline, Left-Heavy, and Sandwich flamegraphs powered by Speedscope with smooth, hardware-accelerated rendering.
* 🤖 **AI-powered insights** – Ask questions in plain English, automatically detect bottlenecks, and receive actionable optimization recommendations.
* 👥 **Team collaboration** – Comment on frames, share public links, and control permissions to keep everyone on the same page.
* 🛠️ **Developer-friendly workflows** – Drag-and-drop uploads in the browser, first-class CLI & REST API, and seamless CI/CD integration.

This monorepo contains:

*   The frontend web application (`apps/client/`)
*   Backend services using Supabase (database schema, edge functions) (`supabase/`)
*   Shared code libraries (`packages/`)
*   A command-line interface (CLI) tool for uploading traces (`cli-rust/`)
*   A JavaScript/TypeScript client library for uploading traces ([`@flamedeck/upload`](packages/client-uploader/))
*   An MCP server for AI-powered trace analysis ([`@flamedeck/flamechart-mcp`](packages/flamechart-mcp/))

## Installing the `flamedeck` CLI

The `flamedeck` CLI provides a convenient way to upload trace files to [Flamedeck](https://www.flamedeck.com) directly from your terminal or CI pipelines.

### Using Homebrew (Recommended for macOS)

1.  **Tap the Flamedeck repository (only needed once):**
    ```bash
    brew tap flamedeck-org/flamedeck
    ```
2.  **Install the CLI:**
    ```bash
    brew install flamedeck
    ```
    Homebrew installs the correct binary (Intel or Apple Silicon) and adds `flamedeck` to your PATH.

    *(Note: On first run, macOS Gatekeeper might show a security warning. To allow the app, find it (usually `/opt/homebrew/bin/flamedeck` or `/usr/local/bin/flamedeck`), right-click it in Finder, select "Open", and confirm.)*

### Using Install Script (Recommended for Linux / macOS CI)

Run the following command in your terminal. It automatically detects your OS/architecture, downloads the latest release, and installs it to `/usr/local/bin` (may prompt for sudo).

```bash
curl -sSL https://raw.githubusercontent.com/flamedeck-org/flamedeck/main/scripts/install.sh | sh
```
*(You can pipe to `sudo sh` instead if you prefer to grant sudo upfront).*

### Manual Installation (Linux, Windows, macOS)

1.  Go to the [**Latest Release**](https://github.com/flamedeck-org/flamedeck/releases/latest) page.
2.  Download the appropriate binary for your system:
    *   `flamedeck-linux-x64`
    *   `flamedeck-macos-x64`
    *   `flamedeck-macos-arm64`
    *   `flamedeck-win-x64.exe`
3.  Rename the downloaded binary to `flamedeck` (or `flamedeck.exe` for Windows).
4.  Place the renamed binary in a directory that is part of your system's `PATH`. A common choice on Linux/macOS is `~/.local/bin` or `/usr/local/bin`.
5.  Make it executable (Linux/macOS):
    ```bash
    chmod +x /path/to/your/flamedeck
    ```
6.  *(macOS Only): You might need to bypass Gatekeeper on first run (Right-click -> Open in Finder). See the Homebrew section for details.*

## CLI Usage Example

```bash
# Ensure API key is set (or use --api-key flag)
export FLAMEDECK_API_KEY="YOUR_API_KEY"

# Basic upload
flamedeck upload -s "My Performance Test" /path/to/my_trace.json

# More detailed upload with metadata
flamedeck upload \
  --scenario "User login flow - EU region" \
  --commit "a1b2c3d4e5f6" \
  --branch "feature/new-login" \
  --notes "Trace captured during peak load on staging server." \
  --folder-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  --metadata '{"ci_build_id": 456, "region": "eu-west-1", "test_variant": "A"}' \
   # Add this line to make the trace publicly viewable!
  --public \
  /path/to/another_trace.json

# Upload via stdin (requires --file-name)
cat /path/to/trace.json | flamedeck upload -s "Piped Test" -n "trace.json"

# Get help
flamedeck --help
flamedeck upload --help
```