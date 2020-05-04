import { Quiz, Question, QuizStatistics } from "./Quiz.js";
import { DatabaseHandler , QuizDBEntry} from "./DatabaseHandler.js";
import { Timer } from "./Timer.js"
import { quiz } from "./utils.js";

const startButton = document.getElementById('start-btn') as HTMLButtonElement;
const rankingButton = document.getElementById('ranking-btn') as HTMLButtonElement;
const nextButton = document.getElementById('next-btn') as HTMLButtonElement;
const previousButton = document.getElementById('previous-btn') as HTMLButtonElement;
const finishButton = document.getElementById('finish-btn') as HTMLButtonElement;
const exitButton = document.getElementById('exit-btn') as HTMLButtonElement;
const saveScoreButton = document.getElementById('score-btn') as HTMLButtonElement;
const saveScoreAndStatsButton = document.getElementById('score-stats-btn') as HTMLButtonElement;

const introText = document.getElementById('intro-text') as HTMLElement;
const questionContainerElement = document.getElementById('question-container') as HTMLElement;
const questionElement = document.getElementById('question') as HTMLElement;
const answerButtonsElement = document.getElementById('answer-btns') as HTMLElement;
const controlsSection = document.getElementById('controls') as HTMLElement;

const scoreCounterElement = document.getElementById('score-counter') as HTMLElement;
const questionCounterElement = document.getElementById('question-counter') as HTMLElement;

const hideClass = 'hide';

const currentQuiz : Quiz = JSON.parse(quiz);
const quizLength = currentQuiz.quiz.length;

const quizStatistics : QuizStatistics = new QuizStatistics(currentQuiz);
const databaseHandler = new DatabaseHandler();

let currentQuestion : number = -1;
let answeredQuestions : number = 0;
let timer : Timer;

onPageLoad();

function onPageLoad() {
    introText.innerHTML = "<pre>" +
    "Welcome to the quiz!\n"
    + "</pre>";
    exitButton.addEventListener('click', reloadPage);

    startButton.addEventListener('click', (ev: Event) => {
        timer = new Timer();
        addClass(startButton, hideClass);
        addClass(rankingButton, hideClass);
        controlsSection.style.display = 'none';

        removeClass(finishButton, hideClass);
        removeClass(nextButton, hideClass);
        removeClass(previousButton, hideClass);
        removeClass(questionContainerElement, hideClass);
        setNextQuestion();
    });

    nextButton.addEventListener('click', setNextQuestion);
    previousButton.addEventListener('click', setPreviousQuestion);
    finishButton.addEventListener('click', finishTest);
    rankingButton.addEventListener('click', fetchRanking);
}

function saveScoreAndStats () {
    databaseHandler.addToDb(new QuizDBEntry(quizStatistics.finalScore,
        JSON.stringify(quizStatistics)));
    reloadPage();
}

function saveScore() {
    databaseHandler.addToDb(new QuizDBEntry(quizStatistics.finalScore, ''));
    reloadPage();
}

function fetchRanking() {
    removeClass(questionContainerElement, hideClass);
    addClass(startButton, hideClass);
    addClass(rankingButton, hideClass);

    questionElement.innerHTML = `Highest Scores!`;

    databaseHandler.fetchRankingFromDb(answerButtonsElement);
}

function reloadPage() {
    window.location.reload();
}

function resetQuestion() {
    while(answerButtonsElement.firstChild){
        answerButtonsElement.removeChild(answerButtonsElement.firstChild);
    }
}

function setQuestionTime() {
    quizStatistics.question[currentQuestion].latestTimerReading = timer.getCounter();
}

function addQuestionTime() {
    if (currentQuestion >= 0 && currentQuestion < quizLength)
        quizStatistics.question[currentQuestion].timeSpent += timer.getCounter() -
            quizStatistics.question[currentQuestion].latestTimerReading;
}

function finishTest() {
    if (answeredQuestions !== quizLength) {
        return;
    }

    addQuestionTime();

    let totalPenalty : number = 0;
    let totalScore = 0;
    timer.stopTimer();

    resetQuestion();

    questionElement.innerHTML =
        `Quiz summary`;

    for(let i = 0; i < quizLength; i++){
        const correctAnswer : string = quizStatistics.question[i].correctAnswer;
        const chosenAnswer : string = quizStatistics.question[i].chosenAnswer;
        const timeSpent : number = quizStatistics.question[i].timeSpent;

        let buttonText : string = "<pre>" + currentQuiz.quiz[i].question + chosenAnswer +
                        `\n Time spent: ${timeSpent}`;

        const button = document.createElement('button');

        if (correctAnswer !== chosenAnswer){
            totalPenalty += currentQuiz.quiz[i].penalty;
            button.classList.add('wrong-answer');
            buttonText += `\n Penalty: ${currentQuiz.quiz[i].penalty}`
        }

        buttonText += "</pre>";

        totalScore += timeSpent;

        button.innerHTML = buttonText;
        button.classList.add('btn');
        answerButtonsElement.appendChild(button);
    }

    scoreCounterElement.innerText = `Total Score = ${totalPenalty} + ${totalScore} = ${totalPenalty + totalScore}`;
    quizStatistics.finalScore = totalPenalty + totalScore;

    addClass(finishButton, hideClass);
    addClass(previousButton, hideClass);
    addClass(nextButton, hideClass);

    removeClass(saveScoreButton, hideClass);
    removeClass(saveScoreAndStatsButton, hideClass);

    saveScoreButton.addEventListener('click', saveScore);
    saveScoreAndStatsButton.addEventListener('click', saveScoreAndStats);
}

function setNextQuestion() {
    if (currentQuestion + 1 === quizLength){
        return;
    }

    addQuestionTime();
    currentQuestion += 1;
    setQuestionTime();
    showQuestion(currentQuiz.quiz[currentQuestion]);
}

function setPreviousQuestion() {
    if (currentQuestion === 0){
        return;
    }

    addQuestionTime();
    currentQuestion -= 1;
    setQuestionTime();
    showQuestion(currentQuiz.quiz[currentQuestion]);
}

function showQuestion(question : Question) {
    questionCounterElement.innerHTML =
        `Question: ${currentQuestion + 1}/${quizLength}`;

    resetQuestion();

    questionElement.innerHTML = question.question;
    question.answers.forEach(answer => {
        const button = document.createElement('button');
        button.innerHTML = answer.text;
        button.classList.add('btn');

        if (quizStatistics.question[currentQuestion].chosenAnswer === answer.text){
            button.classList.add('choosen-answer');
        }

        button.addEventListener('click', selectAnswerListener);
        answerButtonsElement.appendChild(button);
    });
}

function selectAnswerListener(ev : Event) {
    if (quizStatistics.question[currentQuestion].chosenAnswer === ''){
        answeredQuestions += 1;
    }

    quizStatistics.question[currentQuestion].chosenAnswer = this.innerHTML;
    showQuestion(currentQuiz.quiz[currentQuestion]);
}

function addClass(element : HTMLElement, className : string) {
    element.classList.add(className);
}

function removeClass(element : HTMLElement, className : string) {
    element.classList.remove(className);
}