import React, { useState, useCallback, useEffect } from 'react'

// Simulate the nested function structure from the Go example
function innerFunctionA1(): number {
    let result = 0
    for (let i = 0; i < 10000000; i++) {
        result += i * i
    }
    return result
}

function innerFunctionA2(): number {
    let result = 0
    for (let i = 0; i < 50000000; i++) {
        result += i * i
    }
    return result
}

function middleFunctionA(): number {
    const a1 = innerFunctionA1()
    const a2 = innerFunctionA2()
    return a1 + a2
}

function innerFunctionB1(): number {
    let result = 0
    for (let i = 0; i < 100000000; i++) {
        result += i * i
    }
    return result
}

function middleFunctionB(): number {
    return innerFunctionB1()
}

function outerFunction(): number {
    console.log('Outer function started')
    let totalResult = 0

    for (let i = 0; i < 3; i++) {
        totalResult += middleFunctionA()
        // Simulate some delay
        const start = Date.now()
        while (Date.now() - start < 50) {
            // Busy wait for 50ms
        }
        totalResult += middleFunctionB()
    }

    for (let i = 0; i < 2; i++) {
        totalResult += middleFunctionA()
    }

    console.log('Outer function finished')
    return totalResult
}

// Fibonacci calculation (recursive)
function fibonacci(n: number): number {
    if (n <= 1) return n
    return fibonacci(n - 1) + fibonacci(n - 2)
}

// Prime number calculation
function calculatePrimes(limit: number): number[] {
    const primes: number[] = []
    for (let i = 2; i <= limit; i++) {
        let isPrime = true
        for (let j = 2; j <= Math.sqrt(i); j++) {
            if (i % j === 0) {
                isPrime = false
                break
            }
        }
        if (isPrime) primes.push(i)
    }
    return primes
}

export function CpuIntensiveComponent() {
    const [result, setResult] = useState<number | null>(null)
    const [fibResult, setFibResult] = useState<number | null>(null)
    const [primes, setPrimes] = useState<number[]>([])
    const [isCalculating, setIsCalculating] = useState(false)
    const [operation, setOperation] = useState<string>('')

    const runNestedOperations = useCallback(() => {
        setIsCalculating(true)
        setOperation('Nested CPU Operations')

        // Use setTimeout to prevent blocking the UI completely
        setTimeout(() => {
            const start = performance.now()
            const result = outerFunction()
            const end = performance.now()

            console.log(`Nested operations took ${end - start} milliseconds`)
            setResult(result)
            setIsCalculating(false)
        }, 10)
    }, [])

    const runFibonacci = useCallback(() => {
        setIsCalculating(true)
        setOperation('Fibonacci Calculation')

        setTimeout(() => {
            const start = performance.now()
            const result = fibonacci(40)
            const end = performance.now()

            console.log(`Fibonacci took ${end - start} milliseconds`)
            setFibResult(result)
            setIsCalculating(false)
        }, 10)
    }, [])

    const runPrimeCalculation = useCallback(() => {
        setIsCalculating(true)
        setOperation('Prime Number Calculation')

        setTimeout(() => {
            const start = performance.now()
            const primes = calculatePrimes(100000)
            const end = performance.now()

            console.log(`Prime calculation took ${end - start} milliseconds`)
            setPrimes(primes)
            setIsCalculating(false)
        }, 10)
    }, [])

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
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            disabled: {
                backgroundColor: '#6c757d',
                cursor: 'not-allowed',
            },
        },
        result: {
            padding: '15px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '5px',
            marginTop: '10px',
        },
        loading: {
            padding: '15px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '5px',
            marginTop: '10px',
        },
        warning: {
            padding: '10px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '5px',
            marginBottom: '20px',
            color: '#721c24',
        },
    }

    return (
        <div style={styles.container}>
            <h2>CPU Intensive Operations</h2>

            <div style={styles.controls}>
                <button
                    style={{
                        ...styles.button,
                        ...(isCalculating ? styles.button.disabled : {})
                    }}
                    onClick={runNestedOperations}
                    disabled={isCalculating}
                >
                    Run Nested Operations
                </button>
                <button
                    style={{
                        ...styles.button,
                        ...(isCalculating ? styles.button.disabled : {})
                    }}
                    onClick={runFibonacci}
                    disabled={isCalculating}
                >
                    Calculate Fibonacci(40)
                </button>
                <button
                    style={{
                        ...styles.button,
                        ...(isCalculating ? styles.button.disabled : {})
                    }}
                    onClick={runPrimeCalculation}
                    disabled={isCalculating}
                >
                    Find Primes up to 100,000
                </button>
            </div>

            {isCalculating && (
                <div style={styles.loading}>
                    🔄 Running {operation}... This may take a while.
                </div>
            )}

            {result !== null && (
                <div style={styles.result}>
                    <strong>Nested Operations Result:</strong> {result.toLocaleString()}
                </div>
            )}

            {fibResult !== null && (
                <div style={styles.result}>
                    <strong>Fibonacci(40) Result:</strong> {fibResult.toLocaleString()}
                </div>
            )}

            {primes.length > 0 && (
                <div style={styles.result}>
                    <strong>Prime Numbers Found:</strong> {primes.length.toLocaleString()} primes
                    <br />
                    <strong>First 10:</strong> {primes.slice(0, 10).join(', ')}
                    <br />
                    <strong>Last 10:</strong> {primes.slice(-10).join(', ')}
                </div>
            )}
        </div>
    )
} 