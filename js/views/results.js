import { store } from '../store.js';

export function initResultsView() {
    const tableBody = document.querySelector('#results-table tbody');
    const eventNameDisplay = document.getElementById('res-event-name');
    const eventDateDisplay = document.getElementById('res-event-date');

    // Filters
    const sortRadios = document.getElementsByName('sort-order');
    const filterStudent = document.getElementById('filter-student');
    const filterOB = document.getElementById('filter-ob');

    function render() {
        // Update Header
        eventNameDisplay.textContent = store.settings.eventName || '大会名未設定';
        eventDateDisplay.textContent = store.settings.eventDate || '日付未設定';

        // Get Base Data
        let results = store.getCalculatedResults();

        if (results.length === 0) {
            results = [
                {
                    participant: {
                        name: '山田 太郎',
                        isStudent: false,
                        gender: 'male',
                        age: 31
                    },
                    weight: 20,
                    handicapTime: 1800,
                    baseTime: 2100,
                    handicapTimeStr: '0:30:00',
                    baseTimeStr: '0:35:00'
                },
                {
                    participant: {
                        name: '佐藤 花子',
                        isStudent: true,
                        gender: 'female',
                        age: 23,
                        joinedYear: 2021
                    },
                    weight: 15,
                    handicapTime: 1900,
                    baseTime: 2200,
                    handicapTimeStr: '0:31:40',
                    baseTimeStr: '0:36:40'
                }
            ];
        }

        // 1. Filter
        const showStudent = filterStudent.checked;
        const showOB = filterOB.checked;

        results = results.filter(r => {
            if (r.participant.isStudent) return showStudent;
            return showOB;
        });

        // 2. Determine Sort Mode
        let sortMode = 'handicap';
        for (const r of sortRadios) {
            if (r.checked) {
                sortMode = r.value;
                break;
            }
        }

        // 3. Sort
        results.sort((a, b) => {
            if (sortMode === 'handicap') {
                return a.handicapTime - b.handicapTime;
            } else {
                return a.baseTime - b.baseTime;
            }
        });

        // 4. Render Table
        tableBody.innerHTML = '';

        if (results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">データがありません</td></tr>';
            return;
        }

        results.forEach((r, index) => {
            const tr = document.createElement('tr');

            let typeStr = 'OB';
            if (r.participant.isStudent) {
                const eventYear = store.settings.eventDate ? new Date(store.settings.eventDate).getFullYear() : new Date().getFullYear();
                const joinedYear = Number(r.participant.joinedYear) || eventYear;
                const stu_year = eventYear - joinedYear + 1;
                typeStr = `学生 (${stu_year}回生)`;
            }
            const genderStr = r.participant.gender === 'male' ? '男' : '女';

            // styles for bolding
            const handicapStyle = sortMode === 'handicap' ? 'font-weight:bold;' : '';
            const rawStyle = sortMode === 'raw' ? 'font-weight:bold;' : 'color:var(--text-light);';

            tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${r.participant.name}</td>
        <td>${typeStr}</td>
        <td>${genderStr}</td>
        <td>${r.participant.age}</td>
        <td>${r.weight}kg</td>
        <td style="${handicapStyle}">${r.handicapTimeStr}</td>
        <td style="${rawStyle}">${r.baseTimeStr}</td>
      `;
            tableBody.appendChild(tr);
        });
    }

    // Listeners
    [filterStudent, filterOB].forEach(el => el.addEventListener('change', render));
    sortRadios.forEach(el => el.addEventListener('change', render));

    // Lifecycle
    document.addEventListener('view:results:active', () => {
        store.refresh().then(render);
    });
}
