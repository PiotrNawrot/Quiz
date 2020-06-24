export interface Answer {
    text : string;
    correct : string;
}

export interface Question {
    question : string;
    answers : Answer[];
    penalty : number;
}

export interface Quiz {
    quizname: string;
    quiz: Question[];
}

export class Statistics {
    timeSpent : number = 0;
    latestTimerReading : number = 0;
    chosenAnswer : string = "";
    correctAnswer : string = "";
}

export class QuizStatistics {
    question : Statistics[];
    finalScore : number;

    constructor(currentQuiz : Quiz) {
        this.question = [];
        this.finalScore = 0;

        for(let i = 0; i < currentQuiz.quiz.length; i++){
            const statistics : Statistics = new Statistics();
            statistics.timeSpent = 0;
            statistics.chosenAnswer = "";

            for(let j = 0; j < currentQuiz.quiz[i].answers.length; j++){
                if (currentQuiz.quiz[i].answers[j].correct === "t"){
                    statistics.correctAnswer = currentQuiz.quiz[i].answers[j].text;
                }
            }

            this.question.push(statistics);
        }
    }
}

export class StatisticsDB {
    chosenAnswer : string = "";
    timeSpent : number = 0;
}

export class QuizStatisticsDB {
    question : StatisticsDB[];

    constructor(length : number) {
        this.question = [];

        for(let i = 0; i < length; i++) {
            this.question.push(new StatisticsDB());
        }
    }
}