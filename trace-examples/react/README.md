# Slow React App for Performance Testing

A React application with intentionally poor performance patterns designed for testing profile generation and debugging.

## Features

This app demonstrates various performance bottlenecks that can be profiled:

- **Slow List Rendering**: Renders large lists without virtualization
- **CPU Intensive Operations**: Mimics the nested function structure from the Go example
- **Memory Heavy Operations**: Creates large objects and potential memory leaks
- **DOM Manipulation**: Causes layout thrashing and expensive DOM operations
- **Async Operations**: Complex promise chains and concurrent operations

## Getting Started

1. Install dependencies:
```bash
cd trace-examples/react
yarn install
```

2. Start the development server:
```bash
yarn dev
```

3. Open your browser to http://localhost:3001

## Profiling Instructions

### Chrome DevTools
1. Open Chrome DevTools (F12)
2. Go to the "Performance" tab
3. Click "Record" 
4. Interact with the slow operations in the app
5. Click "Stop" to generate a profile

### React DevTools Profiler
1. Install React DevTools browser extension
2. Open the "Profiler" tab
3. Click "Start profiling"
4. Trigger slow operations
5. Click "Stop profiling"

## Performance Bottlenecks

### Slow List Component
- Creates 500+ list items by default
- Each item does expensive computation
- No virtualization or memoization
- Force re-renders trigger recalculation

### CPU Intensive Component
- Nested function calls similar to the Go profiler example
- Fibonacci calculation with exponential complexity
- Prime number calculation
- Intentional busy waiting

### Memory Heavy Component  
- Allocates large objects with nested data
- Creates circular references
- Monitors memory usage in real-time
- Memory leak simulation

### DOM Manipulation Component
- Creates many DOM elements dynamically
- Causes layout thrashing by reading/writing layout properties
- Rapid element creation and removal
- Expensive CSS animations

### Async Operations Component
- Promise chains and concurrent operations
- Simulated network delays
- Retry logic with failures
- Memory-intensive async processing

## Tips for Profiling

1. Use the "Slow 3G" network throttling to make async operations more visible
2. Enable "CPU 4x slowdown" to see CPU-intensive operations more clearly
3. Use the Memory tab to analyze memory usage patterns
4. Profile in production builds (`yarn build && yarn preview`) for more realistic results

## What to Look For

- Function call stacks in CPU profiles
- Memory allocation patterns
- Layout/reflow warnings
- Long tasks blocking the main thread
- Promise resolution timing
- Garbage collection events 