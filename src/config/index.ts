export const config = {
  ao: {
    // 根据环境选择不同的endpoint
    endpoints: {
      development: {
        MU_URL: 'http://localhost:4943',
        CU_URL: 'http://localhost:4942',
      },
      production: {
        MU_URL: 'https://mu.ao-testnet.xyz',
        CU_URL: 'https://cu.ao-testnet.xyz',
      }
    },
    // Process ID 也可以根据环境配置
    processId: {
      development: 'local-process-id', // 本地测试时的Process ID
      production: 'your-production-process-id'
    }
  }
};
