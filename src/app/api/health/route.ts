// Health check endpoint — always returns version + timestamp
// Used to verify which build is deployed
export async function GET() {
  return new Response(
    JSON.stringify({
      version: '2026-06-03-ai-fix-v6',
      buildTime: new Date().toISOString(),
      message: 'New build deployed successfully',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
