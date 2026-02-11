import { useAuthStore } from '../../stores/authStore';
import { UserRole } from '../../types';

interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);

  if (!user || !roles.includes(user.role as UserRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
