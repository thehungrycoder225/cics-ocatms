import Link from 'next/link';
import { Brand } from '@/components/brand';
import { getAuthenticatedIdentity } from '@/lib/authorization';

export default async function HomePage() {
  const identity = await getAuthenticatedIdentity();
  if (identity) {
    if (identity.assignments.length === 0) {
      return (
        <main className='page-shell grid place-items-center'>
          <section className='card w-full max-w-xl p-7 sm:p-10'>
            <Brand />
            <p className='eyebrow mt-6'>Account setup required</p>
            <h1 className='mt-3 text-3xl font-bold'>
              No workspace is assigned
            </h1>
            <p className='muted mt-3 leading-7'>
              Your account has no active primary role. Contact an authorized
              OCATMS operator to complete account setup.
            </p>
          </section>
        </main>
      );
    }

    const role = identity.assignments.find(
      (assignment) => assignment.role === 'VPSAS',
    )
      ? 'vpsas'
      : identity.assignments.find((assignment) => assignment.role === 'DEAN')
        ? 'dean'
        : 'participant';
    return (
      <main className='page-shell grid place-items-center'>
        <section className='card w-full max-w-xl p-7 sm:p-10'>
          <Brand />
          <p className='eyebrow mt-6'>Marinduque State University</p>
          <h1 className='mt-3 text-3xl font-bold'>Your workspace</h1>
          <p className='mt-3 font-semibold'>{identity.fullName}</p>
          <p className='muted mt-3 leading-7'>
            Continue to the workspace allowed by your assigned role.
          </p>
          <Link className='button-primary mt-6' href={`/${role}`}>
            Open my workspace
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className='page-shell grid place-items-center'>
      <section className='card w-full max-w-xl p-7 sm:p-10'>
        <Brand />
        <p className='eyebrow mt-9'>
          Off-Campus Activity Tracking and Monitoring System
        </p>
        <h1 className='mt-3 text-3xl font-bold leading-tight sm:text-4xl'>
          Off-campus activities
        </h1>
        <p className='muted mt-4 leading-7'>
          A university workspace for approved activity itineraries, participant
          travel milestones, and college-scoped oversight. Location is captured
          only at explicitly authorized milestones—not continuously in the
          background.
        </p>
        <Link className='button-primary mt-7' href='/login'>
          Sign in to OCATMS
        </Link>
        <p className='muted mt-7 border-t border-[var(--border)] pt-5 text-sm leading-6'>
          Your account’s role and college scope are checked on the server.
          Activity records shown here do not imply that travel, attendance, or a
          location check-in occurred.
        </p>
      </section>
    </main>
  );
}
