import { db } from './db.js';
import { utils } from './utils.js';

export const store = {
    participants: [],
    records: [],
    settings: {},

    
async init() {
    await db.open();
    await this.refresh();

    // 既存の参加者データがある場合は何もしない
    if (this.participants.length > 0) return;

    let loadedFromJson = false;

    // まず participants.json を読み込む
    try {
        const res = await fetch('participants.json');

        if (res.ok) {
            const data = await res.json();

            if (Array.isArray(data.columns) && Array.isArray(data.rows)) {
                const idxName = data.columns.indexOf('name');
                const idxGender = data.columns.indexOf('gender');
                const idxDob = data.columns.indexOf('dob');
                const idxCat = data.columns.indexOf('category');
                const idxYear = data.columns.indexOf('joinedYear');

                if (idxName >= 0) {
                    for (const row of data.rows) {
                        await db.add('participants', {
                            isAttending: true,
                            name: row[idxName] || '',
                            gender: row[idxGender] || 'male',
                            dob: row[idxDob] || '',
                            isStudent: idxCat >= 0 && row[idxCat] === 'student',
                            joinedYear: Number(row[idxYear]) || new Date().getFullYear()
                        });
                    }
                    loadedFromJson = data.rows.length > 0;
                }
            }
        }
    } catch (err) {
        console.warn('participants.json not found.');
    }

    // JSONがなければダミー参加者を登録
    if (!loadedFromJson) {
        const dummyParticipants = [
            {
                isAttending: true,
                name: '山田 太郎',
                gender: 'male',
                dob: '1995-05-10',
                isStudent: false,
                joinedYear: 2015
            },
            {
                isAttending: true,
                name: '佐藤 花子',
                gender: 'female',
                dob: '2002-08-20',
                isStudent: true,
                joinedYear: 2021
            },
            {
                isAttending: true,
                name: '鈴木 一郎',
                gender: 'male',
                dob: '1985-03-15',
                isStudent: false,
                joinedYear: 2005
            }
        ];

        for (const participant of dummyParticipants) {
            await db.add('participants', participant);
        }
    }

    await this.refresh();
},


    async refresh() {
        this.participants = await db.getAll('participants');
        this.records = await db.getAll('records');

        // Load Settings
        const settings = await db.get('settings', 'global');
        if (settings) {
            this.settings = { ...this.settings, ...settings.value };
        } else {
            // Default Settings
            this.settings = {
                eventName: '',
                eventDate: '',
                isResultsUnlocked: false,
                handicap: {
                    male: 0,
                    female: -240,
                    ageBase: 250,
                    ageSlots: [{ threshold: 20, seconds: -10 }, { threshold: 40, seconds: -5 }, { threshold: 50, seconds: -10 }, { threshold: 60, seconds: -15 }, { threshold: 70, seconds: -20 }],
                    weightBase: -240,
                    weightStart: 10,
                    weightSlots: [{ threshold: 10, seconds: -30 }, { threshold: 16, seconds: -60 }, { threshold: 35, seconds: -120 }]
                }
            };
        }
    },

    // --- Participants ---
    async addParticipant(p) {
        await db.add('participants', p);
        await this.refresh();
    },

    async updateParticipant(p) {
        await db.put('participants', p);
        await this.refresh();
    },

    async deleteParticipant(id) {
        await db.delete('participants', id);
        await this.refresh();
    },

    getParticipant(id) {
        const idNum = Number(id); // Ensure number
        return this.participants.find(p => p.id === idNum);
    },

    // --- Records ---
    async addRecord(r) {
        await db.add('records', r);
        await this.refresh();
    },

    async updateRecord(r) {
        await db.put('records', r);
        await this.refresh();
    },

    async deleteRecord(id) {
        await db.delete('records', id);
        await this.refresh();
    },

    async clearAllRecords() {
        await db.clear('records');
        await this.refresh();
    },

    async saveSetting(key, value) {
        this.settings[key] = value;
        await db.put('settings', { key: 'global', value: this.settings });
    },

    async resetSystem() {
        await db.clear('participants');
        await db.clear('records');
        await db.clear('settings');
    },

    // --- Handicap Helpers ---
    getHandicapSettings() {
        const defaults = {
            male: 0,
            female: -600,
            ageBase: 0,
            ageSlots: [],
            weightBase: 0,
            weightStart: 0,
            weightSlots: []
        };
        return { ...defaults, ...(this.settings.handicap || {}) };
    },

    // --- Calculations ---
    calculateHandicapSec(gender, age, weight, isStudent = false) {
        const h = this.getHandicapSettings();
        let total = 0;

        // Gender
        total += (gender === 'female') ? Number(h.female) : Number(h.male);

        // Age (Students get 0 age handicap)
        if (!isStudent) total += this.calculateAgeHandicap(age);

        // Weight
        total += this.calculateWeightHandicap(weight);

        return total;
    },

    calculateAgeHandicap(age) {
        if (typeof age !== 'number') return 0;
        const h = this.getHandicapSettings();
        return Number(h.ageBase) + this._calculateSlotHandicap(age, h.ageSlots);
    },

    calculateWeightHandicap(weight) {
        if (typeof weight !== 'number') return 0;
        const h = this.getHandicapSettings();
        const start = Number(h.weightStart);
        const base = Number(h.weightBase);

        // If weight is less than start threshold, no handicap is applied
        if (weight < start) return 0;

        return base + this._calculateSlotHandicap(weight, h.weightSlots);
    },

    _calculateSlotHandicap(value, slots) {
        if (!slots || slots.length === 0) return 0;
        const sorted = [...slots].sort((a, b) => a.threshold - b.threshold);

        // If smaller than the smallest threshold, return 0
        if (value < sorted[0].threshold) return 0;

        let totalHandicap = 0;
        for (let i = 0; i < sorted.length; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            if (value >= current.threshold) {
                // Determine the range for this specific slot rate
                const start = current.threshold;
                // If there's a next slot, this slot applies up to the next threshold
                const end = next ? Math.min(value, next.threshold) : value;

                // Width calculation (Exclusive end for steps)
                // e.g., 10kg to 11kg = 1kg distance
                totalHandicap += (end - start) * current.seconds;
            } else {
                break; // No more slots applicable
            }
        }
        return totalHandicap;
    },

    getCalculatedResults() {
        return this.records.map(record => {
            const participant = this.getParticipant(record.participantId);
            if (!participant) return null;

            const startSec = utils.timeToSeconds(record.startTime);
            const endSec = utils.timeToSeconds(record.endTime);
            let baseTime = endSec - startSec;

            if (baseTime < 0) {
                baseTime += 86400;
            }

            const currentAge = utils.calculateAge(participant.dob, this.settings.eventDate);
            const hSec = this.calculateHandicapSec(participant.gender, currentAge, record.weight, participant.isStudent);
            const handicapTime = baseTime + hSec;

            return {
                ...record,
                participant: { ...participant, age: currentAge },
                baseTime,
                handicapTime,
                baseTimeStr: utils.secondsToTime(baseTime),
                handicapTimeStr: utils.secondsToTime(Math.max(0, handicapTime)),
                formattedWeight: record.weight + 'kg'
            };
        }).filter(r => r !== null);
    },

    getFormulasAsString() {
        const h = this.getHandicapSettings();
        let str = `性別: 男性 ${h.male}s, 女性 ${h.female}s\n`;
        if (h.ageSlots && h.ageSlots.length > 0) {
            str += `年齢 (初期値: ${h.ageBase}s):\n`;
            str += h.ageSlots.map(s => `  ${s.threshold}歳〜: 1歳につき ${s.seconds}s`).join('\n') + "\n";
            str += `  計算式: 初期値 + (スロット累計)\n`;
        }
        if (h.weightSlots && h.weightSlots.length > 0) {
            str += `重量 (開始点: ${h.weightStart}kg, 初期値: ${h.weightBase}s):\n`;
            str += `  ※ ${h.weightStart}kg未満はハンデなし(0s)\n`;
            str += h.weightSlots.map(s => `  ${s.threshold}kg〜: 1kgにつき ${s.seconds}s`).join('\n') + "\n";
            str += `  計算式: 初期値 + (スロット累計)`;
        }
        return str.trim();
    }
};
