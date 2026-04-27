
// src/app/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LobbyPage } from '@/components/ui/LobbyPage';
import { LandingPage } from '@/components/ui/LandingPage';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    return <LobbyPage user={session.user as any} />;
  }

  return <LandingPage />;
}
