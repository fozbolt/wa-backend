import mongo from "mongodb";

let connection_string = "mongodb+srv://admin:admin@fo-cluster0-b1r2g.mongodb.net/test?retryWrites=true&w=majority"

let client = new mongo.MongoClient(connection_string, {
 useNewUrlParser: true,
 useUnifiedTopology: true
});

let db = null

export default () => {
    return new Promise((resolve, reject) => {
    
        if (db && client.isConnected()) {
            resolve(db)
            }
        else {
            client.connect(err => {
        if (err) {
            reject("Spajanje na bazu nije uspjelo:" + err);
            }
        else {
            console.log("Database connected successfully!");
            db = client.db("fipugram");
            resolve(db);
            }
        });
        }
    });
}