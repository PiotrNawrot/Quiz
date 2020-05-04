export class Timer {
    counter: number;
    myInterval;

    constructor() {
        this.counter = 0;
        this.myInterval = setInterval(() => {
            this.counter = this.counter + 1;
            updateScore(this.counter);
        }, 1000)
        return this;
    }

    getCounter() : number {
        return this.counter;
    }

    stopTimer() {
        clearInterval(this.myInterval);
    }
}

const scoreCounterElement = document.getElementById('score-counter') as HTMLElement;

function updateScore(score : number) {
    scoreCounterElement.innerText = `Current score: ${score}`;
}