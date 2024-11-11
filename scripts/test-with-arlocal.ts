import { AOProcess } from '../src/lib/ao-process';
import Arweave from 'arweave';

async function runTests() {
  console.log('Starting tests with ArLocal + AO...');

  // 初始化 Arweave 客户端
  const arweave = Arweave.init({
    host: 'localhost',
    port: 1984,
    protocol: 'http'
  });

  try {
    // 1. 测试 Arweave 连接
    console.log('Testing Arweave connection...');
    const networkInfo = await arweave.network.getInfo();
    console.log('Arweave network info:', networkInfo);

    // 2. 测试 AO Process 部署
    console.log('\nDeploying test process...');
    // 部署过程...

    // 3. 测试联系人功能
    console.log('\nTesting contact features...');
    const invitation = await AOProcess.sendInvitation(
      'test-address',
      'Test User'
    );
    console.log('Invitation result:', invitation);

    // 4. 测试聊天室功能
    console.log('\nTesting chat features...');
    const chatroom = await AOProcess.createChatroom('test-address');
    console.log('Chatroom result:', chatroom);

    // 5. 测试消息功能
    if (chatroom.success && chatroom.processId) {
      console.log('\nTesting message features...');
      const message = await AOProcess.sendChatroomMessage(
        chatroom.processId,
        'Test message'
      );
      console.log('Message result:', message);
    }

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTests();
