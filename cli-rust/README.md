# Flamedeck Trace Upload CLI (Rust)

Command-line tool (CLI) written in Rust for uploading trace files to Flamedeck via the API.

This version is built in Rust to produce small, fast, self-contained binaries.

## Prerequisites

- Rust and Cargo (Install via [rustup](https://www.rust-lang.org/tools/install))

## Building Locally

To build the CLI on your local machine:

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-dir>/cli-rust
    ```
2.  **Build (Debug):** For development and testing, use a debug build:
    ```bash
    cargo build
    ```
    The executable will be located at `target/debug/cli-rust` (or `target\debug\cli-rust.exe` on Windows).

3.  **Build (Release):** For an optimized release build (smaller and faster):
    ```bash
    cargo build --release
    ```
    The executable will be located at `target/release/cli-rust` (or `target\release\cli-rust.exe` on Windows).

## Usage (Local Build)

Once built, you can run the executable directly from the `target/<debug_or_release>/` directory.

```bash
# Example on macOS/Linux (using release build):
export FLAMEDECK_API_KEY="YOUR_API_KEY"
./target/release/cli-rust -s "My Local Rust Test" /path/to/your/trace.json

# Example piping on Linux:
export FLAMEDECK_API_KEY="YOUR_API_KEY"
cat /path/to/your/trace.json | ./target/release/cli-rust -s "Piped Test" -n "trace.json"
```

Refer to the built-in help for all available options:

```bash
./target/release/cli-rust --help
```

## Distribution / Releases

Official binaries for Linux (x64), macOS (x64, ARM64), and Windows (x64) are automatically built and attached to **GitHub Releases** whenever a tag matching the pattern `v*.*.*-cli` is pushed.

Find the latest release and download the appropriate binary for your platform here:

[**Latest Release**](https://github.com/flamedeck-org/flamedeck/releases/latest) *(Replace with your actual organization/repo name)*

See the workflow definition at `.github/workflows/release-cli.yml`. 