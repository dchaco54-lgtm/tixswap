import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// GET /api/tickets/my-publications?status=...&q=...&sort=...
// Alias: este endpoint reusa la lógica de my-listings para robustez y shape único
import * as myListings from '../my-listings/route.js';

export const GET = myListings.GET;
