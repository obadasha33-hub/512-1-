import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { hashValue } from '@/lib/encryption';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Sanctuary Login',
      credentials: {
        vaultCode: { label: 'Vault Code', type: 'text', placeholder: 'xxxx-xxxx-xxxx' },
        identity: { label: 'Identity', type: 'text', placeholder: 'Batman or Princess' },
        name: { label: 'Name', type: 'text', placeholder: 'Your name' },
      },
      async authorize(credentials) {
        if (!credentials?.vaultCode || !credentials?.identity || !credentials?.name) {
          return null;
        }

        const { vaultCode, identity, name } = credentials;

        // Validate identity
        if (identity !== 'Batman' && identity !== 'Princess') {
          return null;
        }

        try {
          // Try to find the vault
          let vault = await db.vault.findFirst({
            where: { id: vaultCode },
            include: { members: true },
          });

          if (!vault) {
            // Auto-create vault on first login
            const role = identity === 'Batman' ? 'partner1' : 'partner2';
            vault = await db.vault.create({
              data: {
                id: vaultCode,
                name: '523',
                members: {
                  create: {
                    role,
                    name,
                  },
                },
              },
              include: { members: true },
            });
          }

          // Find or create the member
          const role = identity === 'Batman' ? 'partner1' : 'partner2';
          let member = vault.members.find((m) => m.role === role);

          if (!member) {
            // Create the member if they don't exist yet
            member = await db.vaultMember.create({
              data: {
                vaultId: vault.id,
                role,
                name,
              },
            });
          } else {
            // Update member name and online status
            await db.vaultMember.update({
              where: { id: member.id },
              data: { name, isOnline: true, lastSeen: new Date() },
            });
          }

          return {
            id: member.id,
            name: member.name,
            role: member.role,
            vaultId: vault.id,
          };
        } catch (error) {
          console.error('[Auth] Authorization error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.vaultId = (user as any).vaultId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).vaultId = token.vaultId;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'sanctuary-dev-secret-change-in-production',
  pages: {
    // We handle login in-app, not via separate page
    signIn: '/',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
