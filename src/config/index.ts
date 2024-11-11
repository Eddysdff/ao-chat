export const config = {
  ao: {
    endpoints: {
      test: {
        MU_URL: 'http://localhost:4943',
        CU_URL: 'http://localhost:4942',
      },
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
      test: 'test-process-id',
      development: 'dev-process-id',
      production: 'prod-process-id'
    }
  },
  arweave: {
    endpoints: {
      test: 'http://localhost:1984',
      development: 'https://arweave.net',
      production: 'https://arweave.net'
    }
  }
};
