export const utils = {
    isValidTimeFormat(str) {
        return /^([0-1]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/.test(str);
    },

    calculateAge(dobStr, refDateStr) {
        if (!dobStr) return '';
        const dob = new Date(dobStr);
        const ref = refDateStr ? new Date(refDateStr) : new Date();

        let age = ref.getFullYear() - dob.getFullYear();
        const m = ref.getMonth() - dob.getMonth();

        if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    },

    nowString() {
        const d = new Date();
        return `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`;
    },

    pad(num) {
        return num.toString().padStart(2, '0');
    },

    timeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        if (parts.length !== 3) return 0;
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    },

    secondsToTime(totalSeconds) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${h}:${this.pad(m)}:${this.pad(s)}`;
    },

    // Format seconds to hh:mm:ss for Handicap Table (+/-)
    secondsToHms(totalSeconds) {
        const isNeg = totalSeconds < 0;
        const abs = Math.abs(totalSeconds);
        const h = Math.floor(abs / 3600);
        const m = Math.floor((abs % 3600) / 60);
        const s = Math.floor(abs % 60);
        return `${isNeg ? '-' : '+'}${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
    },

    $(selector) {
        return document.querySelector(selector);
    },

    // Custom Modal Helper
    // Returns Promise<boolean>
    confirmModal(message, options = {}) {
        const { confirmLabel = '削除', cancelLabel = 'キャンセル', isDanger = true } = options;

        return new Promise((resolve) => {
            const modal = document.getElementById('confirmation-modal');
            const msgEl = document.getElementById('modal-message');
            const btnYes = document.getElementById('modal-confirm');
            const btnNo = document.getElementById('modal-cancel');

            msgEl.textContent = message;
            btnYes.textContent = confirmLabel;
            btnNo.textContent = cancelLabel;

            if (isDanger) {
                btnYes.classList.add('btn-danger');
            } else {
                btnYes.classList.remove('btn-danger');
                btnYes.classList.add('btn-primary');
            }

            modal.classList.add('active');

            const cleanup = () => {
                modal.classList.remove('active');
                btnYes.removeEventListener('click', onYes);
                btnNo.removeEventListener('click', onNo);
            };

            const onYes = () => {
                cleanup();
                resolve(true);
            };

            const onNo = () => {
                cleanup();
                resolve(false);
            };

            btnYes.addEventListener('click', onYes);
            btnNo.addEventListener('click', onNo);
        });
    }
};
