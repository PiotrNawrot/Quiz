export class QuizDBEntry {
    private totalScore : number;
    private statistics : string;

    constructor (totalScore : number, statistics : string) {
        this.totalScore = totalScore;
        this.statistics = statistics;
    }
}

export class DatabaseHandler {
    private database : IDBDatabase | null;
    private rankingSize : number;

    constructor (rankingSize : number = 4) {
        this.rankingSize = rankingSize;
        this.database = null;
    }

    open () {
        return new Promise((resolve, reject) => {
            const databaseRequest : IDBOpenDBRequest = window.indexedDB.open("MyTestDatabase", 14);

            databaseRequest.onsuccess = () => {
                this.database = databaseRequest.result;
                resolve();
            }

            databaseRequest.onerror = () => {
                console.error("DB open error");
                reject();
            }

            databaseRequest.onupgradeneeded = (event : any) => {
                const tmp = event.currentTarget.result;
                tmp.createObjectStore("quizDB", {keyPath: "id", autoIncrement : true});
            }
        })
    }

    addToDb (entry : QuizDBEntry) {
        const transaction : IDBTransaction = this.database!.transaction(["quizDB"], "readwrite");
        const rankingSize = this.rankingSize;

        transaction.onerror = (event : Event) => {
            console.error("Rollback, and here is error: ", transaction.error);
        }

        const objectStore : IDBObjectStore = transaction.objectStore("quizDB");
        const request : IDBRequest = objectStore.add(entry);

        request.onsuccess = () => {
            objectStore.getAll().onsuccess = function(event : any) {
                if (event.target.result.length <= rankingSize){
                    return;
                }

                const rankingArray = event.target.result;
                rankingArray.sort((a:any,b:any) => a.totalScore >= b.totalScore);
                objectStore.delete(rankingArray[rankingSize].id);
            };
        }
    }

    fetchRankingFromDb (answerButtonsElement : HTMLElement) {
        const transaction : IDBTransaction= this.database!.transaction(["quizDB"], "readonly");

        transaction.onerror = (event : Event) => {
            console.error("Rollback, and here is error: ", transaction.error);
        }

        const objectStore : IDBObjectStore = transaction.objectStore("quizDB");

        objectStore.getAll().onsuccess = function(event : any) {
            const rankingArray = event.target.result;
            rankingArray.sort((a:any,b:any) => a.totalScore >= b.totalScore);

            for(let i = 0; i < rankingArray.length; i++){
                const button = document.createElement('button');
                button.innerHTML = `${i + 1}. ${rankingArray[i].totalScore}`;

                button.classList.add('btn');
                answerButtonsElement.appendChild(button);
            }
        };
    }
}