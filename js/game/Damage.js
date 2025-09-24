class Damage {
    constructor(damage) {
        this.damage = damage;
        this.newHitIsCrit = false;
    }

    getDamage() {
        return this.damage;
    }

    setDamage(damage) {
        this.damage = damage;
    }

    increaseDamage(increase) {
        this.damage += increase;
    }

    nextHitIsCrit() {
        this.newHitIsCrit = true;
    }

    isNewHitIsCrit() {
        return this.newHitIsCrit;
    }

    critDamageDone() {
        this.newHitIsCrit = false;
    }
}
