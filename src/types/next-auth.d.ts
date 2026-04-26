// src/types/next-auth.d.ts
import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      rating: number;
      wins: number;
      losses: number;
      draws: number;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
  }
}
