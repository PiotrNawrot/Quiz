import { Quiz, Question, QuizStatistics, QuizStatisticsDB, QuizQuestionAvg } from "./Quiz.js";
import { Timer } from "./Timer.js"

const startButton = document.getElementById('start-btn') as HTMLButtonElement;
const rankingButton = document.getElementById('ranking-btn') as HTMLButtonElement;
const nextButton = document.getElementById('next-btn') as HTMLButtonElement;
const previousButton = document.getElementById('previous-btn') as HTMLButtonElement;
const finishButton = document.getElementById('finish-btn') as HTMLButtonElement;
const exitButton = document.getElementById('exit-btn') as HTMLButtonElement;
const saveScoreButton = document.getElementById('score-btn') as HTMLButtonElement;

const introText = document.getElementById('intro-text') as HTMLElement;
const questionContainerElement = document.getElementById('question-container') as HTMLElement;
const questionElement = document.getElementById('question') as HTMLElement;
const answerButtonsElement = document.getElementById('answer-btns') as HTMLElement;
const controlsSection = document.getElementById('controls') as HTMLElement;
// Quizlist
const quizlistContainer = document.getElementById('quizlist-container') as HTMLElement;
const quizlistGrid = document.getElementById('quizlist-grid') as HTMLElement;
const quizlistMessage = document.getElementById('quizlist-msg') as HTMLElement;

const scoreCounterElement = document.getElementById('score-counter') as HTMLElement;
const questionCounterElement = document.getElementById('question-counter') as HTMLElement;

const hideClass : string = 'hide';

let currentQuiz : Quiz;
let quizLength : number;
let quizStatistics : QuizStatistics;
let quizname : string;

let currentQuestion : number = -1;
let answeredQuestions : number = 0;
let timer : Timer;

onPageLoad();

async function selectQuizListener(this: any, ev : Event) {
    quizname = this.innerHTML;

    currentQuiz = await getQuizConentByQuizname();
    quizLength = currentQuiz.quiz.length;
    quizStatistics = new QuizStatistics(currentQuiz);

    addClass(quizlistContainer, hideClass);
    addClass(quizlistGrid, hideClass);
    addClass(quizlistMessage, hideClass);
    removeClass(controlsSection, hideClass);
    removeClass(startButton, hideClass);
    removeClass(rankingButton, hideClass);

    if (await solvedAlready()) {
        startButton.innerHTML = 'You solved it already';
        startButton.classList.add('wrong-answer');
    }
}

async function prepareQuizScreen() {
    quizlistMessage.innerHTML = 'Choose the quiz!';
    const quizlist = await getQuizzesNamesList();

    for(let i = 0; i < quizlist.length; i++) {
        const buttonText : string = quizlist[i];

        const button = document.createElement('button');
        button.innerHTML = buttonText;
        button.classList.add('btn');
        button.addEventListener('click', selectQuizListener);
        quizlistGrid.appendChild(button);
    }
}

async function getQuizConentByQuizname() : Promise<Quiz> {
    return await fetch('http://localhost:8080/api/quiz/' + quizname).then((response) => {
        return response.json();
    });
}

async function getQuizzesNamesList(): Promise<string[]> {
    return await fetch('http://localhost:8080/api/quizlist')
      .then(response => response.json());
}

async function solvedAlready(): Promise<boolean> {
    return await fetch('http://localhost:8080/api/quiz/solved/' + quizname)
      .then(response => response.json());
}

async function onPageLoad() {
    introText.innerHTML = "<pre>" +
    "Welcome to the quiz!\n"
    + "</pre>";
    exitButton.addEventListener('click', reloadPage);

    startButton.addEventListener('click', async (ev: Event) => {
        if (await solvedAlready()) {
            return;
        }

        timer = new Timer();
        addClass(startButton, hideClass);
        addClass(rankingButton, hideClass);
        controlsSection.style.display = 'none';

        removeClass(finishButton, hideClass);
        removeClass(nextButton, hideClass);
        removeClass(previousButton, hideClass);
        removeClass(questionContainerElement, hideClass);
        removeClass(answerButtonsElement, hideClass);
        removeClass(questionElement, hideClass);
        setNextQuestion();
    });

    nextButton.addEventListener('click', setNextQuestion);
    previousButton.addEventListener('click', setPreviousQuestion);
    previousButton.classList.add('disabled-button');
    finishButton.addEventListener('click', finishTest);
    finishButton.classList.add('disabled-button');
    rankingButton.addEventListener('click', fetchRanking);

    await prepareQuizScreen();
}

