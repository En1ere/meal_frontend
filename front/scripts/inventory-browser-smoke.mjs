import { qaRoot } from '../../scripts/qa-output.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as XLSX from 'xlsx';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const sharp = (await import('sharp')).default;
const EAN13Reader = createRequire(import.meta.url)('@zxing/library/cjs/core/oned/EAN13Reader.js').default;
function barcodeSvg(code) {
    const parity = EAN13Reader.FIRST_DIGIT_ENCODINGS[Number(code[0])];
    const pattern = (digit, reverse, black) => {
        const widths = Array.from(EAN13Reader.L_PATTERNS[Number(digit)]);
        if (reverse) widths.reverse();
        return widths.map((width, index) => String((index + (black ? 1 : 0)) % 2).repeat(width)).join('');
    };
    let bits = '101';
    for (let i = 1; i <= 6; i++) bits += pattern(code[i], !!(parity & (1 << (6 - i))), false);
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += pattern(code[i], false, true);
    bits += '101';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="575" height="240"><rect width="100%" height="100%" fill="white"/>${Array.from(bits, (bit, index) => (bit === '1' ? `<rect x="${50 + index * 5}" y="20" width="5" height="200" fill="black"/>` : '')).join('')}</svg>`;
}
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 1487, height: 1058 } });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [],
    results = [];
page.on('pageerror', (error) => errors.push(error.message));
const output = new URL('', qaRoot());
await mkdir(output, { recursive: true });
const goto = (path) => page.goto('http://localhost:3000' + path);
const heading = (name) => page.getByRole('heading', { name, exact: true }).first().waitFor();
const pass = (name) => {
    results.push(name);
    console.log('PASS ' + name);
};
async function shot(name) {
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => ({
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        offenders: Array.from(document.querySelectorAll('body *'))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    tag: element.tagName,
                    text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 80),
                    left: Math.round(rect.left * 100) / 100,
                    right: Math.round(rect.right * 100) / 100,
                    width: Math.round(rect.width * 100) / 100,
                };
            })
            .filter(({ left, right }) => left < -1 || right > innerWidth + 1)
            .slice(0, 20),
    }));
    assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `${name} horizontal overflow ${JSON.stringify(layout)}`);
    await page.screenshot({ path: fileURLToPath(new URL('inventory-' + name + '.png', output)), fullPage: true });
}
async function login(name) {
    await goto('/auth');
    await page.getByLabel('Электронная почта', { exact: true }).fill(name + '@meal-planner.test');
    await page.getByLabel('Пароль', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
}
async function reviewOne() {
    await page.getByRole('heading', { name: 'Проверка перед добавлением', exact: true }).waitFor();
    const product = page.getByRole('combobox', { name: /^Товар каталога/ });
    await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('select')).some((select) => select.textContent.includes('Молоко')),
    );
    await product.selectOption({ index: 1 });
    await page.getByRole('combobox', { name: /^Место хранения/ }).selectOption({ index: 1 });
    await page.getByLabel('Проверил название, совпадение, количество и дату', { exact: true }).check();
    await page.getByLabel('Добавить выбранные строки только в мои личные запасы', { exact: true }).check();
    await page.getByRole('button', { name: 'Добавить 1 партий', exact: true }).click();
    await heading('Запасы добавлены');
}
try {
    await login('user1');
    await goto('/inventory');
    await heading('Мои запасы');
    await page.getByRole('combobox', { name: /^Срок/ }).selectOption('unknown');
    await page.waitForURL('**/*attention=unknown*');
    await page.getByRole('combobox', { name: /^Срок/ }).selectOption('all');
    await shot('list-desktop');
    pass('inventory list, URL filters and desktop layout');
    await goto('/inventory/new');
    await heading('Добавить продукт в запасы');
    await page.getByLabel('Поиск в каталоге', { exact: true }).fill('Молоко');
    await page.getByRole('radio', { name: 'Молоко 2,5%', exact: true }).check();
    await page.getByLabel('Название партии', { exact: true }).fill('Browser QA milk');
    await page.getByRole('combobox', { name: /^Место хранения/ }).selectOption({ index: 1 });
    await page.getByRole('textbox', { name: 'Количество', exact: true }).fill('2');
    assert.equal(await page.locator('main form').evaluate((form) => form.checkValidity()), true);
    await page.getByRole('button', { name: 'Добавить в запасы', exact: true }).click();
    await heading('Browser QA milk');
    await page.getByText('Другие действия', { exact: true }).click();
    await page.getByRole('button', { name: 'Расход', exact: true }).click();
    await page.getByLabel(/Количество расхода/).fill('1');
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await page.getByRole('heading', { name: 'Изменить партию', exact: true }).waitFor({ state: 'hidden' });
    await shot('batch-desktop');
    pass('manual batch creation, consume and history');
    const batchUrl = page.url();
    await page.getByRole('button', { name: 'Исправить', exact: true }).click();
    await page.getByLabel('Название партии', { exact: true }).fill('Stale draft');
    const concurrent = await context.newPage();
    await concurrent.goto(batchUrl);
    await concurrent.getByRole('button', { name: 'Исправить', exact: true }).click();
    await concurrent.getByLabel('Название партии', { exact: true }).fill('Concurrent saved');
    await concurrent.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await concurrent.getByRole('heading', { name: 'Concurrent saved', exact: true }).first().waitFor();
    const staleSubmit = page.getByRole('button', { name: 'Подтвердить', exact: true });
    await Promise.race([
        staleSubmit.waitFor({ state: 'visible' }),
        page.getByText('Concurrent saved', { exact: true }).first().waitFor(),
    ]);
    if (await staleSubmit.isVisible()) {
        await staleSubmit.click();
        await page.getByRole('button', { name: 'Загрузить актуальные сведения, сохранив ввод', exact: true }).waitFor();
        assert.equal(await page.getByLabel('Название партии', { exact: true }).inputValue(), 'Stale draft');
    } else {
        assert.equal(await page.getByLabel('Название партии', { exact: true }).count(), 0);
    }
    await concurrent.close();
    pass('two-tab stale write is rejected or replaced by the live saved version');
    await goto('/inventory/locations');
    await heading('Места хранения');
    await page.getByLabel('Название', { exact: true }).fill('QA shelf');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await page.getByRole('button', { name: /QA shelf/ }).waitFor();
    pass('create private storage location');
    await goto('/inventory/history');
    await heading('История запасов');
    await shot('history-desktop');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
            ['Название', 'Количество', 'Единица', 'Срок годности', 'Место хранения'],
            ['Молоко', '1', 'л', '', ''],
        ]),
        'Products',
    );
    for (const extension of ['csv', 'xlsx', 'ods']) {
        const buffer =
            extension === 'csv'
                ? Buffer.from('Название;Количество;Единица;Срок годности;Место хранения\nМолоко;1;л;;\n')
                : XLSX.write(workbook, { type: 'buffer', bookType: extension, compression: true });
        await goto('/inventory/import');
        await heading('Импорт запасов из таблицы');
        await page.getByLabel('Таблица', { exact: true }).setInputFiles({
            name: 'inventory.' + extension,
            mimeType: extension === 'csv' ? 'text/csv' : 'application/octet-stream',
            buffer,
        });
        await page.getByRole('button', { name: 'Загрузить и проверить', exact: true }).click();
        await page.getByRole('button', { name: 'К исправлению строк', exact: true }).waitFor();
        if (extension === 'csv') await shot('import-mapping-desktop');
        await page.getByRole('button', { name: 'К исправлению строк', exact: true }).click();
        await reviewOne();
        pass('actual ' + extension.toUpperCase() + ' worker parse, review and atomic commit');
    }
    await goto('/products/new');
    await heading('Предложить новый продукт');
    await page.getByLabel('Название', { exact: true }).fill('Молоко QA private');
    await page.getByRole('combobox', { name: /^Категория/ }).selectOption({ index: 1 });
    await page.locator('input[name=barcode]').fill('4006381333931');
    await page.getByRole('button', { name: 'Создать и отправить на проверку', exact: true }).click();
    await heading('Молоко QA private');
    const privateProductUrl = page.url();
    await page.getByText(/Ваш продукт ожидает проверки модератором/).waitFor();
    await shot('product-pending-desktop');
    pass('new product author can view before moderation');
    await goto('/inventory/scan');
    await heading('Фото и штрихкод');
    await page.getByLabel('Введите штрихкод вручную', { exact: true }).fill('4006381333931');
    await page.getByRole('button', { name: 'Найти совпадение и проверить', exact: true }).click();
    await page.getByRole('combobox', { name: /^Товар каталога/ }).selectOption({ index: 1 });
    assert.equal(await page.getByLabel('Название', { exact: true }).inputValue(), 'Молоко QA private');
    pass('manual barcode matches own pending product');
    await goto('/inventory/scan');
    await heading('Фото и штрихкод');
    const barcodeImage = await sharp(Buffer.from(barcodeSvg('4006381333931')))
        .png()
        .toBuffer();
    await page
        .getByLabel('Загрузить фото', { exact: true })
        .setInputFiles({ name: 'barcode.png', mimeType: 'image/png', buffer: barcodeImage });
    await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('input')).some((input) => input.value === '4006381333931'),
    );
    pass('uploaded EAN13 image decoded locally by ZXing');
    await goto('/inventory/scan');
    await heading('Фото и штрихкод');
    const buffer = await sharp(
        Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="500"><rect width="100%" height="100%" fill="white"/><text x="80" y="180" font-family="Arial" font-size="100" fill="black">MILK 1 LITRE</text><text x="80" y="350" font-family="Arial" font-size="70" fill="black">Fresh whole milk</text></svg>',
        ),
    )
        .png()
        .toBuffer();
    await page
        .getByLabel('Загрузить фото', { exact: true })
        .setInputFiles({ name: 'milk.png', mimeType: 'image/png', buffer });
    await page.getByRole('button', { name: 'Распознать выбранные фото', exact: true }).click();
    await page.getByRole('heading', { name: 'Результат распознавания', exact: true }).waitFor({ timeout: 120000 });
    assert.match(await page.getByRole('textbox', { name: /^Распознанный текст/ }).inputValue(), /MILK/i);
    await shot('scan-ocr-desktop');
    pass('real local rus+eng OCR recognises uploaded image');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
        if (!matchMedia('(width <= 900px)').matches) return false;
        const workspace = document.querySelector('[class*="workspace"]');
        return !workspace || parseFloat(getComputedStyle(workspace).marginInlineStart) === 0;
    });
    await shot('scan-mobile');
    await goto('/inventory/import');
    await heading('Импорт запасов из таблицы');
    await shot('import-mobile');
    await goto('/inventory');
    await heading('Мои запасы');
    await shot('list-mobile');
    pass('mobile scan/import/inventory without overflow');
    await page.setViewportSize({ width: 1487, height: 1058 });
    await page.waitForFunction(() => {
        if (!matchMedia('(width > 900px)').matches) return false;
        const workspace = document.querySelector('[class*="workspace"]');
        return !workspace || parseFloat(getComputedStyle(workspace).marginInlineStart) > 0;
    });
    await goto('/settings/account');
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await login('user2');
    await page.goto(privateProductUrl);
    await heading('Запись недоступна');
    pass('pending product private from second user in same mock database');
    assert.deepEqual(errors, []);
} catch (error) {
    console.log('FAILED URL', page.url());
    console.log((await page.locator('body').innerText()).slice(0, 6000));
    await page.screenshot({ path: fileURLToPath(new URL('inventory-failure.png', output)), fullPage: true });
    throw error;
} finally {
    await writeFile(new URL('inventory-browser-results.json', output), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
}
