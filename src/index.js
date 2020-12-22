import express from 'express';
import storage from './memory_storage';  //u trenutnom direktoriju
import cors from 'cors'
import connect from './db.js'
import mongo from 'mongodb';
var _ = require('lodash');

const app = express() // instanciranje aplikacije
app.use(cors()) //na svim rutama omogucimo cors (cross origin resource sharing)
const port = 3000 // port na kojem će web server slušati
app.use(express.json())


//wa-503
let checkEmail = (data) =>{
    let correctSyntax = '/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/'
    if (data.email == new RegExp(correctSyntax)){
        return true
    }
    else return false;
}

let checkAttributes = (data) =>{
    if (!checkEmail(data) || !data.createdBy || !data.title || !data.source){
        return false
    }
    return true;
}

app.get('/', (req, res) => {
    let poruka = "Na landing pageu ste. Idite na /posts za postove"
    console.log(poruka)
    res.send(poruka)

});

app.post('/posts', async (req, res) => {
    let db = await connect();
    let data = req.body;
    data.postedAt = new Date().getTime();

    delete data._id;
    //WA-503
    let check = checkAttributes(data)
    if (!check) {
        res.json({
            status: 'fail',
            reason: 'incomplete post'
          });
      } 

    let result = await db.collection('posts').insertOne(data);

    if (result.insertedCount == 1) {
        res.json({
            status: 'success',
            id: result.insertedId,
        });
    } else {
            res.json({
                status: 'fail',
                });
            }
});

app.get('/posts/:id', async (req, res) => {
    let id = req.params.id;
    let db = await connect();
    let document = await db.collection('posts').findOne({ _id: mongo.ObjectId(id) });

    res.json(document);
});



app.put('/posts/:id', async (req, res) => {
    let id = req.params.id;
    let db = await connect();
    let data = req.body
    data.postedAt = new Date().getTime();
    delete data._id;
    let check = checkAttributes(data)
    if (!check) {
        res.json({
            status: 'fail',
            reason: 'incomplete post'
          });
      } 

    let result = await db.collection('posts').replaceOne({ _id: mongo.ObjectId(id) }, data);
    if (result.modifiedCount == 1) {
        let returnData = result.ops[0];
        returnData._id = id;
        res.json({ returnData });
    } else {
            res.json({
                status: 'fail',
                });
            }
});

//wa-501
app.get('/post_of_the_day', async (req, res) => {
    let db = await connect()

     /* 1. način */
    // let count = await db.collection("posts").countDocuments();
    // let rand = Math.floor(Math.random() * count );
    // let randPost= await db.collection("posts").findOne({postNumber : rand})

    /* 2. način */
    let count = await db.collection("posts").aggregate([{ $sample: {size : 1}}])
    let result = await count.toArray()
    //console.log(result)
    res.json(result);

}),

app.delete('/posts/:postId/comments/:commentId', async (req, res) => {
    let db = await connect();
    let postId = req.params.postId;
    let commentId = req.params.commentId;

    let result = await db.collection('posts').updateOne(
        { _id: mongo.ObjectId(postId) },
        {
        // sada koristimo mongo direktivu $pull za micanje
        // vrijednosti iz odabranog arraya `comments`
        // komentar pretražujemo po _id-u
        $pull: { comments: { _id: mongo.ObjectId(commentId) } },
        }
    );
    if (result.modifiedCount == 1) {
        res.statusCode = 201;
        res.send();
    } else {
        res.statusCode = 500;
        res.json({
        status: 'fail',
        });
     }
   });

//WA-601 stjepan verzija s insertom
app.post('/posts/:postId/comments', async (req, res) => {
    let db = await connect();
    let comment = req.body;
    let postId = req.params.postId;

    // datume je ispravnije definirati na backendu
    comment.posted_at = Date.now();
    
    let result = await db.collection('comments').insertOne(comment);

    if (result.insertedCount == 1) {
        res.json({
            status: 'success',
            id: comment._id, // kao id vraćamo generirani _id
        });
    } 
    else {
        res.statusCode = 500;
        res.json({
            status: 'fail',
        });
    }
});

//Wa-602
app.get('/posts/:postId/comments', async (req, res) => {
    let db = await connect();
    let postId = req.params.postId;

    let filter = {
        postId: parseInt(postId)
    }    

    let cursor = await db.collection('comments').find(filter);
    let results = await cursor.toArray();
    console.log(results)

    res.json(results);
})



/*
app.post('/posts/:postId/comments', async (req, res) => {
    let db = await connect();
    let doc = req.body;
    let postId = req.params.postId;

    // u mongu dokumenti unutar postojećih dokumenata ne dobivaju
    // automatski novi _id, pa ga moramo sami dodati
    doc._id = mongo.ObjectId();
    // datume je ispravnije definirati na backendu
    doc.posted_at = Date.now();
    
    let result = await db.collection('posts').updateOne(
    { _id: mongo.ObjectId(postId) },
    {
    // operacija $push dodaje novu vrijednost u
    // atribut `comments`, a ako on ne postoji
    // automatski ga stvara i postavlja na []
    $push: { comments: doc },
        }
    );
    if (result.modifiedCount == 1) {
        res.json({
        status: 'success',
        id: doc._id, // kao id vraćamo generirani _id
        });
    } else {
        res.statusCode = 500;
        res.json({
            status: 'fail',
            });
        }
    });
*/


app.get('/posts', async (req, res) => {
    let db = await connect()
    let query = req.query
    let filter = {}
    
    
    if (query._any){
        console.log('q:', query._any)
        let pretraga = query._any
        let terms = pretraga.split(' ')
        console.log('asda')
        let atributi = ["title", "createdBy", "postedAt"] // ...
        filter = {
            $and: [],
        };
    
        terms.forEach((term) =>{
            let or ={
                $or: []
            };
    
            atributi.forEach(atribut =>{
                or.$or.push({[atribut]: new RegExp(term) });
                
            })
            
            filter.$and.push(or);
        });
    }
     
    console.log('filter:', filter)

    let cursor = await db.collection("posts").find(filter)
        
    let results = await cursor.toArray()

    res.json(results)
   }),


app.patch('/posts/:id', async (req, res) => {
    let doc = req.body;
    delete doc._id;
    let id = req.params.id;
    let db = await connect();
    let result = await db.collection('posts').updateOne(
        { _id: mongo.ObjectId(id) },
        {
             $set: doc,
        }
    );
    if (result.modifiedCount == 1) {
        res.json({
            status: 'success',
            id: result.insertedId,
        });
    } else {
        res.json({
            status: 'fail',
            });
        }
});
           

   app.get('/posts_memory', (req, res) => {
    
    let postovi = storage.posts
    let query = req.query

    if(query.title) {                     //ako je predan parametar title, inače prikazuj sve
        postovi = postovi.filter(e => e.title.indexOf(query.title) >= 0)
    }

    if(query.createdBy) {
        postovi = postovi.filter(e => e.createdBy.indexOf(query.createdBy) >= 0)
    }

    //sistemski atribut/indikator koji kaze da se mora pretrazivati po bilo cemu
    if(query._any) {
        
        let pretraga = query._any
        let pojmovi = pretraga.split(" ")

        postovi = postovi.filter(post => {
            let podaci = post.title + post.createdBy
            let rezultat = pojmovi.every(pojam => {
                return podaci.indexOf(pojam) >= 0
            })
            return rezultat
        })
    }
   
    res.json(postovi)
});



app.listen(port, () => console.log(`Slušam na portu ${port}!`))