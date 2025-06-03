import { useState, useMemo } from 'react'
import { ListComponent } from './components/ListComponent'
import { CpuIntensiveComponent } from './components/CpuIntensiveComponent'
import { MemoryHeavyComponent } from './components/MemoryHeavyComponent'
import { DomManipulationComponent } from './components/DomManipulationComponent'
import { AsyncOperationsComponent } from './components/AsyncOperationsComponent'

function App() {
    const [activeTab, setActiveTab] = useState('list')
    const [triggerOperation, setTriggerOperation] = useState(0)

    // Computation on every render
    const computedValue = useMemo(() => {
        console.log('Computing value...')
        let result = 0
        for (let i = 0; i < 1000000; i++) {
            result += Math.sin(i) * Math.cos(i)
        }
        return result
    }, [triggerOperation])

    const tabs = [
        { id: 'list', label: 'List Rendering' },
        { id: 'cpu', label: 'CPU Intensive' },
        { id: 'memory', label: 'Memory Heavy' },
        { id: 'dom', label: 'DOM Manipulation' },
        { id: 'async', label: 'Async Operations' },
    ]

    const styles = {
        container: {
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '20px',
        },
        header: {
            marginBottom: '30px',
            textAlign: 'center' as const,
        },
        title: {
            fontSize: '2.5rem',
            color: '#333',
            marginBottom: '10px',
        },
        subtitle: {
            fontSize: '1.2rem',
            color: '#666',
            marginBottom: '20px',
        },
        computedValue: {
            padding: '10px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '5px',
            marginBottom: '20px',
        },
        tabs: {
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            flexWrap: 'wrap' as const,
        },
        tab: {
            padding: '10px 20px',
            border: '2px solid #ddd',
            borderRadius: '5px',
            backgroundColor: '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s',
        },
        activeTab: {
            backgroundColor: '#007bff',
            color: 'white',
            borderColor: '#007bff',
        },
        triggerButton: {
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginLeft: '10px',
        },
        content: {
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        },
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>⚛️ React App</h1>
                <p style={styles.subtitle}>
                    A React app demonstrating various computational patterns
                </p>
                <div style={styles.computedValue}>
                    <strong>Computation result:</strong> {computedValue.toFixed(6)}
                    <button
                        style={styles.triggerButton}
                        onClick={() => setTriggerOperation(prev => prev + 1)}
                    >
                        Recalculate
                    </button>
                </div>
            </div>

            <div style={styles.tabs}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        style={{
                            ...styles.tab,
                            ...(activeTab === tab.id ? styles.activeTab : {})
                        }}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={styles.content}>
                {activeTab === 'list' && <ListComponent />}
                {activeTab === 'cpu' && <CpuIntensiveComponent />}
                {activeTab === 'memory' && <MemoryHeavyComponent />}
                {activeTab === 'dom' && <DomManipulationComponent />}
                {activeTab === 'async' && <AsyncOperationsComponent />}
            </div>
        </div>
    )
}

export default App 