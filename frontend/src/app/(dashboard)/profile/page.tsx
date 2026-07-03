import ProfileForm from '@/components/ProfileForm';
import { getCurrentUser } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

export default async function ProfilePage() {
  const { token, user: fallbackUser } = requireServerAuth();

  try {
    const user = await getCurrentUser({ token });

    return (
      <div className="space-y-8">
        <section className="surface p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Profile settings</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Manage your profile</h1>
          <p className="mt-4 text-slate-300">Keep your learner identity, biography, and public headline up to date.</p>
        </section>

        <ProfileForm user={user} />
      </div>
    );
  } catch {
    return (
      <div className="space-y-8">
        <section className="surface p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Profile settings</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Manage your profile</h1>
          <p className="mt-4 text-slate-300">We could not reach the profile service, but you can still review your local account details.</p>
        </section>

        <ProfileForm user={fallbackUser} />
      </div>
    );
  }
}
