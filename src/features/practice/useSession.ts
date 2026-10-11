import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionView } from '../../../shared/domain.js';
import { practiceApi } from './api.js';

export function useSession(id: string, result: boolean) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['session', id],
    queryFn: () => practiceApi.get(id, result),
    refetchInterval: (q) =>
      q.state.data?.answers.some((a) => ['submitted', 'evaluating'].includes(a.state))
        ? 1200
        : false,
  });
  function update(session: SessionView) {
    client.setQueryData(['session', id], session);
    void client.invalidateQueries({ queryKey: ['track'] });
  }
  return { query, update };
}
