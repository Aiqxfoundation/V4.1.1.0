import { useEffect, useRef, useState, useCallback } from 'react';
import { queryClient } from '@/lib/queryClient';

interface BlockUpdate {
  blockHeight: number;
  totalReward: string;
  totalHashPower: string;
  activeMiners: number;
  nextBlockTime: string;
  globalHashrate: string;
}

interface UserMiningUpdate {
  userId: string;
  personalBlockHeight: number;
  unclaimedRewards: string;
  hashPower: string;
  blocksParticipated: number;
  lastReward: string;
  miningActive: boolean;
  blocksUntilSuspension: number;
  unclaimedBlocksCount: number;
  miningSuspended: boolean;
}

interface WebSocketMessage {
  type: 'block_update' | 'user_mining_update' | 'connection' | 'error';
  timestamp: string;
  data: any;
}

export function useMiningWebSocket(userId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastBlock, setLastBlock] = useState<BlockUpdate | null>(null);
  const [userStats, setUserStats] = useState<UserMiningUpdate | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!userId) return;
    
    // Clear any existing connection
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.close();
    }

    // Determine WebSocket URL based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    const port = window.location.port || (protocol === 'wss' ? '443' : '80');
    
    // In development, connect to localhost:8080
    // In production (Replit), use the same host but port 8080
    let wsUrl: string;
    if (host === 'localhost' || host === '127.0.0.1') {
      wsUrl = 'ws://localhost:8080/api/ws';
    } else {
      // For Replit environment - use the public URL
      wsUrl = `${protocol}://${host}:${port}/api/ws`;
      // Try direct connection to Go backend on port 8080
      if (import.meta.env.VITE_API_URL) {
        const apiUrl = import.meta.env.VITE_API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
        wsUrl = `${apiUrl}/api/ws`;
      } else {
        // Fallback to proxied WebSocket through Express
        wsUrl = `${protocol}://${host}:${port}/api/ws`;
      }
    }

    // WebSocket connection established
    
    try {
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        // WebSocket connected successfully
        setIsConnected(true);
        setConnectionAttempts(0);
        
        // Send initial authentication/user info if needed
        if (userId) {
          ws.current?.send(JSON.stringify({
            type: 'auth',
            userId: userId
          }));
        }
      };
      
      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch(message.type) {
            case 'block_update':
              // Block update received and processed
              setLastBlock(message.data as BlockUpdate);
              
              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ['/api/mining/status'] });
              queryClient.invalidateQueries({ queryKey: ['/api/mining/unclaimed-blocks'] });
              queryClient.invalidateQueries({ queryKey: ['/api/supply-metrics'] });
              break;
              
            case 'user_mining_update':
              const update = message.data as UserMiningUpdate;
              if (update.userId === userId) {
                // User mining statistics updated
                setUserStats(update);
                
                // Invalidate user-specific queries
                queryClient.invalidateQueries({ queryKey: ['/api/user'] });
                queryClient.invalidateQueries({ queryKey: ['/api/mining/status'] });
                queryClient.invalidateQueries({ queryKey: ['/api/wallet/balances'] });
              }
              break;
              
            case 'connection':
              // Connection established successfully
              break;
              
            case 'error':
              console.error('WebSocket error message:', message.data);
              break;
              
            default:
              // Unknown message type ignored
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
      ws.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        
        // Implement exponential backoff for reconnection
        const attempts = connectionAttempts + 1;
        setConnectionAttempts(attempts);
        
        if (attempts < 10) { // Max 10 reconnection attempts
          const backoffTime = Math.min(1000 * Math.pow(2, attempts - 1), 30000); // Max 30 seconds
          console.log(`Reconnecting in ${backoffTime / 1000} seconds...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffTime);
        } else {
          console.error('Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setIsConnected(false);
    }
  }, [userId]);

  // Connect when component mounts or userId changes
  useEffect(() => {
    if (userId) {
      connect();
    }
    
    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [userId, connect]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    setConnectionAttempts(0);
    connect();
  }, [connect]);

  // Send message function
  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return { 
    isConnected, 
    lastBlock, 
    userStats, 
    reconnect,
    sendMessage,
    connectionAttempts 
  };
}