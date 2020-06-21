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
        response.render('quiz', {username: request.session!.username});
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