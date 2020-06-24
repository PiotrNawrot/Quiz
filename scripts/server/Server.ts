import express = require("express");
import createError = require('http-errors');
import csurf from "csurf";
import cookieParser = require("cookie-parser");
import * as sqlite from "sqlite3";
import session from 'express-session';
import { MemoryStore } from 'express-session';
import {DbHandlerOpen, DbHandlerAll, DbHandlerRun, DbHandlerGet} from "./DBWrapper";
import {User} from "./User"
import {promisify} from 'util';
import logger from 'morgan';
import { QuizStatistics, Quiz, QuizStatisticsDB } from "../quiz/Quiz";
import e = require("express");

sqlite.verbose();
const csrfProtection = csurf({ cookie: true });
const app : express.Application = express();
const sessionStore : MemoryStore = new MemoryStore();
const user : User = new User();

console.log('wypisz cokolwiek');

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

async function getQuizlist(db: sqlite.Database) {
    return DbHandlerAll(db, "SELECT quizname FROM quiz", []).then((rows : any[]) => {
        return rows.map((row) => row.quizname);
    })
}

async function getQuiz(db: sqlite.Database, quizname : string) {
    return DbHandlerGet(db, "SELECT * FROM quiz WHERE quizname = ?;", [quizname]).then((row : any) => {
        return row.quizcontent;
    })
}

async function addQuizStats(db: sqlite.Database, quizname : string, username : string, quizstatistics : string) {
    return DbHandlerRun(db,
        "INSERT OR REPLACE INTO quizstats (quizname, username, quizstatistics) VALUES (?, ?, ?);",
            [quizname, username, quizstatistics]);
}

async function isQuizSolved(db: sqlite.Database, quizname : string, username : string) {
    return DbHandlerGet(db, "SELECT * FROM quizstats WHERE quizname = ? AND username = ?;", [quizname, username]).then((row : any) => {
        console.log(row);

        if (row) {
            return true;
        } else {
            return false;
        }
    })
}

// Server api
app.get('/api/quizlist', async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    const quizlist = await getQuizlist(response.locals.db);
    response.send(quizlist);
});

app.get('/api/quiz/:id', async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (!isUserLogged(request)) {
        next(createError(404));
    }

    const quizContent = await getQuiz(response.locals.db, request.params.id);

    request.session!.quizRequestTime = new Date().getTime() / 1000;
    response.send(quizContent);
});

app.get('/api/quiz/solved/:id', async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (!isUserLogged(request)) {
        next(createError(404));
    }

    console.log('issolved query');
    response.send(await isQuizSolved(response.locals.db, request.session!.username, request.params.id));
});

async function rateQuiz(quiz : Quiz, quizStatistics : QuizStatisticsDB, totalServerTime : number) : Promise<string> {
    const quizLength = quiz.quiz.length;
    const ratedQuiz : QuizStatistics = new QuizStatistics(quiz);

    let totalPenalty : number = 0;

    for(let i = 0; i < quizLength; i++){
        const correctAnswer : string = ratedQuiz.question[i].correctAnswer;
        quizStatistics.question[i].chosenAnswer = ratedQuiz.question[i].chosenAnswer;
        const chosenAnswer : string = ratedQuiz.question[i].chosenAnswer;
        ratedQuiz.question[i].timeSpent = totalServerTime * quizStatistics.question[i].timeSpent;

        if (correctAnswer !== chosenAnswer){
            totalPenalty += quiz.quiz[i].penalty;
        }
    }

    ratedQuiz.finalScore = totalPenalty + totalServerTime;

    return JSON.stringify(ratedQuiz);
}

app.post('/api/quiz/:id', csrfProtection, async function(request: express.Request, response: express.Response, next: express.NextFunction) {
    if (!isUserLogged(request)) {
        next(createError(404));
    }

    if (isQuizSolved(response.locals.db, request.session!.username, request.params.id)) {
        next(createError(404));
    }

    console.log('poszedl post');

    const quiz : Quiz = await getQuiz(response.locals.db, request.params.id);
    const quizStatistics : QuizStatistics = new QuizStatistics(quiz);
    const ratedQuiz : string = await rateQuiz(quiz, quizStatistics, new Date().getTime() / 1000 -
                                                                            request.session!.quizRequestTime);
    await addQuizStats(response.locals.db, request.session!.username, request.params.id, ratedQuiz);
    response.redirect('/');
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
    console.log('get quiz');
    if (isUserLogged(request)){
        console.log('XD');
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