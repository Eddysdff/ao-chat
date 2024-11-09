import { ConnectionManager } from './p2p/connection-manager';

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private connectionManager: ConnectionManager;

  constructor() {
    this.connectionManager = new ConnectionManager();
  }

  async initLocalStream(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  async initConnection(targetPeerId: string, onTrack: (stream: MediaStream) => void): Promise<void> {
    try {
      // 创建连接（会自动选择合适的策略）
      this.peerConnection = await this.connectionManager.createConnection(targetPeerId);

      // 添加本地流
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.localStream && this.peerConnection) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }

      // 处理远程流
      this.peerConnection.ontrack = (event) => {
        onTrack(event.streams[0]);
      };

      // 添加连接状态监控
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection?.connectionState);
        if (this.peerConnection?.connectionState === 'failed') {
          // 可以在这里添加重试逻辑
          console.warn('Connection failed, might need to retry');
        }
      };
    } catch (error) {
      console.error('Failed to initialize connection:', error);
      throw error;
    }
  }

  // 获取当前使用的连接策略
  getConnectionStrategy(): string {
    return this.connectionManager.getCurrentStrategy();
  }

  // 创建提议
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  // 处理接收到的提议
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  // 处理接收到的应答
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  // 处理ICE候选
  async handleCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  // 获取ICE候选事件处理器
  onIceCandidate(handler: (candidate: RTCIceCandidate | null) => void): void {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    this.peerConnection.onicecandidate = (event) => {
      handler(event.candidate);
    };
  }

  // 关闭连接
  close(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  // 控制音频
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  // 控制视频
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }
} 