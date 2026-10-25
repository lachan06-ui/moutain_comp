import { store } from '../store.js';
import { utils } from '../utils.js';

export function initRecordsView() {
    const tableBody = document.getElementById('records-tbody');
    const btnAddRow = document.getElementById('btn-add-record-row');
    const btnDeleteAll = document.getElementById('btn-delete-all-records');

    // Input References (Legacy fallback or cleanup? We use Excel style now)

    if (btnAddRow) {
        btnAddRow.addEventListener('click', async () => {
            const newRecord = {
                participantId: '',
                weight: 0,
                startTime: '',
                endTime: '',
                isManualEdit: false
            };
            await store.addRecord(newRecord);
            // renderTable called by addRecord -> refresh? No, store calls db, then we need to call render?
            // store.addRecord calls await this.refresh().
            // But it doesn't trigger view event automatically unless we set up a listener for store changes?
            // Existing logic: renderTable() is manual.
            renderTable();
        });
    }

    if (btnDeleteAll) {
        btnDeleteAll.addEventListener('click', async () => {
            if (await utils.confirmModal('すべての記録を削除しますか？\n（成績ページもロックされます）')) {
                await store.clearAllRecords();
                await store.saveSetting('isResultsUnlocked', false);
                if (window.app) window.app.updateNavState();
                renderTable();
            }
        });
    }

    const btnSummarize = document.getElementById('btn-summarize');
    if (btnSummarize) {
        btnSummarize.addEventListener('click', async () => {
            if (await utils.confirmModal('集計して成績を確認しますか？', {
                confirmLabel: 'はい',
                cancelLabel: 'いいえ',
                isDanger: false
            })) {
                await store.saveSetting('isResultsUnlocked', true);
                if (window.app) {
                    window.app.updateNavState();
                    window.app.router('results');
                }
            }
        });
    }

    function renderTable() {
        if (!tableBody) return; // Safety
        tableBody.innerHTML = '';
        const records = store.records;
        const sorted = [...records].sort((a, b) => b.id - a.id);

        sorted.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'excel-row';

            // Participant Select
            const pSelect = document.createElement('select');
            pSelect.className = 'excel-input';
            pSelect.innerHTML = '<option value="">選択...</option>';
            // Sort participants by age descending
            const sortedParticipants = [...store.participants].sort((a, b) => {
                const ageA = utils.calculateAge(a.dob, store.settings.eventDate) || 0;
                const ageB = utils.calculateAge(b.dob, store.settings.eventDate) || 0;
                return ageB - ageA;
            });

            sortedParticipants.forEach(p => {
                // Only show attending participants, or the one currently assigned to this record
                if (p.id === r.participantId || p.isAttending !== false) {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.name;
                    if (p.id === r.participantId) opt.selected = true;
                    pSelect.appendChild(opt);
                }
            });
            pSelect.addEventListener('change', (e) => updateField(r.id, 'participantId', Number(e.target.value)));

            // Weight Input
            const wInput = document.createElement('input');
            wInput.type = 'number';
            wInput.className = 'excel-input';
            wInput.value = r.weight;
            wInput.min = 0;
            wInput.step = 1;
            wInput.addEventListener('change', (e) => {
                let val = e.target.value;
                if (val === '') val = 0;
                let intVal = Math.floor(Number(val));
                if (intVal < 0) intVal = 0;
                e.target.value = intVal;
                updateField(r.id, 'weight', intVal);
            });

            // Start/End Time
            const startDiv = createTimeInput(r.id, 'startTime', r.startTime, r.isManualEdit);
            const endDiv = createTimeInput(r.id, 'endTime', r.endTime, r.isManualEdit);

            // Manual Badge
            const noteCell = document.createElement('td');
            if (r.isManualEdit) {
                noteCell.innerHTML = '<span style="color:var(--accent); font-size:0.8rem; border:1px solid currentColor; padding:1px 4px; border-radius:4px;">手動修正</span>';
            }

            // Delete
            const delBtn = document.createElement('button');
            delBtn.textContent = '削除';
            delBtn.className = 'btn-delete-rec';
            delBtn.style.color = 'red';
            delBtn.style.background = 'none';
            delBtn.style.border = 'none';
            delBtn.style.cursor = 'pointer';
            delBtn.addEventListener('click', async () => {
                const p = store.getParticipant(r.participantId);
                const name = p ? p.name : 'この';
                if (await utils.confirmModal(`${name} 記録を削除しますか？`)) {
                    await store.deleteRecord(r.id);
                    renderTable();
                }
            });

            const tdP = document.createElement('td'); tdP.appendChild(pSelect);
            const tdW = document.createElement('td'); tdW.appendChild(wInput);
            const tdS = document.createElement('td'); tdS.appendChild(startDiv);
            const tdE = document.createElement('td'); tdE.appendChild(endDiv);
            const tdD = document.createElement('td'); tdD.appendChild(delBtn);

            tr.appendChild(tdP);
            tr.appendChild(tdW);
            tr.appendChild(tdS);
            tr.appendChild(tdE);
            tr.appendChild(noteCell);
            tr.appendChild(tdD);

            tableBody.appendChild(tr);
        });
    }

    function createTimeInput(id, field, value, isManual) {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '4px';
        container.style.alignItems = 'center';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'excel-input';
        input.style.width = '90px';
        input.placeholder = 'HH:mm:ss';
        input.value = value || '';

        input.addEventListener('change', (e) => {
            updateField(id, field, e.target.value, true);
        });

        const btnNow = document.createElement('button');
        btnNow.textContent = '今';
        btnNow.className = 'btn btn-accent';
        btnNow.style.padding = '0.2rem 0.5rem';
        btnNow.style.fontSize = '0.8rem';

        if (value) btnNow.disabled = true;

        btnNow.addEventListener('click', () => {
            const now = utils.nowString();
            input.value = now;
            btnNow.disabled = true;
            updateField(id, field, now, false);
        });

        container.appendChild(input);
        container.appendChild(btnNow);
        return container;
    }

    async function updateField(id, field, value, isManualAction = null) {
        // FIX: Use store.records instead of store.db.getAll
        const record = store.records.find(r => r.id === id);
        if (!record) return;

        record[field] = value;

        if (isManualAction === true) {
            record.isManualEdit = true;
        }
        if (isManualAction === false) {
            // record.isManualEdit = false; // Optional logic
        }

        await store.updateRecord(record);
        renderTable();
    }

    document.addEventListener('view:records:active', () => {
        renderTable();
    });

    renderTable();
}
