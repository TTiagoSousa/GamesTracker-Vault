import { AuthGuard } from '@nestjs/passport';

// The browser's session cookie or an API token (Authorization: Bearer gtv_…): either signs
// the request in as the same user, with the same role.
export class JwtAuthGuard extends AuthGuard(['jwt', 'api-token']) {}
