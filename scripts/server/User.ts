import * as bcrypt from "bcrypt";
import * as sqlite from "sqlite3";
import {DbHandlerOpen, DbHandlerAll, DbHandlerRun, DbHandlerGet} from "./DBWrapper"

export function hashPassword(password : string) {
    return bcrypt.hash(password, 10);
}

export async function addUser(db : sqlite.Database,username : string, password : string): Promise<any> {
    return DbHandlerRun(db,
        "INSERT OR REPLACE INTO users (username, password) VALUES (?, ?);",
        [username, await this.hashPassword(password)]);
}

export function getUser(db : sqlite.Database, username : string, password : string): Promise<boolean> {
    return DbHandlerGet(db, "SELECT username, password FROM users WHERE username = ?;", [username])
    .then(async (row : any) => {
        if (row) {
            return await bcrypt.compare(password, row.password);
        }

        return false;
    });
}
