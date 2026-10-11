import type { SessionView } from '../../../shared/domain.js';
import { request } from '../../shared/api/request.js';

export const practiceApi = {
  start: () => request<{ id: string }>('/sessions', {}),
  get: (id: string, result: boolean) =>
    request<SessionView>(`/sessions/${id}${result ? '/result' : ''}`),
  submit: (id: string, exerciseId: string, value: string) =>
    request<SessionView>(`/sessions/${id}/answers`, { exerciseId, value }),
  retry: (id: string) => request<SessionView>(`/answers/${id}/retry`, {}),
  advance: (id: string, exerciseId: string, revision: number) =>
    request<SessionView>(`/sessions/${id}/advance`, { exerciseId, revision }),
};
