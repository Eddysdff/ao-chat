declare global {
  interface Window {
    arweaveWallet: {
      connect: (permissions: string[]) => Promise<void>;
      disconnect: () => Promise<void>;
      getActiveAddress: () => Promise<string>;
      getPermissions: () => Promise<string[]>;
      sign: (transaction: any) => Promise<any>;
      dispatch: (transaction: any) => Promise<any>;
    };
  }
}

// 添加权限类型定义
export type ArConnectPermission = 
  | 'ACCESS_ADDRESS'
  | 'ACCESS_PUBLIC_KEY'
  | 'ACCESS_ALL_ADDRESSES'
  | 'SIGN_TRANSACTION'
  | 'ENCRYPT'
  | 'DECRYPT'
  | 'SIGNATURE'
  | 'DISPATCH';

// 为了使这个文件成为一个模块
export {}; 