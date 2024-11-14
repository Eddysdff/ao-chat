import { ArLocal } from 'arlocal';
import Arweave from 'arweave';

async function startTestEnvironment() {
  try {
    // 启动本地 Arweave 节点
    const arlocal = new ArLocal(1984);
    await arlocal.start();
    console.log('ArLocal started on port 1984');

    // 初始化 Arweave 客户端
    const arweave = Arweave.init({
      host: 'localhost',
      port: 1984,
      protocol: 'http'
    });

    // 生成测试钱包
    const wallet = await arweave.wallets.generate();
    const address = await arweave.wallets.jwkToAddress(wallet);
    console.log('Test wallet generated:', address);

    // 保持进程运行
    process.on('SIGINT', async () => {
      console.log('Stopping ArLocal...');
      await arlocal.stop();
      process.exit();
    });

  } catch (error) {
    console.error('Failed to start test environment:', error);
    process.exit(1);
  }
}

startTestEnvironment();
