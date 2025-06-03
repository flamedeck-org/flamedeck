import React, { useState, useCallback, useRef, useEffect } from 'react'

export function DomManipulationComponent() {
    const [isAnimating, setIsAnimating] = useState(false)
    const [elementCount, setElementCount] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const animationFrameRef = useRef<number>()

    const createDomElements = useCallback((count: number) => {
        if (!containerRef.current) return

        // Clear existing elements
        containerRef.current.innerHTML = ''

        for (let i = 0; i < count; i++) {
            const element = document.createElement('div')
            element.className = 'dom-element'
            element.style.cssText = `
        width: ${20 + Math.random() * 100}px;
        height: ${20 + Math.random() * 100}px;
        background-color: hsl(${Math.random() * 360}, 70%, 60%);
        position: absolute;
        left: ${Math.random() * 800}px;
        top: ${Math.random() * 400}px;
        border-radius: 50%;
        transition: all 0.3s ease;
      `
            element.textContent = `${i}`
            containerRef.current.appendChild(element)
        }
        setElementCount(count)
    }, [])

    const animateElements = useCallback(() => {
        if (!containerRef.current) return

        const elements = containerRef.current.children
        let frame = 0

        const animate = () => {
            // Read and write layout properties
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i] as HTMLElement

                // Read layout properties
                const rect = element.getBoundingClientRect()
                const computedStyle = getComputedStyle(element)

                // Write layout properties
                element.style.left = `${parseFloat(element.style.left) + Math.sin(frame * 0.1 + i) * 2}px`
                element.style.top = `${parseFloat(element.style.top) + Math.cos(frame * 0.1 + i) * 2}px`
                element.style.transform = `rotate(${frame + i * 10}deg) scale(${1 + Math.sin(frame * 0.05) * 0.2})`

                // Apply visual effects
                element.style.boxShadow = `${Math.sin(frame * 0.1) * 10}px ${Math.cos(frame * 0.1) * 10}px 20px rgba(0,0,0,0.3)`
            }

            frame++
            if (isAnimating) {
                animationFrameRef.current = requestAnimationFrame(animate)
            }
        }

        if (isAnimating) {
            animate()
        }
    }, [isAnimating])

    const startAnimation = useCallback(() => {
        setIsAnimating(true)
    }, [])

    const stopAnimation = useCallback(() => {
        setIsAnimating(false)
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
        }
    }, [])

    const massiveDomOperation = useCallback(() => {
        if (!containerRef.current) return

        // Create and remove many elements rapidly
        for (let cycle = 0; cycle < 100; cycle++) {
            setTimeout(() => {
                if (!containerRef.current) return

                // Add many elements
                for (let i = 0; i < 50; i++) {
                    const element = document.createElement('div')
                    element.style.cssText = `
            width: 10px;
            height: 10px;
            background: red;
            position: absolute;
            left: ${Math.random() * 500}px;
            top: ${Math.random() * 300}px;
          `
                    containerRef.current.appendChild(element)
                }

                // Remove half of them
                setTimeout(() => {
                    if (!containerRef.current) return
                    const children = Array.from(containerRef.current.children)
                    children.slice(-25).forEach(child => child.remove())
                }, 10)
            }, cycle * 20)
        }
    }, [])

    useEffect(() => {
        animateElements()
    }, [animateElements])

    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
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
            backgroundColor: '#fd7e14',
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
        stopButton: {
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
        },
        domContainer: {
            position: 'relative' as const,
            width: '100%',
            height: '500px',
            border: '2px solid #dee2e6',
            borderRadius: '5px',
            overflow: 'hidden',
            backgroundColor: '#f8f9fa',
        },
        stats: {
            padding: '10px',
            backgroundColor: '#e9ecef',
            borderRadius: '5px',
            marginBottom: '10px',
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
            <h2>DOM Manipulation & Animation</h2>

            <div style={styles.stats}>
                <strong>DOM Elements:</strong> {elementCount}
                <br />
                <strong>Animation Status:</strong> {isAnimating ? 'Running' : 'Stopped'}
            </div>

            <div style={styles.controls}>
                <button
                    style={styles.button}
                    onClick={() => createDomElements(50)}
                >
                    Create 50 Elements
                </button>
                <button
                    style={styles.button}
                    onClick={() => createDomElements(200)}
                >
                    Create 200 Elements
                </button>
                <button
                    style={styles.dangerButton}
                    onClick={() => createDomElements(500)}
                >
                    Create 500 Elements
                </button>
                {!isAnimating ? (
                    <button
                        style={styles.button}
                        onClick={startAnimation}
                        disabled={elementCount === 0}
                    >
                        Start Animation
                    </button>
                ) : (
                    <button
                        style={styles.stopButton}
                        onClick={stopAnimation}
                    >
                        Stop Animation
                    </button>
                )}
                <button
                    style={styles.dangerButton}
                    onClick={massiveDomOperation}
                >
                    Massive DOM Operations
                </button>
            </div>

            <div ref={containerRef} style={styles.domContainer}>
                {elementCount === 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: '#6c757d',
                        fontSize: '1.2em'
                    }}>
                        Click "Create Elements" to start
                    </div>
                )}
            </div>
        </div>
    )
} 