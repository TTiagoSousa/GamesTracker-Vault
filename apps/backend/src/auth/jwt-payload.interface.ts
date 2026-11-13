import { Role } from 'src/generated/prisma/client/client';

export interface JwtPayload {
  id: string;
  username: string;
  role: Role;
  // How the request signed in: the browser's session cookie or an API token
  authMethod?: 'session' | 'token';
}
