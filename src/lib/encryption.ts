export class Encryption {
  // 生成密钥对
  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey", "deriveBits"]
    );
  }

  // 导出公钥为 JWK 格式
  static async exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey("jwk", key);
  }

  // 导出私钥为 JWK 格式
  static async exportPrivateKey(key: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey("jwk", key);
  }

  // 从 JWK 导入公钥
  static async importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      []
    );
  }

  // 从 JWK 导入私钥
  static async importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey", "deriveBits"]
    );
  }

  // 导出密钥对为字符串
  static async exportKeyPair(keyPair: CryptoKeyPair): Promise<string> {
    const publicJwk = await this.exportPublicKey(keyPair.publicKey);
    const privateJwk = await this.exportPrivateKey(keyPair.privateKey);
    return JSON.stringify({ publicJwk, privateJwk });
  }

  // 从字符串导入密钥对
  static async importKeyPair(keyPairStr: string): Promise<CryptoKeyPair> {
    const { publicJwk, privateJwk } = JSON.parse(keyPairStr);
    return {
      publicKey: await this.importPublicKey(publicJwk),
      privateKey: await this.importPrivateKey(privateJwk)
    };
  }

  // 使用公钥和私钥生成共享密钥
  static async deriveSharedKey(
    publicKey: CryptoKey,
    privateKey: CryptoKey
  ): Promise<CryptoKey> {
    return await window.crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: publicKey,
      },
      privateKey,
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // 加密消息
  static async encryptMessage(
    text: string,
    sharedKey: CryptoKey
  ): Promise<{ encrypted: string; iv: string }> {
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(text);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      sharedKey,
      encodedText
    );

    return {
      encrypted: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  // 解密消息
  static async decryptMessage(
    encryptedData: string,
    iv: string,
    sharedKey: CryptoKey
  ): Promise<string> {
    const decoder = new TextDecoder();
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: this.base64ToArrayBuffer(iv),
      },
      sharedKey,
      this.base64ToArrayBuffer(encryptedData)
    );

    return decoder.decode(decryptedData);
  }

  // 辅助函数：ArrayBuffer 转 Base64
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // 辅助函数：Base64 转 ArrayBuffer
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
} 