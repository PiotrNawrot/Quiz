import { driver } from 'mocha-webdriver';
import { expect } from "chai";
import "mocha";

const ROOT_URL = `http://localhost:8080/`;
const LOGIN_URL = `http://localhost:8080/login`;
const LOGOUT_URL = `http://localhost:8080/logout`;
const QUIZ_URL = `http://localhost:8080/quiz`;

let cookie;

async function log_in(username : string, password : string) {
    await driver.get(LOGIN_URL);
    await driver.find('input[name="username"]').sendKeys(username);
    await driver.find('input[name="password"]').sendKeys(password);
    await driver.find('input[type="submit"]').click();
}

async function is_logged() {
    await driver.get(ROOT_URL);
    return await driver.find('a[href="/logout"]').then(() => true).catch(() => false);
}

async function log_out() {
    await driver.get(LOGOUT_URL);
}

async function change_password(new_password_1 : string, new_password_2 : string) {
    await driver.get(ROOT_URL + 'change_password');
    await driver.find('input[name="new_password_1"]').sendKeys(new_password_1);
    await driver.find('input[name="new_password_2"]').sendKeys(new_password_2);
    await driver.find('input[type="submit"]').click();
}

async function is_test_to_fill(id : number) {
    await driver.get(QUIZ_URL);
    return await driver.find(`#quizlist-grid > button:nth-child(${id})`).then(() => true).catch(() => false);
}

describe("logging out all sessions on password change", () => {
    it('logged in', async () => {
        await log_in('user1', 'user1');
        expect(await is_logged()).to.equal(true);
    });

    it('deleting cookie and checking that i am logged out', async () => {
        cookie = await driver.manage().getCookie('connect.sid');
        await driver.manage().deleteCookie('connect.sid');

        await log_out();
        expect(await is_logged()).to.equal(false);
    });

    it('restoring cookie restores the session', async () => {
        await driver.manage().addCookie({name: cookie.name, value: cookie.value});
        expect(await is_logged()).to.equal(true);
    });

    it('creating another session and changing password', async () => {
        await log_out();
        await log_in('user1', 'user1');
        expect(await is_logged()).to.equal(true);
        await change_password('test_pass', 'test_pass');
        expect(await is_logged()).to.equal(false);
    });

    it('restoring cookie does not restore the session', async () => {
        await driver.manage().addCookie({name: cookie.name, value: cookie.value});
        expect(await is_logged()).to.equal(false);
    });

    it('cleanup', async () => {
        await log_in('user1', 'test_pass');
        await change_password('user1', 'user1');
        await log_in('user1', 'user1');
        expect(await is_logged()).to.equal(true);
    });
});

describe("getting quizes", () => {
    it('log in', async () => {
        await log_in('user1', 'user1');
        expect(await is_logged()).to.equal(true);
    });

    it ('quizes are loaded correctly', async() => {
        expect(await is_test_to_fill(1)).to.equal(true);
        expect(await is_test_to_fill(2)).to.equal(true);
        expect(await is_test_to_fill(3)).to.equal(false);
    });
});

describe("2x quiz fill", () => {
    it('logged in', async () => {
        await log_in('user1', 'user1');
        expect(await is_logged()).to.equal(true);
    });

    it ('fill quiz', async() => {
        await driver.get(QUIZ_URL);
        await driver.find(`#quizlist-grid > button:nth-child(1)`).click();
        await driver.find(`#start-btn`).click();

        for(let i = 0; i < 4; i++) {
            await driver.find(`#answer-btns > button:nth-child(1)`).click();
            await driver.find(`#next-btn`).click();
        }

        await driver.find(`#finish-btn`).click();
    });

    it ('cant run again', async() => {
        await driver.get(QUIZ_URL);
        await driver.find(`#quizlist-grid > button:nth-child(1)`).click();
        await driver.find(`#start-btn`).click();
        expect(await driver.find(`#start-btn`).then(() => true).catch(() => false)).to.equal(true);
    });
});