/** Partition key and sort key builders for the QuickInvoice single-table design. */

export const Keys = {
  user: {
    pk: (userId: string) => `USER#${userId}`,
    sk: () => 'PROFILE',
    gsi1pk: (email: string) => `EMAIL#${email.toLowerCase()}`,
    gsi1sk: () => 'USER',
  },

  refreshToken: {
    pk: (userId: string) => `USER#${userId}`,
    sk: (tokenId: string) => `RTOKEN#${tokenId}`,
  },

  emailVerifyToken: {
    pk: (userId: string) => `USER#${userId}`,
    sk: (tokenId: string) => `VTOKEN#${tokenId}`,
  },

  passwordResetToken: {
    pk: (userId: string) => `USER#${userId}`,
    sk: (tokenId: string) => `PRTOKEN#${tokenId}`,
  },

  invoiceCounter: {
    pk: (userId: string) => `USER#${userId}`,
    sk: () => 'COUNTER',
  },

  client: {
    pk: (userId: string) => `USER#${userId}`,
    sk: (clientId: string) => `CLIENT#${clientId}`,
  },

  invoice: {
    pk: (userId: string) => `USER#${userId}`,
    sk: (invoiceId: string) => `INVOICE#${invoiceId}`,
    gsi1pk: (userId: string) => `USER#${userId}`,
    gsi1sk: (status: string, createdAt: string) => `STATUS#${status}#${createdAt}`,
  },

  loginAttempt: {
    pk: (email: string) => `ATTEMPTS#${email.toLowerCase()}`,
    sk: () => 'LOGIN',
  },
};
