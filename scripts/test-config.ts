export const testConfig = {
  // AO testnet 配置
  ao: {
    muUrl: 'https://mu.ao-testnet.xyz',
    cuUrl: 'https://cu.ao-testnet.xyz'
  },
  
  // Arweave testnet 配置
  arweave: {
    host: 'testnet.redstone.tools',
    port: 443,
    protocol: 'https'
  },
  
  // 测试用户配置
  testUsers: {
    user1: {
      walletPath: './test/wallets/user1.json',
      name: 'Test User 1'
    },
    user2: {
      walletPath: './test/wallets/user2.json',
      name: 'Test User 2'
    }
  }
}; 