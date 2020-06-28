import express = require("express");
import createError = require('http-errors');
import csurf from "csurf";
import cookieParser = require("cookie-parser");
import * as sqlite from "sqlite3";
import session from 'express-session';
import { MemoryStore } from 'express-session';
import {DbHandlerRun, getQuizlist, getQuiz, getTotalQuizStats, getQuizAvgTimes, addQuizStats, isQuizSolved} from "./DBWrapper";
import {User} from "./User"
import {promisify} from 'util';
import logger from 'morgan';
import {QuizStatistics, Quiz, QuizStatisticsDB, QuizQuestionAvg} from "../quiz/Quiz";

sqlite.verbose();
const csrfProtection = csurf({ cookie: true });
const app : express.Application = express();
const sessionStore : MemoryStore = new MemoryStore();
const user : User = new User();

const completeUserLogout = (request: express.Request, response: express.Response, next: express.NextFunction) => {
    sessionStore.all((err : any, sessions : any) => {
        const deletionPromises = Object.entries(sessions)
            .filter(([k, v]:[any,any]) => v.login === request.session.login)
            .map(([k, v]) => (promisify(sessionStore.destroy.bind(sessionStore))(k)));
        (Promise.all(deletionPromises)).then(() => {
            return response.redirect('/');
        }).catch(() => {
            return next(createError(404));
        });
    })
}

function isUserLogged(request: express.Request) {
    if (request.session!.username) {
        return true;
    } else {
        return false;
    }
}

app.use(cookieParser('randomkey'));

app.use(logger('dev'));

app.use(express.urlencoded({
    extended: true
}));

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: 'randomkey',
    store: sessionStore,
    cookie : {
        sameSite: 'strict',
    }
}));

app.set('view engine', 'pug');

app.use('/public', express.static(__dirname + '/public/'));

app.use(express.json());

// New connection instance with database for every requests using middleware - transaction should not overlap
app.use((request: express.Request, response: express.Response, next: express.NextFunction) => {
    response.locals.db = new sqlite.Database("quiz.db");
    next();
})

// Server api
app.get('/api/quizlist', async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    const quizlist = await getQuizlist(response.locals.db);
    response.send(quizlist);
});

app.get('/api/quiz/:id', async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (!isUserLogged(request)) {
        next(createError(404));
    }

    const db : sqlite.Database = response.locals.db;
    const quizname : string =  request.params.id;

    const quizContent = await getQuiz(db, quizname);
    const quizRequestTime = new Date().getTime() / 1000;

    request.session!.quizRequestTime = quizRequestTime;
    response.send(quizContent);
});

app.get('/api/quiz/totalstats/:id', async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (!isUserLogged(request)) {
        next(createError(404));
    }

    const db : sqlite.Database = response.locals.db;
    const quizname : string =  request.params.id;

    const stats = await getTotalQuizStats(db, quizname);
    let topScores = [];
    for (const row of stats) {
        const tmpObject = JSON.parse(row.quizstatistics);
        topScores.push(tmpObject.finalScore);
    }

    topScores = topScores.sort((a:any, b:any) => {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
    }).slice(0, 5);

    response.send(topScores);
});

app.get('/api/quiz/avgtimes/:id', async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (!isUserLogged(request)) {
        next(createError(404));
    }

    const db : sqlite.Database = response.locals.db;
    const quizname : string =  request.params.id;
    response.send(await getQuizAvgTimes(db, quizname));
});

app.get('/api/quiz/solved/:id', async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (!isUserLogged(request)) {
        next(createError(404));
    }

    const db : sqlite.Database = response.locals.db;
    const quizname : string =  request.params.id;
    const username : string = request.session!.username;

    response.send(await isQuizSolved(db, quizname, username));
});

async function rateQuiz(quiz : Quiz, quizStatistics : QuizStatisticsDB, totalServerTime : number) : Promise<string> {
    const quizLength = quiz.quiz.length;
    const ratedQuiz : QuizStatistics = new QuizStatistics(quiz);

    let totalPenalty : number = 0;

    for(let i = 0; i < quizLength; i++){
        const correctAnswer : string = ratedQuiz.question[i].correctAnswer;
        ratedQuiz.question[i].chosenAnswer = quizStatistics.question[i].chosenAnswer;
        const chosenAnswer : string = ratedQuiz.question[i].chosenAnswer;
        ratedQuiz.question[i].timeSpent = Math.ceil(totalServerTime * quizStatistics.question[i].timeSpent);

        if (correctAnswer !== chosenAnswer){
            totalPenalty += quiz.quiz[i].penalty;
        }
    }

    ratedQuiz.finalScore = Math.ceil(totalPenalty + totalServerTime);

    return JSON.stringify(ratedQuiz);
}

