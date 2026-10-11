import { useMutation, useQueryClient } from '@tanstack/react-query';
import { navigate } from '../../shared/lib/navigation.js';
import { practiceApi } from './api.js';

export function useStartSession() {
  const client = useQueryClient();
  const start = useMutation({
    mutationFn: () => practiceApi.start(),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: ['track'] });
      navigate(`/session/${result.id}`);
    },
  });
  return start;
}
