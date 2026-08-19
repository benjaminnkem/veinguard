import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies argon2id hashes and rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash.startsWith('$argon2')).toBe(true);
    await expect(verifyPassword(hash, 'correct-horse-battery')).resolves.toBe(
      true,
    );
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });
});
