import { store } from '../store.js';
import { utils } from '../utils.js';

export function initHandicapView() {
    const codeBlock = document.getElementById('handicap-code-block');
    const ageTableBody = document.querySelector('#handicap-age-table tbody');
    const weightTableBody = document.querySelector('#handicap-weight-table tbody');

    // Zoom Controls
    let zoomLevel = 1;
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
        zoomLevel += 0.1;
        applyZoom();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
        zoomLevel = Math.max(0.5, zoomLevel - 0.1);
        applyZoom();
    });

    function applyZoom() {
        document.documentElement.style.setProperty('--zoom-level', zoomLevel);
    }

    function render() {
        codeBlock.textContent = store.getFormulasAsString();

        // Gender Table (Dynamic)
        const genderTableBody = document.querySelector('#handicap-gender-table tbody');
        if (genderTableBody) {
            const h = store.getHandicapSettings();
            genderTableBody.innerHTML = `
                <tr><td>男性</td><td>${utils.secondsToHms(h.male)}</td></tr>
                <tr><td>女性</td><td>${utils.secondsToHms(h.female)}</td></tr>
            `;
        }

        // Use independent helpers for display consistency
        renderMultiColCheck(ageTableBody, 20, 90, 1, 3, (val) => {
            const hSec = store.calculateAgeHandicap(val);
            return `<td>${val} 歳</td><td>${utils.secondsToHms(hSec)}</td>`;
        });

        renderMultiColCheck(weightTableBody, 0, 45, 1, 3, (val) => {
            const hSec = store.calculateWeightHandicap(val);
            return `<td>${val} kg</td><td>${utils.secondsToHms(hSec)}</td>`;
        });
    }

    // Secret Section Logic
    const secretSection = document.getElementById('handicap-secret-section');
    const settingsForm = document.getElementById('handicap-settings-form');

    const showSecret = () => {
        if (secretSection) {
            secretSection.classList.remove('hidden');
            loadSettingsIntoForm();
        }
    };

    document.addEventListener('view:handicap:showSecret', showSecret);

    document.addEventListener('view:handicap:hideSecret', () => {
        if (secretSection && location.hash !== '#secret') {
            secretSection.classList.add('hidden');
        }
    });

    function loadSettingsIntoForm() {
        const h = store.settings.handicap;
        document.getElementById('h-male').value = h.male;
        document.getElementById('h-female').value = h.female;
        document.getElementById('h-age-base').value = h.ageBase || 0;
        document.getElementById('h-weight-base').value = h.weightBase || 0;
        document.getElementById('h-weight-start').value = h.weightStart || 0;

        const ageValIn = document.querySelectorAll('.h-age-val');
        const ageSecIn = document.querySelectorAll('.h-age-sec');
        (h.ageSlots || []).forEach((s, i) => {
            if (ageValIn[i]) ageValIn[i].value = s.threshold;
            if (ageSecIn[i]) ageSecIn[i].value = s.seconds;
        });

        const wValIn = document.querySelectorAll('.h-weight-val');
        const wSecIn = document.querySelectorAll('.h-weight-sec');
        (h.weightSlots || []).forEach((s, i) => {
            if (wValIn[i]) wValIn[i].value = s.threshold;
            if (wSecIn[i]) wSecIn[i].value = s.seconds;
        });
    }

    const successMsg = document.getElementById('save-success-msg');

    if (settingsForm) {
        const resetBtn = document.getElementById('btn-reset-system');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                const step1 = await utils.confirmModal("本当に全てのデータ（参加者、記録、設定）を消去して初期状態に戻しますか？");
                if (step1) {
                    const step2 = await utils.confirmModal("【最終確認】この操作は取り消せません。本当によろしいですか？");
                    if (step2) {
                        await store.resetSystem();
                        location.reload();
                    }
                }
            });
        }

        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const maleVal = document.getElementById('h-male').value;
            const femaleVal = document.getElementById('h-female').value;
            const ageBaseVal = document.getElementById('h-age-base').value;
            const weightBaseVal = document.getElementById('h-weight-base').value;
            const weightStartVal = document.getElementById('h-weight-start').value;

            const h = {
                male: Number(maleVal),
                female: Number(femaleVal),
                ageBase: Number(ageBaseVal),
                weightBase: Number(weightBaseVal),
                weightStart: Number(weightStartVal),
                ageSlots: getSlots('.h-age-val', '.h-age-sec'),
                weightSlots: getSlots('.h-weight-val', '.h-weight-sec')
            };

            await store.saveSetting('handicap', h);

            // UI Updates without reload
            render();

            // Show success message
            if (successMsg) {
                successMsg.style.opacity = '1';
                setTimeout(() => { successMsg.style.opacity = '0'; }, 3000);
            }
        });
    }

    function getSlots(valSec, secSec) {
        const vals = document.querySelectorAll(valSec);
        const secs = document.querySelectorAll(secSec);
        const res = [];

        for (let i = 0; i < vals.length; i++) {
            const v = vals[i].value;
            const s = secs[i].value;
            if (v === '' && s === '') continue;
            // No validation as requested
            res.push({ threshold: Number(v), seconds: Number(s) });
        }
        return res.sort((a, b) => a.threshold - b.threshold);
    }

    // Helper to render Multi-Column Table (Column-Major)
    function renderMultiColCheck(tbody, start, end, step, cols, rowRenderFn) {
        tbody.innerHTML = '';
        const items = [];
        for (let i = start; i <= end; i += step) items.push(i);
        const rowsPerCol = Math.ceil(items.length / cols);
        for (let r = 0; r < rowsPerCol; r++) {
            const tr = document.createElement('tr');
            let html = '';
            for (let c = 0; c < cols; c++) {
                const index = r + (c * rowsPerCol);
                if (index < items.length) {
                    html += rowRenderFn(items[index]);
                } else {
                    html += `<td></td><td></td>`;
                }
            }
            tr.innerHTML = html;
            tbody.appendChild(tr);
        }
    }

    document.addEventListener('view:handicap:active', render);
    render();
}
