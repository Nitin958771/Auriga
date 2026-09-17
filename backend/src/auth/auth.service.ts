import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

export class AuthService {
  static async validateUser(username: string, passwordPlain: string) {
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return null;
    }

    const isValid = await argon2.verify(user.passwordHash, passwordPlain);
    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role
    };
  }
}
