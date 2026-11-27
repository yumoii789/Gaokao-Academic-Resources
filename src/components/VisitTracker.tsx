'use client';

import { useEffect } from 'react';
import { trackVisit } from '@/lib/ai-config';

export default function VisitTracker() {
  useEffect(() => { trackVisit(); }, []);
  return null;
}
