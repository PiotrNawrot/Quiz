import * as sqlite from "sqlite3";
import {DbHandlerOpen, DbHandlerAll, DbHandlerRun, DbHandlerGet} from "./DBWrapper";
import {User} from "./User"

sqlite.verbose();
const user : User = new User();

async function dbInitialization() {
    const db : sqlite.Database = await DbHandlerOpen("quiz.db");

    await DbHandlerRun(db, "DROP TABLE IF EXISTS user;", []);

    await DbHandlerRun(db, "CREATE TABLE IF NOT EXISTS users (username VARCHAR PRIMARY KEY, password VARCHAR)", []);
    await user.addUser(db, "user1", "user1");
    await user.addUser(db, "user2", "user2");
}

dbInitialization();