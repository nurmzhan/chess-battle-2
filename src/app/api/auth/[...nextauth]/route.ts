export const dynamic = 'force-dynamic';

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        login: { label: 'Username or Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null;
        const { prisma } = await import('@/lib/prisma');
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.login },
              { username: credentials.login },
            ],
          },
        });
        if (!user) return null;
        const passwordMatch = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!passwordMatch) return null;
        return {
          id: user.id,
          name: user.username,
          email: user.email,
          rating: user.rating,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rating = (user as any).rating;
        token.wins = (user as any).wins;
        token.losses = (user as any).losses;
        token.draws = (user as any).draws;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).rating = token.rating;
        (session.user as any).wins = token.wins;
        (session.user as any).losses = token.losses;
        (session.user as any).draws = token.draws;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET ?? 'build-time-placeholder',
});

export { handler as GET, handler as POST };