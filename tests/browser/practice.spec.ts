import { test, expect } from '@playwright/test';
test('complete practice, draft reload, recovery, history and repeated practice', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('OpenSpec');
  await page.screenshot({ path: 'test-results/track-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  await page.getByLabel('В openspec/changes/').check();
  await page.reload();
  await expect(page.getByLabel('В openspec/changes/')).toBeChecked();
  await page.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(page.getByRole('region', { name: 'Разбор ответа' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Разбор ответа' })).toBeVisible();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByLabel('design.md — технический подход').check();
  await page.getByRole('button', { name: 'Проверить ответ' }).click();
  await page.getByRole('button', { name: 'Далее' }).click();
  const text =
    'Основные specs — текущее поведение, change specs — предлагаемые дельты. При завершении они синхронизируются.';
  await page.getByLabel('Ваш ответ', { exact: true }).fill(text);
  await page.reload();
  await expect(page.getByLabel('Ваш ответ', { exact: true })).toHaveValue(text);
  await page.request.post('/__test/fail-next', {
    data: {},
    headers: { origin: 'http://127.0.0.1:3002' },
  });
  await page.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(page.getByRole('status')).toContainText('Проверяем');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Повторить проверку' })).toBeVisible();
  await expect(page.getByLabel('Ваш ответ', { exact: true })).toHaveValue(text);
  await page.getByRole('button', { name: 'Повторить проверку' }).click();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page
    .getByLabel('Ваш ответ', { exact: true })
    .fill('Proposal — зачем; specs — поведение; design — технический подход; tasks — шаги.');
  await page.getByRole('button', { name: 'Проверить ответ' }).click();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page
    .getByLabel('Ваш ответ', { exact: true })
    .fill(
      'GIVEN сохранённая завершённая сессия. WHEN перезапускаю приложение и открываю результат. THEN вижу прежние ответы и оценки.',
    );
  await page.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(page.getByRole('heading', { name: 'Пять ответов.' })).toBeVisible();
  await expect(page.getByText('Не проверялось', { exact: true })).toHaveCount(3);
  await expect(page.getByRole('region', { name: 'Разбор ответа' })).toHaveCount(5);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Разбор ответа' })).toHaveCount(5);
  await page.getByRole('link', { name: 'К треку' }).click();
  await page.getByRole('link', { name: 'Открыть разбор' }).click();
  await expect(page.getByRole('heading', { name: 'Пять ответов.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/result-desktop.png', fullPage: true });
  const oldUrl = page.url();
  await page.getByRole('button', { name: 'Пройти ещё раз' }).click();
  await expect(page.getByText('Задание 1 из 5', { exact: true })).toBeVisible();
  expect(page.url()).not.toEqual(oldUrl);
  await page.goto(oldUrl);
  await expect(page.getByRole('region', { name: 'Разбор ответа' })).toHaveCount(5);
});
test('mobile track and keyboard access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Arc — главная' })).toBeFocused();
  await page.screenshot({ path: 'test-results/track-mobile.png', fullPage: true });
});
test('draft storage error is visible and form remains usable with keyboard', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Продолжить тренировку' }).click();
  const option = page.getByLabel('В openspec/changes/');
  await option.focus();
  await page.keyboard.press('Space');
  await expect(option).toBeChecked();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить черновик');
  await expect(page.getByRole('button', { name: 'Проверить ответ' })).toBeEnabled();
});

test('sidebar returns from practice to track sections and mobile practice fits', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Продолжить тренировку' }).click();
  await expect(page.getByText('Задание 1 из 5', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/session-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/session-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Карта навыков' }).click();
  await expect(page.getByRole('heading', { name: 'Карта навыков' })).toBeInViewport();
  await page.getByRole('link', { name: 'Мои результаты' }).click();
  await expect(page.getByRole('heading', { name: 'Ваши тренировки' })).toBeInViewport();
  await page.getByRole('link', { name: 'О треке', exact: true }).click();
  await expect(page.getByText('Материалы и расходы API')).toBeInViewport();
});
