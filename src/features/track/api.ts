import type { TrackView } from '../../../shared/contracts.js';
import { request } from '../../shared/api/request.js';

export const getTrack = () => request<TrackView>('/track');
