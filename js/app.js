import { store } from './store.js';
import { utils } from './utils.js';
import { initParticipantsView } from './views/participants.js';
import { initRecordsView } from './views/records.js';
import { initResultsView } from './views/results.js';
import { initHandicapView } from './views/handicap.js';

window.app = {
    async init() {
        // Service Worker Registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('SW Registered', reg))
                .catch(err => console.log('SW Failed', err));
        }

        // Initialize Store
        await store.init();

        // Initialize Views
        initParticipantsView();
        initRecordsView();
        initResultsView();
        initHandicapView();

        this.updateNavState();

        // Initial Routing
        this.router('participants'); // Default page

        console.log('App Initialized');
    },

    handicapClicks: 0,
    participantClicks: 0,
    handleNavClick(e, target) {
        if (e) e.preventDefault();

        // Tracking clicks for Handicap Secret
        if (target === 'handicap') {
            this.handicapClicks++;
            if (this.handicapClicks >= 5) {
                document.dispatchEvent(new CustomEvent('view:handicap:showSecret'));
            }
        } else {
            this.handicapClicks = 0;
            document.dispatchEvent(new CustomEvent('view:handicap:hideSecret'));
        }

        // Tracking clicks for Participants Secret (Sync Button)
        if (target === 'participants') {
            this.participantClicks++;
            if (this.participantClicks >= 5) {
                document.dispatchEvent(new CustomEvent('view:participants:showSync'));
            }
        } else {
            this.participantClicks = 0;
            document.dispatchEvent(new CustomEvent('view:participants:hideSync'));
        }

        this.router(target);
    },

    router(viewId) {

        // Hide all views
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        // Show target view
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.add('active');
        }

        // Update Nav
        const navItem = document.querySelector(`.nav-item[data-target="${viewId}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        // Trigger view refresh event if needed
        document.dispatchEvent(new CustomEvent(`view:${viewId}:active`));
    },

    updateNavState() {
        const resultsBtn = document.querySelector('.nav-item[data-target="results"]');
        if (resultsBtn) {
            const isUnlocked = store.settings.isResultsUnlocked;
            console.log('Updating Nav State. Results Unlocked:', isUnlocked);
            if (isUnlocked) {
                resultsBtn.classList.remove('disabled');
            } else {
                resultsBtn.classList.add('disabled');
            }
        } else {
            console.warn('Results navigation button not found in the DOM.');
        }
    }
};

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});
