import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 space-y-6">
      <Image src="/logo-icon.png" alt="The Pitch League" width={72} height={72} className="w-16 h-16 object-contain opacity-80" />

      <div className="space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">Looks like this pitch got cut.</h1>
        <p className="text-sm text-text-secondary max-w-md">
          There&apos;s nothing on stage at this address. The page you&apos;re looking for either moved, never existed, or the judges rejected it.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-brand-500 hover:bg-brand-500/90 text-white transition-colors shadow-brand-glow"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to The Pitch League
      </Link>
    </div>
  );
}
