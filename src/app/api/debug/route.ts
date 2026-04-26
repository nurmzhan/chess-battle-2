export async function GET() {
  const url = process.env.DATABASE_URL || 'NOT FOUND';
  const masked = url.replace(/:([^:@]+)@/, ':***@');
  return Response.json({ DATABASE_URL: masked });
}