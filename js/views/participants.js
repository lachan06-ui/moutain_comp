import { store } from '../store.js';
import { utils } from '../utils.js';

export function initParticipantsView() {
    const tableBody = document.querySelector('#participant-table tbody');
    const btnAddRow = document.getElementById('btn-add-participant-row');
    const btnSync = document.getElementById('btn-sync-participants'); // 保存ボタン
    const btnImport = document.getElementById('btn-import-participants'); // 【追加】読み込みボタン
    const inputImportJson = document.getElementById('input-import-json'); // 【追加】隠しファイル選択
    const eventNameInput = document.getElementById('event-name');
    const eventDateInput = document.getElementById('event-date');

    async function loadEventInfo() {
        if (store.settings.eventName) eventNameInput.value = store.settings.eventName;
        if (store.settings.eventDate) eventDateInput.value = store.settings.eventDate;
    }

    if (btnSync) {
        btnSync.addEventListener('click', async () => {
            if (await utils.confirmModal('名簿ファイルを出力しますか？', {
                confirmLabel: 'はい',
                cancelLabel: 'いいえ'
            })) {
                exportToJson();
            }
        });
    }

    function exportToJson() {
        // Sort by age descending for export
        const sorted = [...store.participants].sort((a, b) => {
            const ageA = utils.calculateAge(a.dob, store.settings.eventDate) || 0;
            const ageB = utils.calculateAge(b.dob, store.settings.eventDate) || 0;
            return ageB - ageA;
        });

        const columns = ["name", "gender", "dob", "category", "joinedYear"];
        const rows = sorted.map(p => [
            p.name,
            p.gender,
            p.dob,
            p.isStudent ? 'student' : 'ob',
            p.joinedYear
        ]);

        const data = { columns, rows };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'participants.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

     if (btnImport && inputImportJson) {
        // 見た目のボタンがクリックされたら、隠れているファイル選択画面を起動
        btnImport.addEventListener('click', () => {
            inputImportJson.click();
        });

        // ファイルが選択されたときの処理
        inputImportJson.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    // 最低限のデータ整合性チェック (columnsとrowsがあるか)
                    if (!data.columns || !Array.isArray(data.rows)) {
                        throw new Error('不適切なファイル形式です。');
                    }

                    if (await utils.confirmModal('ファイルから名簿データを読み込みます。現在の名簿は完全に消去され、上書きされますがよろしいですか？', {
                        confirmLabel: '読み込む',
                        cancelLabel: 'キャンセル'
                    })) {

                        // --- 【超重要：ここを追加】既存の名簿データをすべて削除して空っぽにする ---
                        // storeに専用の全削除メソッド（clearParticipantsなど）がある場合はそちらを優先してください。
                        // ない場合は、以下のように現在の参加者IDを使って安全にすべて削除します。
                        if (store.participants && store.participants.length > 0) {
                            // ループ中に配列の長さが変わるのを防ぐため、IDのコピーを作って1件ずつ消去
                            const participantIds = store.participants.map(p => p.id);
                            for (const id of participantIds) {
                                // storeに deleteParticipant や removeParticipant があると想定されます
                                if (typeof store.deleteParticipant === 'function') {
                                    await store.deleteParticipant(id);
                                } else if (typeof store.removeParticipant === 'function') {
                                    await store.removeParticipant(id);
                                }
                            }
                            // 万が一上記メソッドで消しきれない場合の強制クリア（storeの仕様による）
                            if (store.participants.length > 0) {
                                store.participants = [];
                            }
                        }

                        // columnsのインデックス位置を確認
                        const idxName = data.columns.indexOf('name');
                        const idxGender = data.columns.indexOf('gender');
                        const idxDob = data.columns.indexOf('dob');
                        const idxCategory = data.columns.indexOf('category');
                        const idxJoinedYear = data.columns.indexOf('joinedYear');

                        for (const row of data.rows) {
                            const newParticipant = {
                                isAttending: false, // 読み込み時はデフォルトで参加チェック
                                name: row[idxName] || '',
                                gender: row[idxGender] || 'male',
                                dob: row[idxDob] || '',
                                isStudent: row[idxCategory] === 'student',
                                joinedYear: row[idxJoinedYear] || new Date().getFullYear()
                            };
                            await store.addParticipant(newParticipant);
                        }

                        // テーブルの再描画
                        renderTable();
                        
                        // 選択されたファイルをリセット（同じファイルを連続で読み込めるようにする）
                        inputImportJson.value = '';
                        
                        alert('名簿ファイルの読み込み（上書き）が完了しました。');
                    }
                } catch (error) {
                    alert('ファイルの読み込みに失敗しました。正しい名簿ファイル（.json）を選択してください。');
                    inputImportJson.value = '';
                }
            };
            reader.readAsText(file);
        });
    }

    eventNameInput.addEventListener('change', (e) => store.saveSetting('eventName', e.target.value));

    const formatDob = (val) => {
        if (!val) return '';
        // Remove non-digits
        let d = val.replace(/\D/g, '');
        if (d.length === 6) {
            // YYMMDD -> YYYY-MM-DD (Assume 1900s for 40+, 2000s for 00-39)
            let yy = parseInt(d.substring(0, 2));
            let year = (yy < 40 ? 2000 : 1900) + yy;
            return `${year}-${d.substring(2, 4)}-${d.substring(4, 6)}`;
        }
        if (d.length === 8) {
            // YYYYMMDD -> YYYY-MM-DD
            return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
        }
        // If it already has dashes or slashes, try to normalize
        let parts = val.split(/[-/]/);
        if (parts.length === 3) {
            let y = parts[0], m = parts[1], d = parts[2];
            if (y.length === 2) y = (parseInt(y) < 40 ? 2000 : 1900) + parseInt(y);
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return val;
    };

    eventDateInput.addEventListener('blur', (e) => {
        const formatted = formatDob(e.target.value);
        if (formatted !== e.target.value) {
            e.target.value = formatted;
            store.saveSetting('eventDate', formatted);
            renderTable();
        }
    });

    eventDateInput.addEventListener('change', async (e) => {
        await store.saveSetting('eventDate', e.target.value);
        renderTable();
    });

    if (btnAddRow) {
        btnAddRow.addEventListener('click', async () => {
            const newParticipant = {
                isAttending: false,
                name: '',
                gender: 'male',
                dob: '',
                isStudent: false,
                joinedYear: new Date().getFullYear()
            };
            await store.addParticipant(newParticipant);
            renderTable();
        });
    }

    function renderTable() {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const participants = store.participants;

        // Sort by Age (descending)
        const sorted = [...participants].sort((a, b) => {
            const ageA = utils.calculateAge(a.dob, store.settings.eventDate) || 0;
            const ageB = utils.calculateAge(b.dob, store.settings.eventDate) || 0;
            return ageB - ageA;
        });

        sorted.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = 'excel-row';

            // Participation Checkbox
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.checked = p.isAttending !== false;
            check.addEventListener('change', (e) => updateField(p.id, 'isAttending', e.target.checked));

            // Name
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'excel-input';
            nameInput.value = p.name || '';
            nameInput.placeholder = '氏名';
            nameInput.addEventListener('change', (e) => updateField(p.id, 'name', e.target.value));

            // Gender
            const genderSelect = document.createElement('select');
            genderSelect.className = 'excel-input';
            genderSelect.innerHTML = `
                <option value="male" ${p.gender === 'male' ? 'selected' : ''}>男</option>
                <option value="female" ${p.gender === 'female' ? 'selected' : ''}>女</option>
            `;
            genderSelect.addEventListener('change', (e) => updateField(p.id, 'gender', e.target.value));

            // DOB (Changed to text for manual entry + Smart Formatter)
            const dobInput = document.createElement('input');
            dobInput.type = 'text';
            dobInput.className = 'excel-input';
            dobInput.value = p.dob || '';
            dobInput.placeholder = 'YYYY-MM-DD';

            dobInput.addEventListener('blur', (e) => {
                const formatted = formatDob(e.target.value);
                if (formatted !== e.target.value) {
                    e.target.value = formatted;
                    updateField(p.id, 'dob', formatted);
                }
            });

            dobInput.addEventListener('change', (e) => {
                updateField(p.id, 'dob', e.target.value);
            });

            // Age (Auto)
            const age = utils.calculateAge(p.dob, store.settings.eventDate);

            // Type (OB/Student)
            const typeSelect = document.createElement('select');
            typeSelect.className = 'excel-input';
            typeSelect.innerHTML = `
                <option value="ob" ${!p.isStudent ? 'selected' : ''}>OB</option>
                <option value="student" ${p.isStudent ? 'selected' : ''}>学生</option>
            `;
            typeSelect.addEventListener('change', (e) => {
                updateField(p.id, 'isStudent', e.target.value === 'student');
            });

            // Joined Year
            const yearInput = document.createElement('input');
            yearInput.type = 'number';
            yearInput.className = 'excel-input';
            yearInput.value = p.joinedYear || '';
            yearInput.placeholder = '2024';
            yearInput.addEventListener('change', (e) => updateField(p.id, 'joinedYear', Number(e.target.value)));

            // Delete
            const delBtn = document.createElement('button');
            delBtn.textContent = '削除';
            delBtn.className = 'btn-delete';
            delBtn.style.color = 'red';
            delBtn.style.background = 'none';
            delBtn.style.border = 'none';
            delBtn.style.cursor = 'pointer';
            delBtn.addEventListener('click', async () => {
                const name = p.name || 'この';
                if (await utils.confirmModal(`${name} を名簿から削除しますか？`)) {
                    await store.deleteParticipant(p.id);
                    renderTable();
                }
            });

            const tdCheck = document.createElement('td'); tdCheck.appendChild(check);
            const tdName = document.createElement('td'); tdName.appendChild(nameInput);
            const tdGen = document.createElement('td'); tdGen.appendChild(genderSelect);
            const tdDob = document.createElement('td'); tdDob.appendChild(dobInput);
            const tdAge = document.createElement('td'); tdAge.textContent = age !== '' ? age : '-';
            const tdType = document.createElement('td'); tdType.appendChild(typeSelect);
            const tdYear = document.createElement('td'); tdYear.appendChild(yearInput);
            const tdDel = document.createElement('td'); tdDel.appendChild(delBtn);

            tr.appendChild(tdCheck);
            tr.appendChild(tdName);
            tr.appendChild(tdGen);
            tr.appendChild(tdDob);
            tr.appendChild(tdAge);
            tr.appendChild(tdType);
            tr.appendChild(tdYear);
            tr.appendChild(tdDel);

            tableBody.appendChild(tr);
        });
    }

    document.addEventListener('view:participants:showSync', () => {
        if (btnSync) btnSync.classList.remove('hidden');
    });

    document.addEventListener('view:participants:hideSync', () => {
        if (btnSync) btnSync.classList.add('hidden');
    });

    async function updateField(id, field, value) {
        const p = store.participants.find(item => item.id === id);
        if (!p) return;
        p[field] = value;
        await store.updateParticipant(p);
        renderTable();
    }

    document.addEventListener('view:participants:active', () => {
        loadEventInfo();
        renderTable();
    });

    loadEventInfo();
    renderTable();
}
