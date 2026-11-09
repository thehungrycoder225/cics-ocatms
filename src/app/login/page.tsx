import { Brand } from '@/components/brand';
import { SignInForm } from '@/components/sign-in-form';
import './login.css';

export default function LoginPage() {
  return (
    <main className='login-screen page-shell grid place-items-center'>
      <section
        className='login-card card w-full max-w-md p-6 sm:p-9'
        aria-labelledby='login-heading'
      >
        <Brand href='/' />
        <p className='eyebrow mt-9'>University workspace</p>
        <h1
          className='mt-2 text-2xl font-bold tracking-tight'
          id='login-heading'
        >
          Sign in
        </h1>
        <p className='muted mt-3 text-sm leading-6'>
          Sign in with your assigned account. An authorized operator creates
          accounts; public self-registration is disabled.
        </p>
        <SignInForm />
        <div className='mt-7 border-t border-[var(--border)] pt-5'>
          <p className='text-sm font-semibold'>Location privacy</p>
          <p className='muted mt-1 text-xs leading-5'>
            Location access is not requested on this screen. OCATMS does not
            continuously track your location.
          </p>
        </div>
      </section>
    </main>
  );
}
