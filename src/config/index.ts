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
      development: 'IOKr_HIFuxPdW4M_R8Dnzico126_t5b2Wdwa_5lqlS0',
      production: 'IOKr_HIFuxPdW4M_R8Dnzico126_t5b2Wdwa_5lqlS0'
    }
  },
  arweave: {
    endpoints: {
      development: 'https://arweave.net',
      production: 'https://arweave.net'
    }
  },
  proxy: {
    url: 'http://127.0.0.1:7890'  // 您的代理地址，请确认这是正确的
  }
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
