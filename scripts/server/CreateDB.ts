import * as sqlite from "sqlite3";
import {DbHandlerOpen, DbHandlerAll, DbHandlerRun, DbHandlerGet} from "./DBWrapper";
import * as user from "./User"

sqlite.verbose();

const matematycznyQuiz : string = `{
    "quizname": "Matematyczny quiz"
    ,"quiz":
    [
        {
            "question": "2 + 2 * 2 = ",
            "answers": [
                { "text": "3", "correct": "f" },
                { "text": "2", "correct": "f" },
                { "text": "8", "correct": "f" },
                { "text": "6", "correct": "t" }
            ],
            "penalty" : 1
        },
        {
            "question": "(-18/6) + 3/1 = ",
            "answers": [
                { "text": "-3", "correct": "f" },
                { "text": "0", "correct": "t" },
                { "text": "3", "correct": "f" },
                { "text": "6", "correct": "f" }
            ],
            "penalty" : 2
        },
        {
            "question": "9/2*4 - 4*2 = ",
            "answers": [
                { "text": "10", "correct": "t" },
                { "text": "8", "correct": "f" },
                { "text": "18", "correct": "f" },
                { "text": "9", "correct": "f" }
            ],
            "penalty" : 3
        },
        {
            "question": "2 * 2 + 2 = ",
            "answers": [
                { "text": "8", "correct": "f" },
                { "text": "3", "correct": "f" },
                { "text": "5", "correct": "f" },
                { "text": "6", "correct": "t" }
            ],
            "penalty" : 4
        }
    ]
}`;

const matematycznyQuizTrudny : string = `{
    "quizname": "Matematyczny_quiz_trudny"
    ,"quiz":
    [
        {
            "question": "5 = ",
            "answers": [
                { "text": "3", "correct": "f" },
                { "text": "2", "correct": "f" },
                { "text": "8", "correct": "f" },
                { "text": "5", "correct": "t" }
            ],
            "penalty" : 1
        },
        {
            "question": "(-18/6) + 3/1 = ",
            "answers": [
                { "text": "-3", "correct": "f" },
                { "text": "0", "correct": "t" },
                { "text": "3", "correct": "f" },
                { "text": "6", "correct": "f" }
            ],
            "penalty" : 2
        },
        {
            "question": "9/2*4 - 4*2 = ",
            "answers": [
                { "text": "10", "correct": "t" },
                { "text": "8", "correct": "f" },
                { "text": "18", "correct": "f" },
                { "text": "9", "correct": "f" }
            ],
            "penalty" : 3
        },
        {
            "question": "2 * 2 + 2 = ",
            "answers": [
                { "text": "8", "correct": "f" },
                { "text": "3", "correct": "f" },
                { "text": "5", "correct": "f" },
                { "text": "6", "correct": "t" }
            ],
            "penalty" : 4
        }
    ]
}`;

async function addQuiz(db : sqlite.Database, quizname : string, quizcontent : string): Promise<any> {
    return DbHandlerRun(db,
        "INSERT OR REPLACE INTO quiz (quizname, quizcontent) VALUES (?, ?);",
        [quizname, quizcontent]);
}

async function addQuizAvereges(db : sqlite.Database, quizname : string): Promise<any> {
    const foo : any = [];
    return DbHandlerRun(db,
        "INSERT OR REPLACE INTO avgquiztime (quizname, avgtimes) VALUES (?, ?);",
        [quizname, JSON.stringify(foo)]);
}

async function dbInitialization() {
    const db : sqlite.Database = await DbHandlerOpen("quiz.db");

    console.log('Deleting databases');
    await DbHandlerRun(db, "DROP TABLE IF EXISTS user;", []);
    await DbHandlerRun(db, "DROP TABLE IF EXISTS quiz;", []);
    await DbHandlerRun(db, "DROP TABLE IF EXISTS quizstats;", []);
    await DbHandlerRun(db, "DROP TABLE IF EXISTS avgquiztime;", []);

    console.log('Creating users');
    await DbHandlerRun(db, "CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)", []);
    await user.addUser(db, "user1", "user1");
    await user.addUser(db, "user2", "user2");

    console.log('Creating quizes');
    await DbHandlerRun(db, "CREATE TABLE IF NOT EXISTS quiz (quizname TEXT PRIMARY KEY, quizcontent TEXT)", []);
    await addQuiz(db, 'Matematyczny quiz', matematycznyQuiz);
    await addQuiz(db, 'Matematyczny quiz++', matematycznyQuizTrudny);

    console.log('Creating quizstats');
    await DbHandlerRun(db, "CREATE TABLE IF NOT EXISTS quizstats (quizname TEXT, username TEXT, quizstatistics TEXT, PRIMARY KEY (quizname, username))", []);

    console.log('Creating avgquiztime');
    await DbHandlerRun(db, "CREATE TABLE IF NOT EXISTS avgquiztime (quizname TEXT PRIMARY KEY, avgtimes TEXT)", []);
    await addQuizAvereges(db, 'Matematyczny quiz');
    await addQuizAvereges(db, 'Matematyczny quiz++');

    console.log('Db init finished');
}

dbInitialization();