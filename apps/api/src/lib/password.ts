import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Clave temporal que la empresa le dicta al chofer.
 * Sin caracteres ambiguos (0/O, 1/l/I) porque se transmite de viva voz.
 */
export const generateTemporaryPassword = (length = 10): string => {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
};
