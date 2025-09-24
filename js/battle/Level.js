class Level {
    constructor() {
        this.level = 0;
    }

    static getInstance() {
        if (!Level.instance) {
            Level.instance = new Level();
        }
        return Level.instance;
    }

    getLevel() {
        return this.level;
    }

    setLevel(level) {
        this.level = level;
        this.updateLevelDisplay();
    }

    nextLevel() {
        this.level++;
        this.updateLevelDisplay();
        AnimationUtils.animateLevelUp(document.getElementById('level-text'));
    }

    updateLevelDisplay() {
        const levelText = document.getElementById('level-text');
        levelText.textContent = `Level ${(this.level + 1).toString().padStart(2, '0')}`;
    }

    levelIsABossBattle() {
        return this.level % 5 === 0 && this.level > 1;
    }

    levelIsABossBattlePreFight() {
        return (this.level + 1) % 5 === 0 && this.level > 1;
    }
}
