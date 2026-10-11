import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { track } from '../content/track.js';
import { evaluationExamples } from '../content/evaluation.js';
import { category, type Assessment } from '../shared/domain.js';
import { openAI, providerReady, preparePrompt, PROMPT_VERSION } from '../server/assessor.js';
import { pool, transaction } from '../server/db.js';
import { reserve, settle, actualCost, maxCost } from '../server/budget.js';
import { config } from '../server/config.js';
import { recoverExpired } from '../server/worker.js';

type Row = {
  exampleId: string;
  exerciseId: string;
  answer: string;
  expected: boolean[];
  adversarial: boolean;
  valid: boolean;
  result?: Assessment;
  actual?: boolean[];
  criterionMatches: number;
  categoryMatch: boolean;
  severe: boolean;
  cost: number;
  error?: string;
};
const label = (values: boolean[]) =>
  values.every(Boolean) ? 'correct' : values.some(Boolean) ? 'partial' : 'incorrect';
async function main() {
  for (const example of evaluationExamples)
    preparePrompt(
      track.exercises.find((e) => e.id === example.exerciseId)!,
      track,
      example.answer,
    );
  if (process.argv.includes('--dry-run')) {
    console.log(
      `Набор готов: ${evaluationExamples.length} примеров × 2 прогона. Платных вызовов нет. Максимальный резерв по текущим тарифам: $${(evaluationExamples.length * 2 * maxCost()).toFixed(4)}.`,
    );
    return;
  }
  providerReady();
  await recoverExpired();
  const report = {
    createdAt: new Date().toISOString(),
    model: config.OPENAI_MODEL,
    promptVersion: PROMPT_VERSION,
    contentVersion: track.version,
    sourceCommit: track.sourceCommit,
    inputPrice: config.OPENAI_INPUT_PRICE,
    outputPrice: config.OPENAI_OUTPUT_PRICE,
    manualReview: 'pending',
    accepted: false,
    runs: [] as {
      run: number;
      rows: Row[];
      structuralValidity: number;
      criteriaAccuracy: number;
      categoryAccuracy: number;
      adversarialPass: boolean;
      automaticGate: boolean;
    }[],
  };
  const directory = 'reports/evaluations';
  await mkdir(directory, { recursive: true });
  const file = `${directory}/${Date.now()}.json`;
  try {
    for (let run = 1; run <= 2; run++) {
      const entry = {
        run,
        rows: [] as Row[],
        structuralValidity: 0,
        criteriaAccuracy: 0,
        categoryAccuracy: 0,
        adversarialPass: false,
        automaticGate: false,
      };
      report.runs.push(entry);
      for (const example of evaluationExamples) {
        const id = randomUUID();
        const exercise = track.exercises.find((e) => e.id === example.exerciseId)!;
        await transaction(async (db) => {
          await db.query(
            "INSERT INTO assessment_attempts(id,kind,state,deadline,model,prompt_version,rubric_version) VALUES($1,'eval','running',now()+interval '90 seconds',$2,$3,$4)",
            [id, config.OPENAI_MODEL, PROMPT_VERSION, track.version],
          );
          await reserve(db, id);
        });
        const row: Row = {
          exampleId: example.id,
          exerciseId: exercise.id,
          answer: example.answer,
          expected: example.expected,
          adversarial: !!example.adversarial,
          valid: false,
          criterionMatches: 0,
          categoryMatch: false,
          severe: false,
          cost: maxCost(),
        };
        try {
          const output = await openAI(exercise, track, example.answer);
          row.valid = true;
          row.result = output.result;
          row.actual = exercise.criteria.map(
            (c) => output.result.criteria.find((v) => v.criterionId === c.id)!.met,
          );
          row.criterionMatches = row.actual.filter((v, i) => v === example.expected[i]).length;
          row.categoryMatch = category(output.result) === label(example.expected);
          row.severe =
            (label(example.expected) === 'incorrect' && category(output.result) === 'correct') ||
            (label(example.expected) === 'correct' && category(output.result) === 'incorrect');
          row.cost = actualCost(output.inputTokens, output.outputTokens);
          await transaction(async (db) => {
            const attempt = (
              await db.query(
                "SELECT * FROM assessment_attempts WHERE id=$1 AND state='running' FOR UPDATE",
                [id],
              )
            ).rows[0];
            if (!attempt) throw Error('Попытка истекла');
            await settle(db, attempt, row.cost);
            await db.query(
              "UPDATE assessment_attempts SET state='completed',input_tokens=$2,output_tokens=$3 WHERE id=$1",
              [id, output.inputTokens, output.outputTokens],
            );
          });
        } catch {
          row.valid = false;
          row.error = 'Ошибка API, невалидный результат или ошибка сохранения. Требуется разбор.';
          await transaction(async (db) => {
            const attempt = (
              await db.query(
                "SELECT * FROM assessment_attempts WHERE id=$1 AND state='running' FOR UPDATE",
                [id],
              )
            ).rows[0];
            if (attempt) {
              await settle(db, attempt);
              await db.query("UPDATE assessment_attempts SET state='failed',error=$2 WHERE id=$1", [
                id,
                row.error,
              ]);
            }
          });
        }
        entry.rows.push(row);
        console.log(
          `Прогон ${run}, ${example.id}: ${row.valid ? 'получена оценка' : 'техническая ошибка'}, $${row.cost.toFixed(5)}`,
        );
        await writeFile(file, JSON.stringify(report, null, 2));
      }
      const regular = entry.rows.filter((r) => !r.adversarial);
      entry.structuralValidity = entry.rows.filter((r) => r.valid).length / entry.rows.length;
      entry.criteriaAccuracy =
        regular.reduce((n, r) => n + r.criterionMatches, 0) /
        regular.reduce((n, r) => n + r.expected.length, 0);
      entry.categoryAccuracy =
        regular.filter((r) => r.categoryMatch && r.valid).length / regular.length;
      entry.adversarialPass = entry.rows
        .filter((r) => r.adversarial)
        .every((r) => r.valid && r.criterionMatches === r.expected.length);
      entry.automaticGate =
        entry.structuralValidity === 1 &&
        entry.criteriaAccuracy >= 0.9 &&
        entry.categoryAccuracy >= 0.9 &&
        entry.adversarialPass &&
        !entry.rows.some((r) => r.severe);
    }
  } finally {
    await writeFile(file, JSON.stringify(report, null, 2));
    console.log(
      `Отчёт: ${file}. Требуется ручной разбор объяснений и расхождений; автоматический отчёт не подтверждает приёмку.`,
    );
  }
  if (!report.runs.every((r) => r.automaticGate)) process.exitCode = 1;
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Проверка не выполнена');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
