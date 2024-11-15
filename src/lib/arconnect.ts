export async function getActiveAddress(): Promise<string> {
  if (!window.arweaveWallet) {
    throw new Error('ArConnect not found');
  }
  return await window.arweaveWallet.getActiveAddress();
}

export class ArConnectService {
  private static isInitialized = false;
  private static connectionPromise: Promise<void> | null = null;

  static async connectWallet(): Promise<string> {
    try {
      await this.initialize();
      return await this.getAddress();
    } catch (error) {
      console.error('[ArConnect] Connection failed:', error);
      throw error;
    }
  }

  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      try {
        if (!window.arweaveWallet) {
          throw new Error('ArConnect not found');
        }

        const permissions = await window.arweaveWallet.getPermissions();
        if (permissions.length === 0) {
          await window.arweaveWallet.connect([
            'ACCESS_ADDRESS',
            'SIGN_TRANSACTION',
            'DISPATCH'
          ]);
        }
        
        this.isInitialized = true;
        console.log('[ArConnect] Initialized successfully');
      } catch (error) {
        console.error('[ArConnect] Initialization failed:', error);
        throw error;
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  static async getAddress(): Promise<string> {
    await this.initialize();
    if (!window.arweaveWallet) {
      throw new Error('ArConnect not found');
    }
    return window.arweaveWallet.getActiveAddress();
  }

  static async disconnect(): Promise<void> {
    if (!window.arweaveWallet) return;
    await window.arweaveWallet.disconnect();
    this.isInitialized = false;
    this.connectionPromise = null;
  }

  static async isConnected(): Promise<boolean> {
    if (!window.arweaveWallet) return false;
    try {
      const permissions = await window.arweaveWallet.getPermissions();
      const requiredPermissions = ['ACCESS_ADDRESS', 'SIGN_TRANSACTION', 'DISPATCH'];
      return requiredPermissions.every(perm => permissions.includes(perm));
    } catch {
      return false;
    }
  }
}

// 导出便捷方法
export const connectWallet = ArConnectService.connectWallet.bind(ArConnectService); 