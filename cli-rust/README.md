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
    The executable will be located at `target/debug/flamedeck` (or `target\debug\flamedeck.exe` on Windows).

3.  **Build (Release):** For an optimized release build (smaller and faster):
    ```bash
    cargo build --release
    ```
    The executable will be located at `target/release/flamedeck` (or `target\release\flamedeck.exe` on Windows).

## Distribution / Releases

Releases are handled automatically via GitHub Actions when a tag matching `v*.*.*-cli` is pushed. Binaries are attached to the GitHub Release.

For Homebrew distribution, the formula in the separate `flamedeck-org/homebrew-flamedeck` repository must be manually updated after each release:

1.  Update `version`, `url`s, and `sha256` checksums in `Formula/flamedeck.rb`.
2.  Commit and push the changes to the `homebrew-flamedeck` repository.

To create a new release with binaries for Linux, macOS, and Windows:

1.  **Create a new tag:**
    ```bash
    # Replace vX.Y.Z with the desired version number (e.g., v0.1.0)
    git tag vX.Y.Z-cli
    ```

2.  **Push the tag to GitHub:**
    ```bash
    # Replace vX.Y.Z with the same version number
    git push origin vX.Y.Z-cli
    ```

You can find all releases here: [https://github.com/flamedeck-org/flamedeck/releases](https://github.com/flamedeck-org/flamedeck/releases)