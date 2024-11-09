import { ConnectionStrategy, Libp2pStrategy, StunStrategy } from './connection-strategies';

export class ConnectionManager {
  private currentStrategy: ConnectionStrategy;
  private libp2pStrategy: Libp2pStrategy;
  private stunStrategy: StunStrategy;
  private connectionState: string = 'disconnected';

  constructor() {
    this.libp2pStrategy = new Libp2pStrategy();
    this.stunStrategy = new StunStrategy();
    this.currentStrategy = this.libp2pStrategy; // 默认使用libp2p
  }

  async createConnection(targetPeerId: string): Promise<RTCPeerConnection> {
    try {
      this.connectionState = 'connecting';
      // 首先尝试使用libp2p
      await this.currentStrategy.initialize();
      const connection = await this.currentStrategy.createConnection(targetPeerId);
      this.connectionState = 'connected';
      return connection;
    } catch (error) {
      console.warn('Libp2p connection failed, falling back to STUN:', error);
      
      // 切换到STUN策略
      this.currentStrategy = this.stunStrategy;
      try {
        await this.currentStrategy.initialize();
        const connection = await this.currentStrategy.createConnection(targetPeerId);
        this.connectionState = 'connected';
        return connection;
      } catch (fallbackError) {
        this.connectionState = 'failed';
        console.error('Both connection strategies failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.currentStrategy.cleanup();
      this.connectionState = 'disconnected';
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  }

  getCurrentStrategy(): string {
    return this.currentStrategy.getConnectionInfo();
  }

  getConnectionState(): string {
    return this.connectionState;
  }

  // 添加重连方法
  async reconnect(targetPeerId: string): Promise<RTCPeerConnection> {
    await this.cleanup();
    // 重置为默认策略
    this.currentStrategy = this.libp2pStrategy;
    return this.createConnection(targetPeerId);
  }
}
