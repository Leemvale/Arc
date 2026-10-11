import { useQuery } from '@tanstack/react-query';
import { getTrack } from './api.js';

export function useTrack() {
  return useQuery({ queryKey: ['track'], queryFn: getTrack });
}
