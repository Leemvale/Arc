import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { SessionView } from '../../../shared/domain.js';
import { practiceApi } from './api.js';
import { useAnswerDraft } from './useAnswerDraft.js';

export function useAnswerForm(session: SessionView, onUpdate: (s: SessionView) => void) {
  const exercise = session.exercises[session.position];
  const answer = session.answers.find((a) => a.exerciseId === exercise.id);
  const { value, storageError, change, clear } = useAnswerDraft(
    `arc:${session.id}:${exercise.id}`,
    answer?.value,
  );
  const submit = useMutation({
    mutationFn: () => practiceApi.submit(session.id, exercise.id, value),
    onSuccess: (data) => {
      onUpdate(data);
      clear();
    },
  });
  const retry = useMutation({
    mutationFn: () => practiceApi.retry(answer!.id),
    onSuccess: onUpdate,
  });
  const advance = useMutation({
    mutationFn: () => practiceApi.advance(session.id, exercise.id, session.revision),
    onSuccess: onUpdate,
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit.mutate();
  };
  return { exercise, answer, value, storageError, change, submit, retry, advance, onSubmit };
}
