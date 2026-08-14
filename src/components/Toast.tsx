'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { usePrefersReducedMotion } from '@/src/lib/useReducedMotion';

export interface ToastMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

/**
 * Inline confirmation banner for submit actions (vote sent, question sent,
 * score submitted-and-locked). Rendered inline near the triggering form
 * rather than as a floating global toast, so it stays visible on small
 * phone screens without covering other controls.
 */
export default function Toast({ message }: { message: ToastMessage | null }) {
  const reduced = usePrefersReducedMotion();

  const icon = message?.type === 'success'
    ? <CheckCircle2 className="w-4 h-4 text-success-500 shrink-0 mt-0.5" />
    : message?.type === 'error'
      ? <XCircle className="w-4 h-4 text-danger-500 shrink-0 mt-0.5" />
      : <Info className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />;

  const style = message?.type === 'success'
    ? 'bg-success-500/10 text-text-primary border-success-500/30'
    : message?.type === 'error'
      ? 'bg-danger-500/10 text-text-primary border-danger-500/30'
      : 'bg-brand-500/10 text-text-primary border-brand-500/30';

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-xl text-xs font-semibold border flex items-start space-x-2 ${style}`}
        >
          {icon}
          <span>{message.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
