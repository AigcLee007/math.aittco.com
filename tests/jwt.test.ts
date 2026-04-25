import assert from 'node:assert/strict';
import test from 'node:test';

test('signAccessToken and verifyAccessToken round-trip', async () => {
  process.env.JWT_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

  const { signAccessToken, verifyAccessToken } = await import('../src/server/auth/jwt');

  const token = signAccessToken({ userId: 'user-1', role: 'ADMIN' });
  const payload = verifyAccessToken(token);

  assert.equal(payload.userId, 'user-1');
  assert.equal(payload.role, 'ADMIN');
});

test('signRefreshToken and verifyRefreshToken round-trip', async () => {
  process.env.JWT_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

  const { signRefreshToken, verifyRefreshToken } = await import('../src/server/auth/jwt');

  const token = signRefreshToken({ userId: 'user-2' });
  const payload = verifyRefreshToken(token);

  assert.equal(payload.userId, 'user-2');
});
