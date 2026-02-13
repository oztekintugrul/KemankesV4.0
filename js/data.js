// js/data.js

export const moduleConfigs = {
    '18m': { name: '18m Salon Müsabaka', rounds: 7, arrowsPerRound: 5, inputType: 'round_18m' },
    '70m': { name: '70m Açık Hava (Puta)', rounds: 7, arrowsPerRound: 9, inputType: 'round' }
};

export const targetConfigs = {
    '18m': { image: 'puta_kafa_18.png', arrowCount: 5 },
    '70m': { image: 'puta_70.png', arrowCount: 9 },
    '50m': { image: 'puta_kafa_kalkan.png', arrowCount: 6 }
};

// Durum Değişkenleri (State)
export const state = {
    activeModuleId: '18m',
    currentBowSlot: 0,
    moduleBowSlots: { '18m': 0, '70m': 0 },
    sessions: {
        '18m': createSessionState(7),
        '70m': createSessionState(12)
    },
    targetSessionData: {
        '18m': Array(7).fill(null).map(() => []),
        '70m': Array(7).fill(null).map(() => []),
        '50m': Array(7).fill(null).map(() => [])
    },
    currentTargetRound: 1,
    currentTargetFace: '18m',
    currentArrowLabels: [],
    isBrokenMode: false
};

// Yardımcı Fonksiyon
export function createSessionState(roundCount) {
    return {
        score: 0,
        totalArrows: 0,
        currentRound: 1,
        arrowsInRound: 0,
        roundScores: new Array(roundCount).fill(0),
        isFinished: false,
        shotHistory: [],
        arrowStats: {},
        arrowLabels: [],
        uiState: {
            arrowStates18m: [0, 0, 0, 0, 0],
            selectedArrows70m: []
        }
    };
}