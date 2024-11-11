import { createDataItemSigner, connect } from '@permaweb/ao-sdk';
import { ProcessResult } from '@/types/ao';

// 使用已部署的Process ID
const PROCESS_ID = 'NZgQPPhsKrR3xpRlB2AUiigj92dJS41OXxkhIZ34P4Q';

// 创建AO客户端实例
const client = connect({
  MU_URL: 'https://mu.ao-testnet.xyz',
  CU_URL: 'https://cu.ao-testnet.xyz',
});

export class AOProcess {
  // 添加重试机制的私有方法
  private static async sendMessageWithRetry(
    action: string, 
    data: any = {}, 
    targetProcess: string = PROCESS_ID,
    maxRetries: number = 3
  ): Promise<ProcessResult> {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (!window.arweaveWallet) {
          throw new Error('ArConnect not found');
        }

        // 修改消息格式和签名方式
        const message = {
          process: targetProcess,
          tags: [{ name: 'Action', value: action }],
          data: JSON.stringify(data), // 确保数据被字符串化
        };

        const signer = createDataItemSigner(window.arweaveWallet);
        const result = await client.message({
          ...message,
          signer,
        });

        return result as ProcessResult;
      } catch (error) {
        console.warn(`Attempt ${i + 1} failed:`, error);
        lastError = error;
        // 指数退避重试
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
    
    throw lastError;
  }

  // 修改现有方法使用重试机制
  static async sendInvitation(to: string, nickname: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('SendInvitation', { to, nickname });
  }

  static async acceptInvitation(from: string, nickname: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('AcceptInvitation', { from, nickname });
  }

  static async rejectInvitation(from: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('RejectInvitation', { from });
  }

  static async removeContact(address: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('RemoveContact', { address });
  }

  static async updateNickname(address: string, nickname: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('UpdateNickname', { address, nickname });
  }

  static async getPendingInvitations(): Promise<ProcessResult> {
    return this.sendMessageWithRetry('GetPendingInvitations', {});
  }

  static async getContacts(): Promise<ProcessResult> {
    return this.sendMessageWithRetry('GetContacts', {});
  }

  static async createChatroom(participant: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('CreateChatroom', { participant });
  }

  static async acceptChatroom(processId: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('AcceptChatroom', { processId });
  }

  static async joinChatroom(processId: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('Join', {}, processId);
  }

  static async sendChatroomMessage(processId: string, content: string): Promise<ProcessResult> {
    return this.sendMessageWithRetry('Send', { content }, processId);
  }

  static async getChatroomMessages(
    processId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ProcessResult> {
    return this.sendMessageWithRetry(
      'GetMessages',
      { page, pageSize },
      processId
    );
  }

  static async getChatrooms(): Promise<ProcessResult> {
    return this.sendMessageWithRetry('GetChatrooms', {});
  }

  // 添加健康检查方法
  static async checkHealth(processId: string = PROCESS_ID): Promise<boolean> {
    try {
      const result = await this.sendMessageWithRetry('health-check', {}, processId);
      return result.success === true;
    } catch {
      return false;
    }
  }
} 