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

## Distribution / Releases (for Maintainers)

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

Pushing a tag matching the `v*.*.*-cli` pattern automatically triggers the GitHub Action defined in `.github/workflows/release-cli.yml`, which builds the binaries and attaches them to a new GitHub Release.

You can find all releases here: [https://github.com/flamedeck-org/flamedeck/releases](https://github.com/flamedeck-org/flamedeck/releases) *(Replace with your actual organization/repo name)* 