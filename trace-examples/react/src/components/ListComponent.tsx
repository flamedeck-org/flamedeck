import React, { useState, useMemo } from 'react'

// List item component
function ListItem({ index, data }: { index: number; data: string }) {
    // Computation on every render
    const computedValue = useMemo(() => {
        let result = 0
        for (let i = 0; i < 10000; i++) {
            result += Math.random() * index
        }
        return result
    }, [index])

    const styles = {
        item: {
            padding: '15px',
            margin: '5px 0',
            backgroundColor: index % 2 === 0 ? '#f8f9fa' : '#ffffff',
            border: '1px solid #dee2e6',
            borderRadius: '5px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        content: {
            flex: 1,
        },
        computed: {
            fontSize: '0.8em',
            color: '#6c757d',
        },
    }

    return (
        <div style={styles.item}>
            <div style={styles.content}>
                <strong>Item #{index}</strong>
                <div>{data}</div>
            </div>
            <div style={styles.computed}>
                Computed: {computedValue.toFixed(2)}
            </div>
        </div>
    )
}

export function ListComponent() {
    const [itemCount, setItemCount] = useState(2000)
    const [triggerRerender, setTriggerRerender] = useState(0)

    // Generate a large amount of data
    const listData = useMemo(() => {
        console.log('Generating list data...')
        return Array.from({ length: itemCount }, (_, i) =>
            `This is item number ${i} with some long text content. ${triggerRerender}`
        )
    }, [itemCount, triggerRerender])

    const styles = {
        container: {
            padding: '20px',
        },
        controls: {
            marginBottom: '20px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap' as const,
        },
        input: {
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            width: '80px',
        },
        button: {
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
        },
        dangerButton: {
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
        },
        list: {
            maxHeight: '600px',
            overflowY: 'auto' as const,
            border: '1px solid #ddd',
            borderRadius: '5px',
            padding: '10px',
        },
        warning: {
            padding: '10px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '5px',
            marginBottom: '10px',
        },
    }

    return (
        <div style={styles.container}>
            <h2>List Rendering</h2>

            <div style={styles.controls}>
                <label>
                    Item Count:
                    <input
                        type="number"
                        value={itemCount}
                        onChange={(e) => setItemCount(Number(e.target.value))}
                        style={styles.input}
                        min="1"
                        max="2000"
                    />
                </label>
                <button
                    style={styles.button}
                    onClick={() => setItemCount(1000)}
                >
                    Set to 1000
                </button>
                <button
                    style={styles.dangerButton}
                    onClick={() => setTriggerRerender(prev => prev + 1)}
                >
                    Force Re-render
                </button>
            </div>

            <div style={styles.list}>
                {listData.map((data, index) => (
                    <ListItem key={`${index}-${triggerRerender}`} index={index} data={data} />
                ))}
            </div>
        </div>
    )
} 