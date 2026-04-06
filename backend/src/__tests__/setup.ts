// Test setup file
beforeAll(async () => {
  // Global test setup
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
});

afterAll(async () => {
  // Global cleanup
});

// Dummy test to satisfy Jest
test('setup test file', () => {
  expect(true).toBe(true);
});
