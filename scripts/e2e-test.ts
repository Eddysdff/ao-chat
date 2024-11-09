import { testConfig } from './test-config';
import { AOProcess } from '@/lib/ao-process';
import Arweave from 'arweave';
import fs from 'fs';

class E2ETest {
  private arweave: Arweave;
  private testResults: any = {};

  constructor() {
    this.arweave = Arweave.init(testConfig.arweave);
  }

  async runTests() {
    console.log('Starting E2E Tests...\n');
    
    try {
      // 1. 测试Arweave连接
      await this.testArweaveConnection();

      // 2. 测试AO Process部署
      await this.testProcessDeployment();

      // 3. 测试用户功能
      await this.testUserFeatures();

      // 4. 测试聊天功能
      await this.testChatFeatures();

      // 5. 测试视频通话功能
      await this.testVideoCallFeatures();

      // 6. 测试静态资源部署
      await this.testStaticDeployment();

      this.logTestResults();
    } catch (error) {
      console.error('Tests failed:', error);
      process.exit(1);
    }
  }

  private async testArweaveConnection() {
    console.log('Testing Arweave Connection...');
    try {
      const networkInfo = await this.arweave.network.getInfo();
      this.testResults.arweave = {
        status: 'success',
        networkInfo
      };
      console.log('✅ Arweave connection successful');
    } catch (error) {
      this.testResults.arweave = {
        status: 'failed',
        error
      };
      throw error;
    }
  }

  private async testProcessDeployment() {
    console.log('\nTesting AO Process Deployment...');
    try {
      // 读取Process代码
      const processCode = fs.readFileSync('./process/chat.lua', 'utf8');
      
      // 部署Process
      const result = await AOProcess.deploy(processCode);
      
      // 验证Process
      const isHealthy = await AOProcess.checkHealth(result.processId);
      
      this.testResults.processDeployment = {
        status: 'success',
        processId: result.processId,
        health: isHealthy
      };
      
      console.log('✅ Process deployment successful');
      return result.processId;
    } catch (error) {
      this.testResults.processDeployment = {
        status: 'failed',
        error
      };
      throw error;
    }
  }

  private async testUserFeatures() {
    console.log('\nTesting User Features...');
    try {
      const { user1, user2 } = testConfig.testUsers;
      
      // 测试用户1添加用户2为联系人
      const inviteResult = await AOProcess.sendInvitation(
        user2.walletPath,
        'Test Contact'
      );
      
      // 测试用户2接受邀请
      const acceptResult = await AOProcess.acceptInvitation(
        user1.walletPath,
        'Test User 1'
      );
      
      this.testResults.userFeatures = {
        status: 'success',
        invitation: inviteResult,
        acceptance: acceptResult
      };
      
      console.log('✅ User features test successful');
    } catch (error) {
      this.testResults.userFeatures = {
        status: 'failed',
        error
      };
      throw error;
    }
  }

  private async testChatFeatures() {
    console.log('\nTesting Chat Features...');
    try {
      const { user1, user2 } = testConfig.testUsers;
      
      // 创建聊天室
      const chatroom = await AOProcess.createChatroom(user2.walletPath);
      
      // 发送测试消息
      const messageResult = await AOProcess.sendChatroomMessage(
        chatroom.processId,
        'Test message'
      );
      
      // 获取消息
      const messages = await AOProcess.getChatroomMessages(chatroom.processId);
      
      this.testResults.chatFeatures = {
        status: 'success',
        chatroom,
        messageResult,
        messages
      };
      
      console.log('✅ Chat features test successful');
    } catch (error) {
      this.testResults.chatFeatures = {
        status: 'failed',
        error
      };
      throw error;
    }
  }

  private async testVideoCallFeatures() {
    console.log('\nTesting Video Call Features...');
    try {
      // 测试WebRTC连接
      const webrtcResult = await this.testWebRTCConnection();
      
      this.testResults.videoCallFeatures = {
        status: 'success',
        webrtc: webrtcResult
      };
      
      console.log('✅ Video call features test successful');
    } catch (error) {
      this.testResults.videoCallFeatures = {
        status: 'failed',
        error
      };
      throw error;
    }
  }

  private async testStaticDeployment() {
    console.log('\nTesting Static Resource Deployment...');
    try {
      // 构建项目
      await this.buildProject();
      
      // 部署测试文件
      const testFile = {
        data: 'Test content',
        tags: [{ name: 'Content-Type', value: 'text/plain' }]
      };
      
      const tx = await this.arweave.createTransaction(testFile);
      await this.arweave.transactions.sign(tx);
      await this.arweave.transactions.post(tx);
      
      this.testResults.staticDeployment = {
        status: 'success',
        testTxId: tx.id
      };
      
      console.log('✅ Static deployment test successful');
    } catch (error) {
      this.testResults.staticDeployment = {
        status: 'failed',
        error
      };
      throw error;
    }
  }

  private async buildProject() {
    console.log('Building project...');
    const { execSync } = require('child_process');
    execSync('npm run build', { stdio: 'inherit' });
  }

  private async testWebRTCConnection() {
    // 模拟WebRTC连接测试
    return new Promise((resolve) => {
      const pc1 = new RTCPeerConnection();
      const pc2 = new RTCPeerConnection();
      
      pc1.onicecandidate = e => e.candidate && pc2.addIceCandidate(e.candidate);
      pc2.onicecandidate = e => e.candidate && pc1.addIceCandidate(e.candidate);
      
      pc1.oniceconnectionstatechange = () => {
        if (pc1.iceConnectionState === 'connected') {
          resolve({ status: 'connected' });
        }
      };
      
      // 创建数据通道
      const dc = pc1.createDataChannel('test');
      dc.onopen = () => resolve({ status: 'success' });
      
      // 建立连接
      pc1.createOffer()
        .then(offer => pc1.setLocalDescription(offer))
        .then(() => pc2.setRemoteDescription(pc1.localDescription!))
        .then(() => pc2.createAnswer())
        .then(answer => pc2.setLocalDescription(answer))
        .then(() => pc1.setRemoteDescription(pc2.localDescription!));
    });
  }

  private logTestResults() {
    console.log('\n=== Test Results ===');
    Object.entries(this.testResults).forEach(([test, result]) => {
      console.log(`\n${test}:`);
      console.log(JSON.stringify(result, null, 2));
    });
  }
}

// 运行测试
new E2ETest().runTests().catch(console.error); 