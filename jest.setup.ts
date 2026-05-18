jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => require('crypto').randomUUID(),
}));
