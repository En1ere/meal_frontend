import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayField, displayStatus } from '../src/features/admin/display-values.js';

await test('payment display preserves exact minor units, zero and missing values', () => {
    const amount = (value: string | null, currency?: string) => {
        const field = { key: 'amount_minor', label: 'Сумма в минимальных единицах', value };
        return displayField(field, [
            field,
            ...(currency ? [{ key: 'currency', label: 'Валюта', value: currency }] : []),
        ]);
    };
    assert.deepEqual(amount('29900', 'RUB'), { label: 'Сумма', value: '299,00 ₽' });
    assert.equal(amount('0', 'RUB').value, '0,00 ₽');
    assert.equal(amount('-1', 'RUB').value, '-0,01 ₽');
    assert.equal(amount('9007199254740991', 'RUB').value, '90071992547409,91 ₽');
    for (const value of ['9007199254740992', '1e3', '0.5', '']) {
        assert.deepEqual(amount(value, 'RUB'), { label: 'Сумма в минимальных единицах', value });
    }
    for (const currency of [undefined, 'XXX', 'RUB ', 'JPY']) {
        assert.deepEqual(amount('29900', currency), { label: 'Сумма в минимальных единицах', value: '29900' });
    }
    assert.equal(amount(null, 'RUB').value, 'Нет данных');
});

await test('unknown status values and free text remain literal', () => {
    assert.equal(displayStatus('pending'), 'Ожидает');
    assert.equal(displayStatus('not_pending'), 'not_pending');
    assert.equal(displayStatus('constructor'), 'constructor');
    assert.equal(displayField({ key: 'reason', label: 'Причина', value: 'pending' }, []).value, 'pending');
});
