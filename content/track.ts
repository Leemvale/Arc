import { trackSchema } from '../shared/domain.js';

export const sourceCommit = '9111a7654d7800391459431fff4eaf66e33a3d2e';
const base = `https://github.com/Fission-AI/OpenSpec/blob/${sourceCommit}/docs/`;
export const track = trackSchema.parse({
  id: 'openspec',
  version: '1.0.0',
  title: 'OpenSpec: от идеи до проверенного изменения',
  goal: 'Improve',
  description:
    'Разберитесь, как устроены спецификации и изменения. Пять коротких заданий помогут проверить понимание и найти темы для повторения.',
  sourceCommit,
  sourceContext:
    'Upstream Fission-AI/OpenSpec, профиль core; команды расширенного workflow включаются отдельно. Ваш рабочий проект или форк может отличаться.',
  skills: [
    { id: 'structure', name: 'Структура OpenSpec и main/change specs' },
    { id: 'artifacts', name: 'Назначение документов' },
    { id: 'scenarios', name: 'Требования и проверяемые сценарии' },
    { id: 'deltas', name: 'Операции delta specs' },
    { id: 'workflow', name: 'Рабочий процесс' },
    { id: 'verification', name: 'Проверка результата' },
  ],
  sources: [
    {
      id: 'structure',
      title: 'Getting Started · What OpenSpec Creates',
      url: `${base}getting-started.md#what-openspec-creates`,
      excerpt:
        'specs/ is the source of truth and describes current system behavior. changes/ contains proposed modifications, with delta specs inside each change. When a change is complete its specs merge into the main specs directory.',
    },
    {
      id: 'artifacts',
      title: 'Concepts · Artifacts',
      url: `${base}concepts.md#artifacts`,
      excerpt:
        'Proposal captures intent, scope and approach at a high level (why). Delta specs describe what changes relative to current specs. Design captures technical approach and architecture decisions (how). Tasks are concrete implementation steps with checkboxes.',
    },
    {
      id: 'scenarios',
      title: 'Concepts · Why Structure Specs This Way',
      url: `${base}concepts.md#why-structure-specs-this-way`,
      excerpt:
        'Requirements state what the system should do without specifying implementation. Scenarios provide concrete examples that can be verified, are testable, and use Given/When/Then or similar structured format. They cover happy path and edge cases.',
    },
    {
      id: 'commands',
      title: 'Commands · Quick Reference',
      url: `${base}commands.md#quick-reference`,
      excerpt:
        'The core profile includes propose, explore, apply, update, sync and archive. The expanded workflow commands, including verify, require custom workflow selection.',
    },
  ],
  exercises: [
    {
      id: 'main-or-change',
      type: 'choice',
      skillId: 'structure',
      prompt:
        'Вы предлагаете новое поведение, которое ещё не реализовано. Где описать его изменение относительно текущих требований?',
      options: [
        { id: 'delta', label: 'В openspec/changes/<change>/specs/<capability>/spec.md' },
        { id: 'main', label: 'Заменить основные specs так, будто поведение уже реализовано' },
        { id: 'tasks', label: 'Только в tasks.md, без требований' },
      ],
      correctOptionId: 'delta',
      criteria: [
        { id: 'location', description: 'Изменение описано в delta specs соответствующего change' },
      ],
      sourceIds: ['structure'],
      explanation:
        'Предложенное изменение описывается в specs внутри change. Основные specs отражают текущее согласованное поведение; при завершении изменения дельты синхронизируются с ними.',
    },
    {
      id: 'design-role',
      type: 'choice',
      skillId: 'artifacts',
      prompt:
        'В каком документе объяснить выбор PostgreSQL и способ восстановления сессии после сбоя?',
      options: [
        { id: 'design', label: 'design.md — технический подход и решения' },
        { id: 'proposal', label: 'proposal.md — только мотивация изменения' },
        { id: 'specs', label: 'specs — список внутренних функций и библиотек' },
      ],
      correctOptionId: 'design',
      criteria: [
        { id: 'role', description: 'Технический подход и архитектурные решения отнесены к design' },
      ],
      sourceIds: ['artifacts'],
      explanation:
        'Design описывает технический подход и причины решений. Specs задают наблюдаемое поведение, proposal объясняет намерение и границы, tasks перечисляют шаги реализации.',
    },
    {
      id: 'explain-specs',
      type: 'open',
      skillId: 'structure',
      prompt:
        'Коллега говорит: «Основные specs и specs внутри change — две одинаковые копии требований». Объясните различие и что происходит с дельтами при завершении изменения.',
      criteria: [
        {
          id: 'main',
          description: 'Основные specs описывают текущее согласованное поведение системы',
        },
        {
          id: 'delta',
          description:
            'Change specs описывают предлагаемые изменения относительно основных specs, а не их полную копию',
        },
        {
          id: 'merge',
          description: 'При завершении изменения дельты синхронизируются с основными specs',
        },
      ],
      sourceIds: ['structure'],
      explanation:
        'Основные specs — описание текущего поведения. Внутри change находятся дельты предлагаемого изменения. После завершения они объединяются с основными specs.',
    },
    {
      id: 'explain-artifacts',
      type: 'open',
      skillId: 'artifacts',
      prompt:
        'Вы планируете сохранение результатов тренировки. Кратко объясните, что запишете в proposal, specs, design и tasks. Достаточно по одному предложению на документ.',
      criteria: [
        { id: 'proposal', description: 'Proposal объясняет зачем нужно изменение и его границы' },
        { id: 'specs', description: 'Specs задают наблюдаемое поведение и проверяемые сценарии' },
        {
          id: 'design',
          description: 'Design объясняет технический подход и архитектурные решения',
        },
        { id: 'tasks', description: 'Tasks перечисляют конкретные проверяемые шаги реализации' },
      ],
      sourceIds: ['artifacts', 'scenarios'],
      explanation:
        'Proposal отвечает на «зачем и в каких границах», specs — на «какое поведение», design — на «как устроить», tasks — на «что сделать и проверить».',
    },
    {
      id: 'write-scenario',
      type: 'open',
      skillId: 'scenarios',
      prompt:
        'Требование: «После завершения тренировки пользователь может повторно открыть сохранённый результат». Напишите один проверяемый сценарий Given/When/Then для повторного открытия результата после перезапуска приложения.',
      criteria: [
        {
          id: 'given',
          description: 'Указано предусловие: тренировка завершена и её результат сохранён',
        },
        {
          id: 'when',
          description:
            'Указано действие: после перезапуска пользователь открывает результат этой сессии',
        },
        {
          id: 'then',
          description:
            'Указан наблюдаемый результат: отображаются ранее сохранённые ответы и оценки этой сессии без изменений',
        },
      ],
      sourceIds: ['scenarios'],
      explanation:
        'Сценарий связывает предусловие, конкретное действие и наблюдаемый результат. Например: завершённая сохранённая сессия → повторное открытие после перезапуска → те же ответы и оценки.',
    },
  ],
});