async function updateAvgTimes(db: sqlite.Database, quizname: string, avgTimes : QuizQuestionAvg[], ratedQuiz : QuizStatistics) {
    const newAvgTimes : QuizQuestionAvg[] = [];

    for(let i = 0; i < ratedQuiz.question.length; i++) {
        let quizAvg : QuizQuestionAvg;

        if (i >= avgTimes.length){
            quizAvg = new QuizQuestionAvg();
        } else {
            quizAvg = avgTimes[i];
        }

        if (ratedQuiz.question[i].chosenAnswer === ratedQuiz.question[i].correctAnswer) {
            quizAvg.totalSolved += 1;
            quizAvg.totalTime += ratedQuiz.question[i].timeSpent;
        }

        newAvgTimes.push(quizAvg);
    }

    DbHandlerRun(db, "INSERT OR REPLACE INTO avgquiztime (quizname, avgtimes) VALUES (?, ?);",
        [quizname, JSON.stringify(newAvgTimes)]);
}

app.post('/api/quiz/:id', csrfProtection, async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (!isUserLogged(request)) {
        next(createError(404));
    }

    const quizStatisticsDb : QuizStatisticsDB = request.body;
    const db : sqlite.Database = response.locals.db;
    const quizname : string =  quizStatisticsDb.quizname;
    const username : string = request.session!.username;

    if (await isQuizSolved(db, quizname, username)) {
        next(createError(404));
    }

    const timeLasted : number = new Date().getTime() / 1000 - request.session!.quizRequestTime;

    const avgTimes : QuizQuestionAvg[] = JSON.parse(await getQuizAvgTimes(db, quizname));
    const quizContent : string = (await getQuiz(db, quizname));
    const quiz : Quiz = JSON.parse(quizContent);
    const ratedQuiz : string = await rateQuiz(quiz, quizStatisticsDb, timeLasted);

    await addQuizStats(db, quizname, username, ratedQuiz);
    await updateAvgTimes(db, quizname, avgTimes, JSON.parse(ratedQuiz));

    response.send(ratedQuiz);
});

// Main page rendering
app.get('/', csrfProtection, async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (isUserLogged(request)){
        response.redirect('/logged');
    } else {
        response.redirect('/login');
    }
});

// Quiz page rendering
app.get('/quiz', csrfProtection, function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (isUserLogged(request)){
        response.render('quiz', {username: request.session!.username, csrfToken: request.csrfToken()});
    } else {
        next(createError(404));
    }
});

// Login site rendering
app.get('/login', csrfProtection, function (request: express.Request, response: express.Response, next: express.NextFunction) {
    return response.render('login', {
        csrfToken: request.csrfToken()
    });
});

app.post('/login', csrfProtection, async function (request: express.Request, response: express.Response, next: express.NextFunction) {
    if (await user.getUser(response.locals.db, request.body.username, request.body.password)) {
        request.session!.username = request.body.username;
    }

    response.redirect('/');
});

// Logged screen
app.get('/logged', csrfProtection, async function (request: express.Request, response: express.Response, next: express.NextFunction) {
    if (isUserLogged(request)){
        response.render('logged', {username: request.session!.username});
    } else {
        next(createError(404));
    }
});

// Changing password screen
app.get('/change_password', csrfProtection, async function (request: express.Request, response: express.Response, next: express.NextFunction) {
    if (isUserLogged(request)){
        response.render('change_password', {username: request.session!.username, csrfToken: request.csrfToken()});
    } else {
        next(createError(404));
    }
});

app.post('/change_password', csrfProtection, async function (request: express.Request, response: express.Response, next: express.NextFunction) {
    if (isUserLogged(request)){
        if (request.body.new_password_1 === request.body.new_password_2 && request.body.new_password_1.length > 0) {
            user.addUser(response.locals.db, request.session!.username, request.body.new_password_1);
            completeUserLogout(request, response, next);
        } else {
            response.redirect('/change_password');
        }
    } else {
        next(createError(404));
    }
});

// Logout from the system
app.get('/logout', function (request: express.Request, response: express.Response, next: express.NextFunction) {
    if (isUserLogged(request)){
        completeUserLogout(request, response, next);
    } else {
        next(createError(404));
    }
});

// Express server set up and console info
app.listen(8080, () => {
    console.log("App is running at http://localhost:%d\n", 8080);
    console.log("Press CTRL-C to stop\n");
});

// Error handling
app.use(function(request: express.Request, response: express.Response, next: express.NextFunction) {
    next(createError(404));
});

app.use((err: any, request: express.Request, response: express.Response, next: express.NextFunction) => {
    response.locals.message = err.message;
    response.locals.error = request.app.get('env') === 'development' ? err : {};
    response.status(err.status || 500);
    response.render('error');
});