async function fetchRanking() {
    removeClass(questionContainerElement, hideClass);
    removeClass(answerButtonsElement, hideClass);
    addClass(startButton, hideClass);
    addClass(rankingButton, hideClass);

    questionElement.innerHTML = `Highest Scores!`;

    const rankingArray : number[] = await fetch('http://localhost:8080/api/quiz/totalstats/' + quizname, {})
            .then(response => response.json());

    for(let i = 0; i < rankingArray.length; i++){
        const button = document.createElement('button');
        button.innerHTML = `${i + 1}. ${rankingArray[i]}`;

        button.classList.add('btn');
        answerButtonsElement.appendChild(button);
    }
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

async function finishTest() {
    if (answeredQuestions !== quizLength) {
        return;
    }

    addQuestionTime();
    timer.stopTimer();
    resetQuestion();

    const timeStamp = timer.getCounter();
    const quizStatisticsDB : QuizStatisticsDB = new QuizStatisticsDB(quizLength);

    for(let i = 0; i < quizLength; i++) {
        quizStatisticsDB.question[i].chosenAnswer = quizStatistics.question[i].chosenAnswer;
        quizStatisticsDB.question[i].timeSpent = quizStatistics.question[i].timeSpent / timeStamp;
    }

    quizStatisticsDB.quizname = quizname;

    const csrf = document.getElementById('_csrf') as HTMLInputElement;
    const finalResult : QuizStatistics = await fetch('http://localhost:8080/api/quiz/' + quizname, {
        method: 'POST',
        body: JSON.stringify(quizStatisticsDB),
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf.value
        }
    }).then(response => response.json());

    const avgStats : QuizQuestionAvg[] =
                await fetch('http://localhost:8080/api/quiz/avgtimes/' + quizname).then(response => response.json());

    questionElement.innerHTML =`Quiz summary`;

    for(let i = 0; i < quizLength; i++){
        const correctAnswer : string = finalResult.question[i].correctAnswer;
        const chosenAnswer : string = finalResult.question[i].chosenAnswer;
        const timeSpent : number = finalResult.question[i].timeSpent;

        let buttonText : string = "<pre>" + currentQuiz.quiz[i].question + chosenAnswer +
                        `\n Time spent: ${timeSpent}`;

        if (avgStats[i].totalSolved > 0){
            buttonText += `\n Average time to correct answer: ${avgStats[i].totalTime / avgStats[i].totalSolved}`;
        } else {
            buttonText += `\n Average time to correct answer: N/A`;
        }

        const button = document.createElement('button');

        if (correctAnswer !== chosenAnswer){
            button.classList.add('wrong-answer');
            buttonText += `\n Correct answer: ${correctAnswer}`;
            buttonText += `\n Penalty: ${currentQuiz.quiz[i].penalty}`;
        }

        buttonText += "</pre>";

        button.innerHTML = buttonText;
        button.classList.add('btn');
        answerButtonsElement.appendChild(button);
    }

    scoreCounterElement.innerText = `Final Score = ${finalResult.finalScore}`;

    addClass(finishButton, hideClass);
    addClass(previousButton, hideClass);
    addClass(nextButton, hideClass);

    removeClass(saveScoreButton, hideClass);
    saveScoreButton.innerHTML = 'Finish the test';
    saveScoreButton.addEventListener('click', () => reloadPage());
}

function setNextQuestion() {
    if (currentQuestion + 1 === quizLength){
        return;
    }

    if (currentQuestion === 0){
        previousButton.classList.remove('disabled-button');
    }

    addQuestionTime();
    currentQuestion += 1;
    setQuestionTime();
    showQuestion(currentQuiz.quiz[currentQuestion]);

    if (currentQuestion + 1 === quizLength){
        nextButton.classList.add('disabled-button');
    }
}

function setPreviousQuestion() {
    if (currentQuestion === 0){
        return;
    }

    if (currentQuestion + 1 === quizLength){
        nextButton.classList.remove('disabled-button');
    }

    addQuestionTime();
    currentQuestion -= 1;
    setQuestionTime();
    showQuestion(currentQuiz.quiz[currentQuestion]);

    if (currentQuestion === 0){
        previousButton.classList.add('disabled-button');
    }
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

function selectAnswerListener(this: any, ev : Event) {
    if (quizStatistics.question[currentQuestion].chosenAnswer === ''){
        answeredQuestions += 1;

        if (answeredQuestions === quizLength) {
            finishButton.classList.remove('disabled-button');
        }
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