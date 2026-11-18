import type { User } from '../../../shared/types.ts';

export function Avatar({ user, size }: { user: Pick<User, 'name' | 'color'>; size?: 'lg' }) {
  return (
    <span className={`avatar${size ? ` ${size}` : ''}`} style={{ background: user.color }} aria-hidden="true">
      {user.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Pair({ me, partner, size }: { me: User; partner: User | null; size?: 'lg' }) {
  return (
    <span className="avatars" role="img" aria-label={partner ? `${me.name} and ${partner.name}` : me.name}>
      <Avatar user={me} size={size} />
      {partner && <Avatar user={partner} size={size} />}
    </span>
  );
}
