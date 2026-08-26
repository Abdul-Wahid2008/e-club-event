import Image from 'next/image';
import { Linkedin, Instagram } from 'lucide-react';

const SOCIAL_LINKS = [
  { href: 'https://www.linkedin.com/company/entrepreneurship-club-nitw/', label: 'LinkedIn', Icon: Linkedin },
  { href: 'https://www.instagram.com/eclubnitw', label: 'Instagram', Icon: Instagram },
];

/**
 * Shared site footer: brand tagline, E-Cell co-branding, and social links.
 * Rendered on public-facing pages (homepage, auth, registration) — the
 * dense in-app portal screens (Team/Judge/Organiser/display) intentionally
 * skip it to keep those functional screens uncluttered on event day.
 */
export default function Footer() {
  return (
    <footer className="border-t border-panel-border py-6 px-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary font-mono">
        <p className="text-center sm:text-left">The Pitch League • Live Competition Arena • National Institute of Technology Warangal</p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Image src="/ecell-logo.png" alt="Entrepreneurship Cell, NIT Warangal" width={20} height={20} className="w-5 h-5 rounded object-contain" />
            <span>Organised by Entrepreneurship Cell, NIT Warangal</span>
          </div>

          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-text-secondary hover:text-brand-500 transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
