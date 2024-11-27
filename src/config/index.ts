// 定义环境类型
type Environment = 'development' | 'production';

// 定义配置类型
interface EndpointConfig {
  MU_URL: string;
  CU_URL: string;
}

interface ArweaveConfig {
  endpoints: {
    [K in Environment]: string;
  };
}

interface AOConfig {
  endpoints: {
    [K in Environment]: EndpointConfig;
  };
  processId: {
    [K in Environment]: string;
  };
}

interface Config {
  ao: AOConfig;
  arweave: ArweaveConfig;
}

export const config: Config = {
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
      development: 'ovis--ukeLTI6HduncpzE4evvwebqmKvxzR6XdC9x6s',
      production: 'ovis--ukeLTI6HduncpzE4evvwebqmKvxzR6XdC9x6s'
    }
  },
  arweave: {
    endpoints: {
      development: 'https://arweave.net',
      production: 'https://arweave.net'
    }
  }
};

// 获取当前环境
const getEnvironment = (): Environment => {
  return (process.env.NODE_ENV || 'development') as Environment;
};

interface AppConfig {
  ao: {
    endpoints: EndpointConfig;
    processId: string;
  };
  arweave: {
    endpoint: string;
  };
}

// 导出配置获取函数
export const getConfig = (): AppConfig => {
  const env = getEnvironment();
  return {
    ao: {
      endpoints: config.ao.endpoints[env],
      processId: config.ao.processId[env]
    },
    arweave: {
      endpoint: config.arweave.endpoints[env]
    }
  };
};

export default getConfig();
