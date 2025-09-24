// Classe Random simple pour remplacer Math.random avec une graine
class Random {
    constructor(seed = Date.now()) {
        this.seed = seed;
    }

    nextInt(max) {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return Math.floor((this.seed / 233280) * max);
    }

    nextDouble() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}
