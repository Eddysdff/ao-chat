import { Libp2pClient } from './libp2p-client';

// 连接策略接口
export interface ConnectionStrategy {
  initialize(): Promise<void>;
  createConnection(targetPeerId: string): Promise<RTCPeerConnection>;
  cleanup(): Promise<void>;
  getConnectionInfo(): string;
}

// Libp2p策略
export class Libp2pStrategy implements ConnectionStrategy {
  private libp2pClient: Libp2pClient;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    this.libp2pClient = new Libp2pClient();
  }

  async initialize(): Promise<void> {
    try {
      await this.libp2pClient.initialize();
    } catch (error) {
      console.error('Failed to initialize Libp2p:', error);
      throw error;
    }
  }

  async createConnection(targetPeerId: string): Promise<RTCPeerConnection> {
    for (let i = 0; i < this.retryAttempts; i++) {
      try {
        return await this.libp2pClient.createWebRTCConnection(targetPeerId);
      } catch (error) {
        if (i === this.retryAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, i)));
      }
    }
    throw new Error('Failed to create Libp2p connection after retries');
  }

  async cleanup(): Promise<void> {
    await this.libp2pClient.close();
  }

  getConnectionInfo(): string {
    return 'libp2p';
  }
}

// STUN策略（备选方案）
export class StunStrategy implements ConnectionStrategy {
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  private retryAttempts = 3;
  private retryDelay = 1000;

  async initialize(): Promise<void> {
    // STUN不需要特别的初始化
  }

  async createConnection(): Promise<RTCPeerConnection> {
    for (let i = 0; i < this.retryAttempts; i++) {
      try {
        const connection = new RTCPeerConnection(this.configuration);
        
        // 添加连接状态监控
        connection.onconnectionstatechange = () => {
          console.log('STUN Connection state:', connection.connectionState);
        };

        return connection;
      } catch (error) {
        if (i === this.retryAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, i)));
      }
    }
    throw new Error('Failed to create STUN connection after retries');
  }

  async cleanup(): Promise<void> {
    // STUN不需要特别的清理
  }

  getConnectionInfo(): string {
    return 'stun';
  }
}
