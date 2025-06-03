import React, { useState, useCallback, useEffect } from 'react'

interface LargeObject {
    id: number
    data: number[]
    metadata: {
        timestamp: number
        description: string
        nested: {
            values: number[]
            strings: string[]
        }
    }
}

export function MemoryHeavyComponent() {
    const [objects, setObjects] = useState<LargeObject[]>([])
    const [isAllocating, setIsAllocating] = useState(false)
    const [memoryStats, setMemoryStats] = useState<string>('')

    const createLargeObject = (id: number): LargeObject => {
        return {
            id,
            data: Array.from({ length: 10000 }, () => Math.random() * 1000),
            metadata: {
                timestamp: Date.now(),
                description: `Large object #${id} with lots of data`.repeat(10),
                nested: {
                    values: Array.from({ length: 5000 }, () => Math.random()),
                    strings: Array.from({ length: 1000 }, (_, i) => `String data item ${i} - ${Math.random().toString(36)}`),
                }
            }
        }
    }

    const allocateMemory = useCallback((count: number) => {
        setIsAllocating(true)

        // Allocate memory in chunks to see the progression
        const batchSize = 50
        let allocated = 0

        const allocateBatch = () => {
            const batch: LargeObject[] = []
            const remaining = Math.min(batchSize, count - allocated)

            for (let i = 0; i < remaining; i++) {
                batch.push(createLargeObject(allocated + i))
            }

            setObjects(prev => [...prev, ...batch])
            allocated += remaining

            if (allocated < count) {
                setTimeout(allocateBatch, 10) // Small delay to see progress
            } else {
                setIsAllocating(false)
            }
        }

        allocateBatch()
    }, [])

    const clearMemory = useCallback(() => {
        setObjects([])
        // Force garbage collection hint (doesn't actually force it)
        if (window.gc) {
            window.gc()
        }
    }, [])

    const createMemoryLeak = useCallback(() => {
        // Create circular references
        const leakyObjects: any[] = []

        for (let i = 0; i < 1000; i++) {
            const obj: any = {
                id: i,
                data: new Array(1000).fill(Math.random()),
                circular: null,
            }
            obj.circular = obj // Circular reference
            leakyObjects.push(obj)
        }

        // Store in a way that creates potential memory leaks
        (window as any).leakyGlobal = leakyObjects

        console.log('Created potential memory leak with circular references')
    }, [])

    // Monitor memory usage
    useEffect(() => {
        const updateMemoryStats = () => {
            if ('memory' in performance) {
                const memory = (performance as any).memory
                setMemoryStats(
                    `Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB, ` +
                    `Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB, ` +
                    `Limit: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`
                )
            } else {
                setMemoryStats('Memory API not available in this browser')
            }
        }

        updateMemoryStats()
        const interval = setInterval(updateMemoryStats, 1000)
        return () => clearInterval(interval)
    }, [objects])

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
            backgroundColor: '#6f42c1',
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
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
        },
        stats: {
            padding: '15px',
            backgroundColor: '#e9ecef',
            border: '1px solid #dee2e6',
            borderRadius: '5px',
            marginBottom: '20px',
            fontFamily: 'monospace',
        },
        warning: {
            padding: '10px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '5px',
            marginBottom: '20px',
            color: '#721c24',
        },
        objectList: {
            maxHeight: '300px',
            overflowY: 'auto' as const,
            border: '1px solid #dee2e6',
            borderRadius: '5px',
            padding: '10px',
            backgroundColor: '#f8f9fa',
        },
        objectItem: {
            padding: '5px',
            marginBottom: '5px',
            backgroundColor: 'white',
            borderRadius: '3px',
            fontSize: '0.9em',
        },
    }

    return (
        <div style={styles.container}>
            <h2>Memory Operations</h2>

            <div style={styles.stats}>
                <strong>Memory Stats:</strong> {memoryStats}
                <br />
                <strong>Objects Allocated:</strong> {objects.length.toLocaleString()}
                <br />
                <strong>Status:</strong> {isAllocating ? 'Allocating...' : 'Idle'}
            </div>

            <div style={styles.controls}>
                <button
                    style={styles.button}
                    onClick={() => allocateMemory(100)}
                    disabled={isAllocating}
                >
                    Allocate 100 Objects
                </button>
                <button
                    style={styles.button}
                    onClick={() => allocateMemory(500)}
                    disabled={isAllocating}
                >
                    Allocate 500 Objects
                </button>
                <button
                    style={styles.dangerButton}
                    onClick={() => allocateMemory(2000)}
                    disabled={isAllocating}
                >
                    Allocate 2000 Objects
                </button>
                <button
                    style={styles.dangerButton}
                    onClick={createMemoryLeak}
                >
                    Create Memory Leak
                </button>
                <button
                    style={styles.clearButton}
                    onClick={clearMemory}
                >
                    Clear All Memory
                </button>
            </div>

            {objects.length > 0 && (
                <div style={styles.objectList}>
                    <h4>Allocated Objects (showing first 20):</h4>
                    {objects.slice(0, 20).map(obj => (
                        <div key={obj.id} style={styles.objectItem}>
                            Object #{obj.id}: {obj.data.length} data points, {obj.metadata.nested.strings.length} strings
                        </div>
                    ))}
                    {objects.length > 20 && (
                        <div style={styles.objectItem}>
                            ... and {objects.length - 20} more objects
                        </div>
                    )}
                </div>
            )}
        </div>
    )
} 