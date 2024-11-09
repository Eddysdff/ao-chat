export const connectWallet = async () => {
  if (!window.arweaveWallet) {
    throw new Error('ArConnect not found');
  }

  try {
    await window.arweaveWallet.connect([
      'ACCESS_ADDRESS',
      'SIGN_TRANSACTION',
      'DISPATCH'
    ]);
    const address = await window.arweaveWallet.getActiveAddress();
    return address;
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }
};

export const disconnectWallet = async () => {
  if (!window.arweaveWallet) return;
  await window.arweaveWallet.disconnect();
};

export const getActiveAddress = async () => {
  if (!window.arweaveWallet) return null;
  try {
    return await window.arweaveWallet.getActiveAddress();
  } catch {
    return null;
  }
}; 