import * as sqlite3 from "sqlite3";

export async function getQuizlist(db: sqlite3.Database) {
    return DbHandlerAll(db, "SELECT quizname FROM quiz", []).then((rows : any[]) => {
        return rows.map((row) => row.quizname);
    })
}

export async function getQuiz(db: sqlite3.Database, quizname : string) {
    return DbHandlerGet(db, "SELECT * FROM quiz WHERE quizname = ?;", [quizname]).then((row : any) => {
        return row.quizcontent;
    })
}

export async function addQuizStats(db: sqlite3.Database, quizname : string, username : string, quizstatistics : string) {
    return DbHandlerRun(db,
        "INSERT OR REPLACE INTO quizstats (quizname, username, quizstatistics) VALUES (?, ?, ?);",
            [quizname, username, quizstatistics]).then(() => console.log('added quiz stats'));
}

export async function isQuizSolved(db: sqlite3.Database, quizname : string, username : string) {
    console.log('isquizsolved', quizname, username);
    return DbHandlerGet(db, "SELECT * FROM quizstats WHERE quizname = ? AND username = ?;", [quizname, username]).then((row : any) => {
        if (row) {
            return true;
        } else {
            return false;
        }
    })
}

export async function getTotalQuizStats(db: sqlite3.Database, quizname : string) {
    return DbHandlerAll(db, "SELECT * FROM quizstats WHERE quizname = ?", [quizname]).then((rows : any[]) => {
        return rows;
    })
}

export async function getQuizAvgTimes(db: sqlite3.Database, quizname : string) : Promise<string> {
    return DbHandlerGet(db, "SELECT * FROM avgquiztime WHERE quizname = ?;", [quizname]).then((row : any) => {
        return row.avgtimes;
    })
}

export function DbHandlerOpen(path: string) {
    return new Promise<sqlite3.Database>((resolve, reject) => {
        const db = new sqlite3.Database(path, function(err : any) {
            if (err) {
                reject(err);
            } else {
                resolve(db);
            }
        });
    });
}

export function DbHandlerAll(db : sqlite3.Database, sqlQuery: string, params: any[]) {
    return new Promise<any>((resolve, reject) => {
        if (params === undefined) {
            params = [];
        }

        db.all(sqlQuery, params, function(err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export function DbHandlerRun(db : sqlite3.Database, sqlQuery: string, params: any[]) {
    return new Promise((resolve, reject) => {
        db.run(sqlQuery, params,
            function(err)  {
                if (err) {
                    reject(err.message)
                } else {
                    resolve(true);
                }
        });
    });
}

export function DbHandlerGet(db : sqlite3.Database, sqlQuery: string, params: any) {
    return new Promise((resolve, reject) => {
        if (params === undefined) {
            params = [];
        }

        db.get(sqlQuery, params, function(err: any, row: any){
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}