import ArLocal from 'arlocal';
import { exec } from 'child_process';

async function startTestEnvironment() {
  // 启动 ArLocal
  const arlocal = new ArLocal(1984, false);
  await arlocal.start();
  console.log('ArLocal started on port 1984');

  // 启动 AO 节点
  exec('aos node', (error, stdout, stderr) => {
    if (error) {
      console.error('Error starting AO node:', error);
      return;
    }
    console.log('AO node output:', stdout);
  });
}

startTestEnvironment().catch(console.error);
