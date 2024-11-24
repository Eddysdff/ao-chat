export const config = {
  ao: {
    endpoints: {
      development: {
        MU_URL: 'https://mu.ao-testnet.xyz',
        CU_URL: 'https://cu.ao-testnet.xyz',
      },
      production: {
        MU_URL: 'https://mu.ao-testnet.xyz',
        CU_URL: 'https://cu.ao-testnet.xyz',
      }
    },
    processId: {
      development: 'JNVwEduEF5CYA1J8aOEdZqcFXgonM7ax2j2NPcO4gys',
      production: 'JNVwEduEF5CYA1J8aOEdZqcFXgonM7ax2j2NPcO4gys'
    }
  },
  arweave: {
    endpoints: {
      development: 'https://arweave.net',
      production: 'https://arweave.net'
    }
  },
};

// 获取当前环境
const getEnvironment = () => {
  return process.env.NODE_ENV || 'development';
};

// 导出配置获取函数
export const getConfig = () => {
  const env = getEnvironment();
  return {
    ao: {
      endpoints: config.ao.endpoints[env],
      processId: config.ao.processId[env]
    },
    arweave: {
      endpoint: config.arweave.endpoints[env]
    },
    proxy: config.proxy
  };
};
