package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime/pprof"
	"time"
)

//go:noinline
// innerFunctionA1 performs a small amount of CPU work.
func innerFunctionA1() {
	for i := 0; i < 10000000; i++ {
		_ = i * i
	}
}

//go:noinline
// innerFunctionA2 performs a medium amount of CPU work.
func innerFunctionA2() {
	for i := 0; i < 50000000; i++ {
		_ = i * i
	}
}

//go:noinline
// middleFunctionA calls inner functions.
func middleFunctionA() {
	innerFunctionA1()
	innerFunctionA2()
}

//go:noinline
// innerFunctionB1 performs a large amount of CPU work.
func innerFunctionB1() {
	for i := 0; i < 100000000; i++ {
		_ = i * i
	}
}

//go:noinline
// middleFunctionB calls an inner function.
func middleFunctionB() {
	innerFunctionB1()
}

//go:noinline
// outerFunction simulates a more complex series of operations.
func outerFunction() {
	fmt.Println("Outer function started")
	for i := 0; i < 3; i++ {
		middleFunctionA()
		// Simulate some other work or delay that isn't pure CPU
		time.Sleep(50 * time.Millisecond)
		middleFunctionB()
	}
	for i := 0; i < 2; i++ {
		middleFunctionA()
	}
	fmt.Println("Outer function finished.")
}

func main() {
	// Define the output path for the profile.
	profilePath := filepath.Join("trace-examples", "go", "complex_go_trace.pprof")

	// Create a file to write the CPU profile to.
	f, err := os.Create(profilePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not create CPU profile at %s: %v\n", profilePath, err)
		os.Exit(1)
	}
	defer f.Close() // error handling omitted for brevity

	// Start CPU profiling.
	if err := pprof.StartCPUProfile(f); err != nil {
		fmt.Fprintf(os.Stderr, "could not start CPU profile: %v\n", err)
		os.Exit(1)
	}
	defer pprof.StopCPUProfile()

	fmt.Println("Starting the complex function...")
	outerFunction()
	fmt.Printf("Profiling finished. Profile saved to %s\n", profilePath)
} 