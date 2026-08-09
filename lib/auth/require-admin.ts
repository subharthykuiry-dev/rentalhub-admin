import { verifyAdminToken, type AdminTokenPayload } from './auth';

/**
 * Guards an admin API route.
 *
 * The existing product/category routes are unauthenticated, but these endpoints
 * expose revenue figures and customer contact details, so they verify the admin
 * JWT that `/api/auth/login` issues. The browser stores it as `admin_token` and
 * sends it as a bearer token.
 */
export function requireAdmin(req: Request): AdminTokenPayload | null {
  const header = req.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return verifyAdminToken(token);
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
