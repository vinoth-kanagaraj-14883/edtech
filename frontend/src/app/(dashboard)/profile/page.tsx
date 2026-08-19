import ProfileForm from '@/components/ProfileForm';
import { getCurrentUser } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

interface ProfileHeaderProps {
  subtitle: string;
}

function ProfileHeader({ subtitle }: ProfileHeaderProps) {
  return (
    <header className="page-header">
      <p className="eyebrow">Profile settings</p>
      <h1 className="text-headline text-content">Manage your profile</h1>
      <p className="section-subtitle max-w-2xl">{subtitle}</p>
    </header>
  );
}

export default async function ProfilePage() {
  const { token, user: fallbackUser } = requireServerAuth();

  try {
    const user = await getCurrentUser({ token });

    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <ProfileHeader subtitle="Keep your learner identity, biography, and public headline up to date." />
        <ProfileForm user={user} />
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <ProfileHeader subtitle="We could not reach the profile service, but you can still review your local account details." />
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-warning-500/25 bg-warning-50 px-4 py-3.5 text-sm text-warning-600 dark:bg-warning-500/10"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-px shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4.5M12 16h.01" />
          </svg>
          <span>Showing locally cached details — some fields may be out of date.</span>
        </div>
        <ProfileForm user={fallbackUser} />
      </div>
    );
  }
}
