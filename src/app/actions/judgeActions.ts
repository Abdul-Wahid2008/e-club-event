'use server';

// Judge score submission now lives in pitchQueueActions.ts
// (submitPitchScoreAction) since scoring, queue, and timer control share
// the same single-score-per-pitch model and are used by both Judge and
// Organiser portals. This file is kept as a re-export for callers that
// still import from '@/src/app/actions/judgeActions'.
export { submitPitchScoreAction } from './pitchQueueActions';
