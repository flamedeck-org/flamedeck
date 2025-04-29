import { useState, useEffect, useRef, useCallback } from 'react';

// Replace with your actual Supabase project URL and anon key
// IMPORTANT: Use wss:// for deployed functions, ws:// for local development
const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL;
// Construct WebSocket URL from the project URL
// Example: https://jczffinsulwdzhgzggcj.supabase.co -> wss://jczffinsulwdzhgzggcj.supabase.co
const WS_URL = SUPABASE_PROJECT_URL
    ? SUPABASE_PROJECT_URL.replace(/^http/, 'ws') + '/functions/v1/trace-analysis-socket'
    : 'ws://127.0.0.1:54321/functions/v1/trace-analysis-socket'; // Fallback for local dev

interface SocketMessage {
    type: string;
    payload?: any;
    message?: string; // For connection_ack
}

export function useTraceAnalysisSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<SocketMessage | null>(null);
    const [error, setError] = useState<Event | Error | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    const connect = useCallback(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected.');
            return;
        }
        console.log(`Attempting to connect to WebSocket at: ${WS_URL}`);
        setError(null); // Clear previous errors
        socketRef.current = new WebSocket(WS_URL);

        socketRef.current.onopen = () => {
            console.log('WebSocket connection established');
            setIsConnected(true);
            setError(null);
        };

        socketRef.current.onmessage = (event) => {
            try {
                const message: SocketMessage = JSON.parse(event.data);
                console.log('WebSocket message received:', message);
                setLastMessage(message);
            } catch (e) {
                console.error('Failed to parse WebSocket message:', event.data, e);
                setLastMessage({ type: 'parse_error', payload: event.data });
            }
        };

        socketRef.current.onerror = (event) => {
            console.error('WebSocket error:', event);
            setError(event);
            setIsConnected(false);
            // Attempt to reconnect or notify user? For now, just log.
        };

        socketRef.current.onclose = (event) => {
            console.log('WebSocket connection closed:', event.code, event.reason);
            setIsConnected(false);
            socketRef.current = null;
            // Optionally implement automatic reconnection logic here
            if (!event.wasClean) {
                console.warn('WebSocket connection closed unexpectedly.');
                setError(event);
            }
        };

    }, []); // Empty dependency array ensures connect function is stable

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            console.log('Closing WebSocket connection');
            socketRef.current.close(1000, 'User requested disconnect'); // 1000 is normal closure
            // State updates (isConnected=false, etc.) are handled by the onclose handler
        }
    }, []);

    const sendMessage = useCallback((message: string | object) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            const messageToSend = typeof message === 'string' ? message : JSON.stringify(message);
            console.log('Sending WebSocket message:', messageToSend);
            socketRef.current.send(messageToSend);
        } else {
            console.error('WebSocket is not connected. Cannot send message.');
            setError(new Error('WebSocket is not connected. Cannot send message.'));
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        connect,
        disconnect,
        sendMessage,
        isConnected,
        lastMessage,
        error,
    };
} 