export async function GET() {
  return new Response(JSON.stringify({ message: 'Debug route v4 active', timestamp: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
