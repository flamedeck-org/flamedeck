# Flamechart Server

This server provides an HTTP API for rendering performance profiles (specifically those compatible with the Speedscope format) into flamegraph PNG images.

It utilizes the `@flamedeck/flamechart-to-png` package to perform the rendering.

## API

### `POST /render`

Renders a flamegraph from the profile data provided in the request body.

**Request Body:**

- The raw content of the performance profile file (e.g., a `.cpuprofile` or a speedscope-formatted JSON file).

**Query Parameters:**

- `width` (number, optional): Width of the output PNG in pixels. Defaults to 1200.
- `height` (number, optional): Maximum height of the output PNG. If not provided, height is estimated based on content, capped by width. Defaults to 800.
- `mode` (string, optional): Theme mode, either `'light'` or `'dark'`. Defaults to `'light'`.
- `flamegraphThemeName` (string, optional): Name of a specific flamegraph theme (e.g., `'fire'`, `'rust'`, `'nodejs'`). Defaults to system theme.
- `startTimeMs` (number, optional): Start time in milliseconds to zoom into.
- `endTimeMs` (number, optional): End time in milliseconds to zoom into.
- `startDepth` (number, optional): The depth level (stack frame row) to start rendering from (0-indexed). Defaults to 0.

**Content-Type:**

- Must be `text/plain` (or another appropriate type for your profile data).

**Response:**

- On success: A PNG image (`image/png`).
- On error: A JSON response with an error message.

**Example Usage (using cURL):**

```bash
curl -X POST --header "Content-Type: text/plain" \
    --data-binary "@/path/to/your/profile.json" \
    "https://flamedeck.fly.dev/render?mode=dark&flamegraphThemeName=fire&width=1600&startDepth=15" \
    -o output.png
```

_Replace `/path/to/your/profile.json` with the actual path to your profile file._
_This example renders the profile using dark mode, the 'fire' theme, a width of 1600px, starting at depth 15, and saves the output to `output.png`._
