class BossUpgrade {
    constructor(everyTurnTrigger) {
        this.everyTurnTrigger = everyTurnTrigger;
    }

    triggerEveryTurn() {
        // À implémenter dans les classes filles
    }

    triggerWhenPicked() {
        // À implémenter dans les classes filles
    }

    isEveryTurnTrigger() {
        return this.everyTurnTrigger;
    }
}
