import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service.js';

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    }

    const { username, password } = parsed.data;

    const user = await AuthService.validateUser(username, password);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({ id: user.id, username: user.username, role: user.role });

    return reply.status(200).send({
      token,
      user
    });
  });
}
