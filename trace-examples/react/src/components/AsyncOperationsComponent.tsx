import React, { useState, useCallback, useEffect } from 'react'

interface AsyncResult {
    id: number
    operation: string
    duration: number
    result: any
}

export function AsyncOperationsComponent() {
    const [results, setResults] = useState<AsyncResult[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [activeOperations, setActiveOperations] = useState(0)

    // Simulate async operation with artificial delay
    const asyncOperation = useCallback(async (id: number, delay: number): Promise<any> => {
        const start = performance.now()

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, delay))

        // Simulate some CPU work after the delay
        let result = 0
        for (let i = 0; i < 1000000; i++) {
            result += Math.sin(i) * Math.cos(i)
        }

        const duration = performance.now() - start
        return { result, duration, id }
    }, [])

    // Create a promise chain that does multiple async operations
    const chainedAsyncOperations = useCallback(async () => {
        const start = performance.now()

        try {
            // Chain multiple async operations
            const result1 = await asyncOperation(1, 100)
            const result2 = await asyncOperation(2, 150)
            const result3 = await asyncOperation(3, 200)

            // Combine results
            const combinedResult = {
                total: result1.result + result2.result + result3.result,
                operations: [result1, result2, result3]
            }

            const totalDuration = performance.now() - start

            setResults(prev => [...prev, {
                id: Date.now(),
                operation: 'Chained Operations',
                duration: totalDuration,
                result: combinedResult
            }])
        } catch (error) {
            console.error('Chained operations failed:', error)
        }
    }, [asyncOperation])

    // Run multiple concurrent async operations
    const concurrentAsyncOperations = useCallback(async () => {
        const start = performance.now()
        setActiveOperations(10)

        try {
            // Create 10 concurrent operations
            const promises = Array.from({ length: 10 }, (_, i) =>
                asyncOperation(i, 50 + Math.random() * 200)
            )

            const results = await Promise.all(promises)
            const totalDuration = performance.now() - start

            setResults(prev => [...prev, {
                id: Date.now(),
                operation: 'Concurrent Operations',
                duration: totalDuration,
                result: { results, count: results.length }
            }])
        } catch (error) {
            console.error('Concurrent operations failed:', error)
        } finally {
            setActiveOperations(0)
        }
    }, [asyncOperation])

    // Simulate a promise that rejects and has to be retried
    const flakyAsyncOperation = useCallback(async () => {
        const start = performance.now()
        let attempts = 0
        const maxAttempts = 5

        const attemptOperation = async (): Promise<any> => {
            attempts++
            await new Promise(resolve => setTimeout(resolve, 100))

            // 60% chance of failure for first few attempts
            if (attempts < 4 && Math.random() < 0.6) {
                throw new Error(`Attempt ${attempts} failed`)
            }

            // Success
            return { attempts, success: true }
        }

        try {
            let result: any = null
            while (attempts < maxAttempts) {
                try {
                    result = await attemptOperation()
                    break
                } catch (error) {
                    console.log(`Attempt ${attempts} failed, retrying...`)
                    if (attempts >= maxAttempts) {
                        throw error
                    }
                }
            }

            const totalDuration = performance.now() - start

            setResults(prev => [...prev, {
                id: Date.now(),
                operation: 'Flaky Operation with Retries',
                duration: totalDuration,
                result
            }])
        } catch (error) {
            console.error('Flaky operation ultimately failed:', error)
        }
    }, [])

    // Memory-intensive async operation that processes large arrays
    const memoryIntensiveAsync = useCallback(async () => {
        const start = performance.now()

        // Create large arrays and process them asynchronously
        const processLargeArray = async (size: number): Promise<number[]> => {
            await new Promise(resolve => setTimeout(resolve, 50))

            const largeArray = Array.from({ length: size }, () => Math.random())

            // Process the array in chunks to avoid blocking
            const processedChunks: number[] = []
            const chunkSize = 10000

            for (let i = 0; i < largeArray.length; i += chunkSize) {
                const chunk = largeArray.slice(i, i + chunkSize)
                const processed = chunk.map(x => x * x).reduce((a, b) => a + b, 0)
                processedChunks.push(processed)

                // Yield control back to the event loop
                await new Promise(resolve => setTimeout(resolve, 0))
            }

            return processedChunks
        }

        try {
            const results = await Promise.all([
                processLargeArray(100000),
                processLargeArray(150000),
                processLargeArray(200000)
            ])

            const totalDuration = performance.now() - start

            setResults(prev => [...prev, {
                id: Date.now(),
                operation: 'Memory Intensive Async',
                duration: totalDuration,
                result: { arraysProcessed: results.length, totalElements: 450000 }
            }])
        } catch (error) {
            console.error('Memory intensive operation failed:', error)
        }
    }, [])

    const clearResults = useCallback(() => {
        setResults([])
    }, [])

    const runAllOperations = useCallback(async () => {
        setIsRunning(true)

        try {
            await chainedAsyncOperations()
            await concurrentAsyncOperations()
            await flakyAsyncOperation()
            await memoryIntensiveAsync()
        } catch (error) {
            console.error('Error running operations:', error)
        } finally {
            setIsRunning(false)
        }
    }, [chainedAsyncOperations, concurrentAsyncOperations, flakyAsyncOperation, memoryIntensiveAsync])

    const styles = {
        container: {
            padding: '20px',
        },
        controls: {
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            flexWrap: 'wrap' as const,
        },
        button: {
            padding: '10px 20px',
            backgroundColor: '#20c997',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
        },
        dangerButton: {
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
        },
        clearButton: {
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
        },
        stats: {
            padding: '10px',
            backgroundColor: '#e9ecef',
            borderRadius: '5px',
            marginBottom: '10px',
        },
        warning: {
            padding: '10px',
            backgroundColor: '#d1ecf1',
            border: '1px solid #bee5eb',
            borderRadius: '5px',
            marginBottom: '20px',
            color: '#0c5460',
        },
        results: {
            maxHeight: '400px',
            overflowY: 'auto' as const,
            border: '1px solid #dee2e6',
            borderRadius: '5px',
            padding: '10px',
        },
        result: {
            padding: '10px',
            marginBottom: '10px',
            backgroundColor: 'white',
            border: '1px solid #e9ecef',
            borderRadius: '5px',
        },
    }

    return (
        <div style={styles.container}>
            <h2>Async Operations & Promise Chains</h2>
            <div style={styles.warning}>
                ℹ️ These operations demonstrate various async patterns.
            </div>

            <div style={styles.stats}>
                <strong>Completed Operations:</strong> {results.length}
                <br />
                <strong>Status:</strong> {isRunning ? 'Running operations...' : 'Idle'}
                <br />
                <strong>Active Concurrent Operations:</strong> {activeOperations}
            </div>

            <div style={styles.controls}>
                <button
                    style={styles.button}
                    onClick={chainedAsyncOperations}
                    disabled={isRunning}
                >
                    Run Chained Operations
                </button>
                <button
                    style={styles.button}
                    onClick={concurrentAsyncOperations}
                    disabled={isRunning}
                >
                    Run Concurrent Operations
                </button>
                <button
                    style={styles.button}
                    onClick={flakyAsyncOperation}
                    disabled={isRunning}
                >
                    Run Flaky Operation
                </button>
                <button
                    style={styles.button}
                    onClick={memoryIntensiveAsync}
                    disabled={isRunning}
                >
                    Memory Intensive Async
                </button>
                <button
                    style={styles.dangerButton}
                    onClick={runAllOperations}
                    disabled={isRunning}
                >
                    Run All Operations
                </button>
                <button
                    style={styles.clearButton}
                    onClick={clearResults}
                >
                    Clear Results
                </button>
            </div>

            {results.length > 0 && (
                <div style={styles.results}>
                    <h4>Operation Results:</h4>
                    {results.map(result => (
                        <div key={result.id} style={styles.result}>
                            <strong>{result.operation}</strong>
                            <br />
                            Duration: {result.duration.toFixed(2)}ms
                            <br />
                            Result: {JSON.stringify(result.result, null, 2).substring(0, 200)}
                            {JSON.stringify(result.result, null, 2).length > 200 && '...'}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
} 